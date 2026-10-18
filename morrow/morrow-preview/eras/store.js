import {emptyGardenState,validateGardenState} from './domain.js';
import {reconcileAchievements} from './experience-domain.js';

export function createGardenStore() {
  let database;
  const changes=typeof BroadcastChannel==='function'?new BroadcastChannel('morrow-garden-updates'):null;
  async function open() {
    if(database)return database;
    database=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('morrow-garden-v1',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('state');
        request.result.createObjectStore('recovery',{autoIncrement:true});
      };
      request.onsuccess=()=>{
        const result=request.result;
        result.onversionchange=()=>{result.close();database=null;};resolve(result);
      };
      request.onerror=()=>reject(new Error('gardenStorageUnavailable'));
      request.onblocked=()=>reject(new Error('gardenStorageUnavailable'));
    });
    return database;
  }
  async function read() {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('state','readonly');
      const request=transaction.objectStore('state').get('current');let state;
      request.onsuccess=()=>{try{state=validateGardenState(request.result??emptyGardenState());}catch(error){reject(error);}};
      transaction.oncomplete=()=>resolve(state);transaction.onerror=()=>reject(new Error('gardenStorageUnavailable'));
      transaction.onabort=()=>reject(new Error('gardenStorageUnavailable'));
    });
  }
  async function update(reducer,{recovery=false}={}) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(['state','recovery'],'readwrite');
      const table=transaction.objectStore('state');const request=table.get('current');let next,error,changed=false;
      request.onsuccess=()=>{
        try{
          const current=validateGardenState(request.result??emptyGardenState());
          next=validateGardenState(reconcileAchievements(validateGardenState(reducer(current)),new Date().toISOString()));
          if(recovery||request.result?.schemaVersion===1){
            // Upgrade only adds metadata; retain the original raw snapshot.
            if(!transaction.objectStoreNames.contains('recovery'))throw new Error('gardenMigrationRequired');
            transaction.objectStore('recovery').add({createdAt:new Date().toISOString(),state:request.result??current});
          }
          changed=JSON.stringify(request.result??emptyGardenState())!==JSON.stringify(next);
          if(changed)table.put(next,'current');
        }catch(problem){error=problem;transaction.abort();}
      };
      transaction.oncomplete=()=>{if(changed)changes?.postMessage('changed');resolve(next);};
      transaction.onerror=()=>reject(error??new Error('gardenStorageUnavailable'));
      transaction.onabort=()=>reject(error??new Error('gardenStorageUnavailable'));
    });
  }
  return {read,update,onchange(callback){if(changes)changes.onmessage=callback;}};
}
