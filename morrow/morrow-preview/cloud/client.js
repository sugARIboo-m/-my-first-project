import {MORROW_CLOUD_CONFIG} from './config.js';

const CLOUD_AUTH_ERRORS=Object.freeze({
  invalid_credentials:'cloudInvalidCredentials',
  email_not_confirmed:'cloudEmailNotConfirmed',
  user_already_exists:'cloudAccountExists',
  email_exists:'cloudAccountExists',
  signup_disabled:'cloudSignupDisabled',
  email_provider_disabled:'cloudSignupDisabled',
  weak_password:'cloudWeakPassword',
  email_address_invalid:'cloudInvalidEmail',
  email_address_not_authorized:'cloudEmailNotAuthorized',
  over_email_send_rate_limit:'cloudEmailRateLimit',
  over_request_rate_limit:'cloudRateLimit',
  captcha_failed:'cloudCaptchaRequired',
  hook_timeout:'cloudRequestFailed',
  unexpected_failure:'cloudAuthServiceError'
});

export function createMorrowCloudClient({config=MORROW_CLOUD_CONFIG,fetcher=fetch,storage=localStorage}={}) {
  const sessionKey='morrow-auth-'+new URL(config.url).hostname;
  const readSession=()=>{try{const s=JSON.parse(storage.getItem(sessionKey));return s?.access_token&&s?.refresh_token&&/^[a-f0-9-]{36}$/i.test(s.user?.id)?s:null;}catch{return null;}};
  let session=readSession(),refreshing;
  function saveSession(value){session=value;value?storage.setItem(sessionKey,JSON.stringify(value)):storage.removeItem(sessionKey);}
  async function request(path,{method='GET',body,token}={}) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetcher(config.url+path,{method,headers:{apikey:config.publishableKey,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});
      const data=await response.json().catch(()=>null);
      if(!response.ok){
        const authError=path.startsWith('/auth/v1/')?CLOUD_AUTH_ERRORS[data?.error_code??data?.code]:null;
        const fallback=response.status===401||response.status===403?'cloudAuthRequired':response.status===429?'cloudRateLimit':path.startsWith('/rest/v1/')&&(data?.code==='PGRST202'||response.status===404)?'cloudSchemaRequired':'cloudRequestFailed';
        // Map only recognized codes; never display arbitrary server details.
        const error=new Error(authError??fallback);error.status=response.status;throw error;
      }
      return data;
    } catch(error){if(error.status)throw error;throw new Error('cloudNetworkError');}
    finally{clearTimeout(timer);}
  }
  async function token() {
    if(!session)throw new Error('cloudAuthRequired');
    if(session.expires_at*1000>Date.now()+60000)return session.access_token;
    if(!refreshing)refreshing=(async()=>{
      const refresh=async()=>{
        session=readSession();if(!session)throw new Error('cloudAuthRequired');
        if(session.expires_at*1000>Date.now()+60000)return session.access_token;
        const priorUser=session.user.id;
        const next=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
        if(next.user?.id!==priorUser)throw new Error('cloudAuthRequired');
        saveSession(next);return next.access_token;
      };
      return globalThis.navigator?.locks?globalThis.navigator.locks.request(sessionKey,refresh):refresh();
    })().finally(()=>refreshing=null);
    return refreshing;
  }
  return {
    getSession:()=>session,
    // Separate sync revisions/outboxes even if user IDs match across projects.
    getDatabaseName:()=>session?'morrow-garden-user-'+new URL(config.url).hostname+'-'+session.user.id:'morrow-garden-v1',
    sessionKey,
    async signIn(email,password){const next=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});if(!next?.user?.id)throw new Error('cloudAuthRequired');saveSession(next);return next;},
    async signUp(email,password){const result=await request('/auth/v1/signup',{method:'POST',body:{email,password}});if(result?.access_token)saveSession(result);return result;},
    async signOut(){if(session){try{await request('/auth/v1/logout',{method:'POST',token:await token()});}catch{/* Local sign-out remains available offline. */}}saveSession(null);},
    async rpc(name,body={}){return request('/rest/v1/rpc/'+name,{method:'POST',body,token:await token()});}
  };
}
