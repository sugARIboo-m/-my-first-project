import {emptyGardenState,validateGardenState} from './domain.js';
import {reconcileAchievements} from './experience-domain.js';
import {cloudMetadata,cloudPrepare,cloudAcknowledge,cloudStateEqual} from '../cloud/state.js';

export function createGardenStore({name='morrow-garden-v1'}={}) {
  let database;
  const listeners=new Set();
  const changes=typeof BroadcastChannel==='function'?new BroadcastChannel(name+'-updates'):null;
  const emit=()=>listeners.forEach(callback=>callback());
  if(changes)changes.onmessage=emit;
  async function open() {
    if(database)return database;
    database=await new Promise((resolve,reject)=>{
      let request;try{request=indexedDB.open(name,1);}catch{reject(new Error('gardenStorageUnavailable'));return;}
      request.onupgradeneeded=()=>{request.result.createObjectStore('state');request.result.createObjectStore('recovery',{autoIncrement:true});};
      request.onsuccess=()=>{const result=request.result;result.onversionchange=()=>{result.close();database=null;};resolve(result);};
      request.onerror=request.onblocked=()=>reject(new Error('gardenStorageUnavailable'));
    });return database;
  }
  async function readCloud() {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readonly'),table=tx.objectStore('state');let state,meta,error;
      table.get('current').onsuccess=event=>{try{state=validateGardenState(event.target.result??emptyGardenState());}catch(e){error=e;}};
      table.get('cloud').onsuccess=event=>meta=cloudMetadata(event.target.result);
      tx.oncomplete=()=>error?reject(error):resolve({state,meta});
      tx.onerror=tx.onabort=()=>reject(new Error('gardenStorageUnavailable'));
    });
  }
  async function atomic(reducer,{recovery=false}={}) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['state','recovery'],'readwrite'),table=tx.objectStore('state');let result,error,changed=false;
      table.get('current').onsuccess=event=>{
        const raw=event.target.result;
        table.get('cloud').onsuccess=metadataEvent=>{
          try {
            const current=validateGardenState(raw??emptyGardenState()),metadata=cloudMetadata(metadataEvent.target.result);
            const next=reducer(current,metadata);next.state=validateGardenState(next.state);
            if(recovery||raw?.schemaVersion===1)tx.objectStore('recovery').add({createdAt:new Date().toISOString(),state:raw??current});
            changed=!cloudStateEqual(raw??emptyGardenState(),next.state);
            if(changed)table.put(next.state,'current');
            if(!cloudStateEqual(metadata,next.meta))table.put(next.meta,'cloud');
            result=next.result??next.state;
          }catch(problem){error=problem;tx.abort();}
        };
      };
      tx.oncomplete=()=>{if(changed){changes?.postMessage('changed');emit();}resolve(result);};
      tx.onerror=tx.onabort=()=>reject(error??new Error('gardenStorageUnavailable'));
    });
  }
  return {
    read:async()=>(await readCloud()).state,
    readCloud,
    update(reducer,options){return atomic((current,meta)=>{
      const state=validateGardenState(reconcileAchievements(validateGardenState(reducer(current)),new Date().toISOString()));
      return {state,meta:cloudStateEqual(current,state)?meta:{...meta,generation:meta.generation+1,dirty:true}};
    },options);},
    setCloudEnabled(enabled){return atomic((state,meta)=>({state,meta:{...meta,enabled}}));},
    prepareCloud(id){return atomic((state,meta)=>{const next=cloudPrepare(state,meta,id);return {state,meta:next,result:next.pending};});},
    acknowledgeCloud(result,requestId){return atomic((state,meta)=>({state,meta:cloudAcknowledge(state,meta,result,requestId)}));},
    adoptCloud(remote,expectedGeneration){return atomic((state,meta)=>{
      if(meta.generation!==expectedGeneration||meta.dirty||meta.pending)throw new Error('cloudLocalChanged');
      return {state:remote.payload,meta:{...meta,remoteVersion:remote.version,lastSynced:new Date().toISOString()}};
    },{recovery:true});},
    resolveCloud(remote,choice,expectedGeneration){return atomic((state,meta)=>{
      if(meta.generation!==expectedGeneration)throw new Error('cloudLocalChanged');
      return {state:choice==='remote'?remote.payload:state,
        meta:{...meta,pending:null,remoteVersion:remote.version,dirty:choice!=='remote',generation:meta.generation+1}};
    },{recovery:true});},
    onchange(callback){listeners.add(callback);return ()=>listeners.delete(callback);}
  };
}
