import {writeFile,mkdir} from 'node:fs/promises';
import {ERA_THEMES,GARDEN_STAGES} from './domain.js';
import {renderGardenSvg} from './art.js';
const directory=new URL('./assets/',import.meta.url);await mkdir(directory,{recursive:true});
for(const theme of ERA_THEMES)for(let stage=0;stage<5;stage++)await writeFile(new URL(`${theme.id}-${GARDEN_STAGES[stage]}.svg`,directory),renderGardenSvg(theme.id,stage,{prefix:`${theme.id}-${stage}`,label:`${theme.name} — ${GARDEN_STAGES[stage]}`}));
console.log('Generated 20 original vector assets: four themes × five stages.');
