import {validateGardenState} from '../eras/domain.js';
import {cloudStateEqual} from './state.js';

export function createErasSync({store,client,onStatus=()=>{},online=()=>navigator.onLine,id=()=>crypto.randomUUID()}) {
  let stopped=false,running=false,timer,retry=2000,conflict=null,activeEnabled=false;
  const report=(status,extra={})=>onStatus({status,conflict,enabled:activeEnabled,...extra});
  function schedule(delay=0){clearTimeout(timer);timer=null;if(!stopped)timer=setTimeout(()=>{timer=null;tick();},delay);}
  function remoteState(value){
    if(!value||!Number.isSafeInteger(value.version)||value.version<0)throw new Error('cloudInvalidResponse');
    return {...value,payload:validateGardenState(value.payload)};
  }
  async function tick(){
    if(stopped||running)return;
    running=true;
    try {
      const local=await store.readCloud();
      activeEnabled=local.meta.enabled;
      if(!local.meta.enabled){report('cloudDisabled');return;}
      if(!online()){report('cloudOffline');return;}
      if(conflict){report('cloudConflict');return;}
      report('cloudSyncing');
      // Persist the request before fetch; retry the same immutable payload/id.
      if(local.meta.pending||local.meta.dirty){
        const pending=await store.prepareCloud(id());
        if(stopped||!activeEnabled)return;
        const response=await client.rpc('morrow_eras_commit',{p_request_id:pending.id,p_expected_version:pending.expectedVersion,p_payload:pending.payload});
        if(stopped)return;
        if(response?.status==='conflict'){
          conflict=remoteState(response);report('cloudConflict');return;
        }
        if(response?.status!=='ok')throw new Error('cloudInvalidResponse');
        await store.acknowledgeCloud(response,pending.id);
        if(!activeEnabled){report('cloudDisabled');return;}
        report('cloudPending');retry=2000;schedule(0);return;
      }
      const remote=remoteState(await client.rpc('morrow_eras_read'));
      if(stopped||!activeEnabled)return;
      if(remote.version!==local.meta.remoteVersion){
        if(remote.version===0&&local.meta.remoteVersion>0)throw new Error('cloudRemoteReset');
        await store.adoptCloud(remote,local.meta.generation);
      }else if(!cloudStateEqual(remote.payload,local.state)&&remote.version>0){
        // A same-version mismatch requires review rather than silent replacement.
        conflict=remote;report('cloudConflict');return;
      }
      retry=2000;report('cloudSynced');
    } catch(error){report(error.message==='cloudLocalChanged'?'cloudPending':error.message);retry=Math.min(retry*2,60000);}
    finally{running=false;if(activeEnabled&&!timer&&!stopped)schedule(retry===2000?15000:retry);}
  }
  const unsubscribe=store.onchange(()=>{if(activeEnabled&&!conflict)report('cloudPending');schedule(150);});
  const resume=()=>schedule(0);
  globalThis.addEventListener?.('online',resume);
  globalThis.addEventListener?.('focus',resume);
  return {
    start:resume,
    async enable(){await store.setCloudEnabled(true);activeEnabled=true;resume();},
    async disable(){await store.setCloudEnabled(false);activeEnabled=false;clearTimeout(timer);timer=null;report('cloudDisabled');},
    async conflictCopies(){if(!conflict)throw new Error('cloudLocalChanged');const local=await store.readCloud();return {local:local.state,remote:conflict.payload,generation:local.meta.generation};},
    async resolve(choice,generation){if(!conflict)throw new Error('cloudLocalChanged');await store.resolveCloud(conflict,choice,generation);conflict=null;resume();},
    stop(){stopped=true;clearTimeout(timer);unsubscribe();globalThis.removeEventListener?.('online',resume);globalThis.removeEventListener?.('focus',resume);}
  };
}
