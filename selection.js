import { lemmaOf, commonRank, exclusionReason, profileOf } from './level.js';
const STOP=new Set('a an the and or but so if as at by for from in into of on to with without is are was were be been being am do does did doing have has had having i you he she it we they me him her us them my your his its our their this that these those what which who whom whose how when where why not no yes can could will would shall should may might must than then too very just also only all each every some any other such one two more most less many much there here about after before over under out up down off through between during while because until once both either neither own same'.split(' '));
export const MAX_BOOK_CHARACTERS=3000000;
export async function analyzeSections(sections,knownWords,state,lexicon,notify=()=>{}){
  if(!sections.length||sections.length>500||sections.reduce((n,s)=>n+s.text.length,0)>MAX_BOOK_CHARACTERS)throw new Error('本轮最多筛选500个章节、300万字符，请分批勾选；不会截断正文。');
  const known=new Map(knownWords.map(w=>[w.word.toLowerCase(),w])),counts=new Map();
  for(let index=0;index<sections.length;index++){
    const section=sections[index];
    for(const match of section.text.matchAll(/[^.!?。！？\n]+(?:[.!?。！？]+|$)/g)){
      const sentence=match[0].trim();
      for(const token of sentence.matchAll(/[a-zA-Z]+(?:[-’'][a-zA-Z]+)*/g)){
        const surface=token[0].toLowerCase().replace(/’/g,"'");if(surface.length<3||surface.length>40||STOP.has(surface))continue;
        const lemma=lemmaOf(surface);if(STOP.has(lemma))continue;
        let c=counts.get(lemma);
        if(!c){const own=known.get(surface)||known.get(lemma),entry=Object.hasOwn(lexicon,lemma)?lexicon[lemma]:null;
          const word=own||(entry?{id:'custom-wn-'+lemma,deck:'custom',word:lemma,meaning:entry.meaning.slice(0,500),pos:({n:'n.',v:'v.',a:'adj.',s:'adj.',r:'adv.'})[entry.pos]||'',ipa:'',example:'',translation:'',dictionarySource:{name:'WordNet',version:'3.0',lemma,synset:entry.synset,definition:entry.meaning}}:null);
          c={word:own?.word||lemma,lemma,count:0,known:word,nativeMeaning:Boolean(own),lowercase:0,capitalized:0,rank:commonRank(lemma),contexts:{},sentence:'',source:word?.dictionarySource?'WordNet英文义项':'学习词库 / 整理释义'};counts.set(lemma,c);
        }
        c.count++;
        if(token[0][0]===token[0][0].toLowerCase())c.lowercase++;else c.capitalized++;
        if(!c.contexts[section.id]){const start=sentence.length>1000?Math.max(0,token.index-250):0;const context=sentence.slice(start,start+900);c.contexts[section.id]=context;if(!c.sentence)c.sentence=context;}
      }
    }
    notify(index+1,sections.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Keep taught phrases as phrases; common individual words do not imply knowing an idiom.
  for(const w of knownWords.filter(w=>w.word.includes(' ')).slice(0,500)){
    const pattern=w.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    const regex=new RegExp('\\b'+pattern+'\\b','gi');let c=null;
    for(const section of sections){const matches=[...section.text.matchAll(regex)];if(!matches.length)continue;
      c||={word:w.word,lemma:lemmaOf(w.word),count:0,known:w,rank:null,contexts:{},sentence:'',source:'学习词库 / 整理释义'};
      c.count+=matches.length;const at=matches[0].index;const context=section.text.slice(Math.max(0,at-120),at+250).trim();c.contexts[section.id]=context;if(!c.sentence)c.sentence=context;
    }
    if(c)counts.set(c.lemma,c);
  }
  const candidates=[...counts.values()];
  const personalWeak=new Set(profileOf(state).unknown);
  for(const c of candidates){c.reason=exclusionReason(c.known||c.word,state);c.personalWeak=personalWeak.has(c.lemma);c.likelyName=!c.nativeMeaning&&c.capitalized>0&&c.lowercase===0;}
  candidates.sort((a,b)=>Number(Boolean(a.reason))-Number(Boolean(b.reason))||Number(Boolean(b.personalWeak))-Number(Boolean(a.personalWeak))||Number(Boolean(b.known))-Number(Boolean(a.known))||Number(Boolean(a.likelyName))-Number(Boolean(b.likelyName))||b.count-a.count||(a.rank||30000)-(b.rank||30000)||a.word.localeCompare(b.word));
  return candidates;
}
