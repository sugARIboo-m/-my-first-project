import {ERA_THEMES} from './domain.js';

const artEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function gardenFlower(x,y,size,theme,openness=1) {
  const petals=theme.flower==='daisy'?10:theme.flower==='star'?6:7;
  const shape=Array.from({length:petals},(_,i)=>{
    const angle=360/petals*i;
    return theme.flower==='star'
      ? `<path d="M0 3 Q${-size*.65} ${-size*.4} 0 ${-size*openness} Q${size*.65} ${-size*.4} 0 3" transform="rotate(${angle})"/>`
      : `<ellipse cy="${-size*.44*openness}" rx="${size*.32}" ry="${size*.59*openness}" transform="rotate(${angle})"/>`;
  }).join('');
  return `<g class="garden-flower" transform="translate(${x} ${y})"><g fill="${theme.palette[3]}" stroke="${theme.palette[2]}" stroke-opacity=".36" stroke-width=".8">${shape}</g><circle r="${size*.19}" fill="${theme.flower==='daisy'?'#c8b689':theme.palette[1]}"/><circle r="${size*.09}" fill="#f4ece3" fill-opacity=".8"/></g>`;
}

export function renderGardenSvg(themeId,stage,{prefix='garden',label='Original savings garden'}={}) {
  const theme=ERA_THEMES.find(item=>item.id===themeId)??ERA_THEMES[0];
  const phase=Math.max(0,Math.min(4,Math.trunc(Number(stage)||0)));
  const id='garden-'+String(prefix).replace(/[^a-zA-Z0-9_-]/g,'');
  const [background,accent,shadow,petal]=theme.palette;
  let atmosphere='';
  if(theme.id==='eternal-bloom')atmosphere=`<ellipse cx="450" cy="84" rx="92" ry="29" fill="#fff" opacity=".23"/><ellipse cx="120" cy="120" rx="68" ry="24" fill="#fff" opacity=".22"/><circle cx="440" cy="65" r="26" fill="url(#${id}-pearl)"/>${[[108,62,3],[480,155,2],[154,203,2],[377,41,2]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".7"/>`).join('')}`;
  if(theme.id==='pink-pony')atmosphere=`<path d="m135 0 90 270H10ZM455 0 140 270h290Z" fill="#be8c9f" opacity=".13"/><path d="M0 38q300 100 600 0" fill="none" stroke="${shadow}" stroke-opacity=".13"/>${[[100,100],[478,78],[427,160]].map(([x,y])=>`<path d="M${x-7} ${y}h14m-7-7v14" stroke="${shadow}" stroke-opacity=".48" stroke-width="1"/>`).join('')}`;
  if(theme.id==='charm')atmosphere=`<circle cx="448" cy="83" r="33" fill="#f6efd9" opacity=".82"/><path d="m0 0 220 0L80 245H0Z" fill="#fff" opacity=".16"/><path d="M42 250q30-19 57-4m390 2q20-12 43-2" fill="none" stroke="${accent}" stroke-opacity=".35"/><ellipse cx="139" cy="283" rx="20" ry="7" fill="#bab9a7" opacity=".45"/>`;
  if(theme.id==='blue-hour')atmosphere=`<path d="M0 163q135-38 280 0t320 0V0H0Z" fill="${accent}" opacity=".12"/><path d="M0 176q135-38 280 0t320 0" fill="none" stroke="${shadow}" stroke-opacity=".25"/><circle cx="462" cy="66" r="22" fill="#f1e9d9" opacity=".8"/><ellipse cx="462" cy="202" rx="48" ry="3" fill="#eae4d9" opacity=".45"/>`;
  const rootY=283;
  let plants='';
  if(phase===0){
    plants=`<path d="M281 278q12-22 30-6-2 22-30 6Z" fill="${accent}" stroke="${shadow}" stroke-width="1.2"/><path d="m286 280 16-9" stroke="${petal}" stroke-opacity=".7"/>`;
  } else {
    const stems=phase===1?[[300,211,0]]:phase===2?[[300,156,1],[251,211,0],[350,204,0]]:
      phase===3?[[300,117,2],[230,161,1],[373,171,1],[181,222,0]]:
      [[300,106,3],[225,149,3],[378,151,3],[167,205,2],[435,212,2]];
    plants=stems.map(([x,y,bloom],index)=>{
      const bend=x<300?x+25:x-22;
      const leafY=y+(rootY-y)*.55;
      const stem=`<path class="garden-stem" d="M300 ${rootY}Q${bend} ${leafY} ${x} ${y}" fill="none" stroke="${theme.id==='charm'?'#7e8e72':shadow}" stroke-width="${index===0?2:1.7}" stroke-linecap="round"/>`;
      const leaves=`<path d="M${bend} ${leafY+10}q-35-4-38-28 31-5 38 28Z" fill="${accent}" fill-opacity=".75"/><path d="M${bend+1} ${leafY-1}q33-6 33-28-30 1-33 28Z" fill="${accent}" fill-opacity=".48"/>`;
      const flower=bloom>0?gardenFlower(x,y,phase===4?(index<3?30:21):phase===3?24:13,theme,bloom===1?.54:1):`<ellipse cx="${x}" cy="${y}" rx="6" ry="10" fill="${accent}"/>`;
      return stem+leaves+flower;
    }).join('');
  }
  return `<svg class="garden-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${artEscape(label)}</title><defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${petal}"/></linearGradient><radialGradient id="${id}-pearl"><stop stop-color="#fff"/><stop offset=".6" stop-color="#efe8ed"/><stop offset="1" stop-color="${accent}" stop-opacity=".4"/></radialGradient><filter id="${id}-grain"><feTurbulence type="fractalNoise" baseFrequency=".68" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="600" height="360" rx="20" fill="url(#${id}-sky)"/>${atmosphere}<ellipse cx="300" cy="302" rx="186" ry="30" fill="${shadow}" opacity=".08"/><ellipse cx="300" cy="293" rx="160" ry="23" fill="${petal}"/><ellipse cx="300" cy="290" rx="146" ry="19" fill="${accent}" fill-opacity=".10" stroke="${shadow}" stroke-opacity=".18"/>${plants}<path d="M275 292q26 5 51-1" fill="none" stroke="${shadow}" stroke-opacity=".25" stroke-linecap="round"/><rect width="600" height="360" rx="20" filter="url(#${id}-grain)" opacity=".035" pointer-events="none"/></svg>`;
}
