export const POWER_INPUT_CONFLICT='The rack or power inputs changed since this page loaded. Your edits are kept here. Open the latest rack in another tab to compare before saving. Nothing was overwritten.';
export function canonicalPowerValue(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonicalPowerValue).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonicalPowerValue(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export const samePowerValue=(a:unknown,b:unknown)=>canonicalPowerValue(a)===canonicalPowerValue(b);
export type PowerSaveResult<T>={ok:true;saved:T;revision:string}|{ok?:false;error:string;conflict?:boolean};
export type PowerEditor<T>={draft:T;saved:T;revision:string;seenRevision:string;knownRevisions:string[];conflict:boolean;message:string;status:'idle'|'success'|'error'|'conflict'};
export type PowerSaveRequest<T>={inputs:T;revision:string;seenRevision:string};
export function createPowerEditor<T>(inputs:T,revision:string):PowerEditor<T>{return {draft:inputs,saved:inputs,revision,seenRevision:revision,knownRevisions:[revision],conflict:false,message:'',status:'idle'};}
export const powerEditorDirty=<T>(state:PowerEditor<T>)=>!samePowerValue(state.draft,state.saved);
export function editPowerEditor<T>(state:PowerEditor<T>,update:T|((value:T)=>T)):PowerEditor<T>{
 return {...state,draft:typeof update==='function'?(update as (value:T)=>T)(state.draft):update,message:state.conflict?POWER_INPUT_CONFLICT:'',status:state.conflict?'conflict':'idle'};
}
export function powerEditorMessage<T>(state:PowerEditor<T>,message:string):PowerEditor<T>{return {...state,message:state.conflict?POWER_INPUT_CONFLICT:message,status:state.conflict?'conflict':'idle'};}
export function receivePowerSnapshot<T>(state:PowerEditor<T>,inputs:T,revision:string):PowerEditor<T>{
 if(revision===state.seenRevision)return state;
 if(revision===state.revision||state.knownRevisions.includes(revision))return {...state,seenRevision:revision};
 if(powerEditorDirty(state))return {...state,seenRevision:revision,conflict:true,message:POWER_INPUT_CONFLICT,status:'conflict'};
 return {...createPowerEditor(inputs,revision),knownRevisions:[...state.knownRevisions,revision]};
}
export const capturePowerSave=<T>(state:PowerEditor<T>):PowerSaveRequest<T>=>({inputs:state.draft,revision:state.revision,seenRevision:state.seenRevision});
export function finishPowerSave<T>(state:PowerEditor<T>,request:PowerSaveRequest<T>,result:PowerSaveResult<T>,success='Power inputs saved. Cable assignments unchanged.'):PowerEditor<T>{
 if('error' in result)return {...state,conflict:state.conflict||result.conflict===true,message:result.conflict?POWER_INPUT_CONFLICT:result.error,status:result.conflict?'conflict':'error'};
 if(!/^[a-f0-9]{64}$/.test(result.revision)||result.saved==null)return {...state,message:'The save result could not be confirmed. Your draft is kept. Check the latest rack before trying again.',status:'error'};
 const laterEdits=!samePowerValue(state.draft,request.inputs);
 const newerSnapshot=state.seenRevision!==request.seenRevision&&state.seenRevision!==result.revision&&!state.knownRevisions.includes(state.seenRevision);
 return {...state,draft:laterEdits?state.draft:result.saved,saved:result.saved,revision:result.revision,knownRevisions:[...new Set([...state.knownRevisions,result.revision])],conflict:newerSnapshot,status:newerSnapshot?'conflict':'success',message:newerSnapshot?'The submitted inputs saved, but the rack changed again. Your current draft is kept. Open the latest rack in another tab before saving further edits.':laterEdits?'The submitted inputs saved. Your later edits are still unsaved.':success};
}
