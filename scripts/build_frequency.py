"""Build a reproducible frequency filter and small WordNet selection lexicon.

Requires wordfreq==3.1.1 only to regenerate assets, never during normal app setup.
The rank is a commonness heuristic, NOT a Chinese curriculum/CEFR classification.
"""
from pathlib import Path
import json
from importlib.metadata import distribution, version
from wordfreq import top_n_list

ROOT = Path(__file__).resolve().parents[1]
assert version('wordfreq') == '3.1.1'
entries = {}
for path in (ROOT / 'dictionary').glob('*.json'):
    data = json.loads(path.read_text())
    entries.update(data.get('entries', {}))
ordered = [w for w in top_n_list('en', 150000) if w in entries and w.isascii() and w.replace('-', '').isalpha()]
ordered = list(dict.fromkeys(ordered))
ranks = {word: i+1 for i, word in enumerate(ordered[:20000])}
forms = json.loads((ROOT/'dictionary/exceptions.json').read_text())['forms']
meta = {'name':'wordfreq', 'version':'3.1.1', 'source':'https://github.com/rspeer/wordfreq',
    'license':'CC BY-SA 4.0', 'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
    'modification':'English frequency order intersected with WordNet headwords and reranked; not a school syllabus.',
    'count':len(ranks)}
(ROOT/'frequency.js').write_text('export const FREQUENCY_SOURCE='+json.dumps(meta,separators=(',',':'))+';\nexport const COMMON_RANKS='+json.dumps(ranks,separators=(',',':'))+';\nexport const MORPHOLOGY='+json.dumps(forms,separators=(',',':'))+';\n')
lexicon={word:{'meaning':senses[0]['definition'],'pos':senses[0]['pos'],'synset':senses[0]['id']}
    for word in ordered[:30000] if (senses:=entries[word])}
license_text=(ROOT/'dictionary/LICENSE.txt').read_text()
(ROOT/'selection-lexicon.js').write_text('/* WordNet 3.0 first-sense selection. Original license follows.\n'+license_text+'\nFrequency-based selection: CC BY-SA 4.0; see frequency-DATA-NOTICE.txt.\n*/\nexport const SELECTION_LEXICON='+json.dumps(lexicon,ensure_ascii=False,separators=(',',':'))+';\n')
dist=distribution('wordfreq')
metadata=dist.read_text('METADATA')
notice=metadata[metadata.find('License\n'):]
(ROOT/'frequency-DATA-NOTICE.txt').write_text('Frequency data attribution and license\n\nDerived from wordfreq 3.1.1 by Robyn Speer and contributors.\nSource: https://github.com/rspeer/wordfreq\nData license: Creative Commons Attribution-ShareAlike 4.0\nhttps://creativecommons.org/licenses/by-sa/4.0/\n\nChanges in this application: intersect English frequencies with WordNet lemmas, rerank the first 20,000, and choose a 30,000-headword gloss subset.\nThese ranks are not Chinese school vocabulary lists or validated CEFR labels.\nWordNet morphology is separately licensed in dictionary/LICENSE.txt.\n\n'+notice)
notice_path=ROOT/'frequency-DATA-NOTICE.txt'
notice_path.write_text('\n'.join(line.rstrip() for line in notice_path.read_text().splitlines()).rstrip()+'\n')
print(f'Generated {len(ranks)} commonness ranks and {len(lexicon)} first-sense glosses; license and attribution retained.')
