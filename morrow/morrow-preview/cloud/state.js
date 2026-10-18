export function cloudCanonical(value) {
  if(Array.isArray(value))return '['+value.map(cloudCanonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+cloudCanonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
export const cloudStateEqual=(a,b)=>cloudCanonical(a)===cloudCanonical(b);
export function cloudMetadata(value) {
  return {enabled:false,generation:0,dirty:false,remoteVersion:0,pending:null,lastSynced:null,...value};
}
export function cloudPrepare(state,metadata,id) {
  const meta=cloudMetadata(metadata);
  return meta.pending?meta:{...meta,pending:{id,payload:state,generation:meta.generation,expectedVersion:meta.remoteVersion}};
}
export function cloudAcknowledge(state,metadata,result,requestId) {
  const meta=cloudMetadata(metadata),pending=meta.pending;
  // Another tab may have acknowledged this request or prepared a newer one.
  if(!pending||pending.id!==requestId)return meta;
  if(!Number.isSafeInteger(result.version)||result.version<=pending.expectedVersion)throw new Error('cloudInvalidResponse');
  return {...meta,remoteVersion:result.version,pending:null,
    dirty:meta.generation!==pending.generation||!cloudStateEqual(state,pending.payload),lastSynced:new Date().toISOString()};
}
