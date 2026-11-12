import {createHash} from 'node:crypto';
import record from '../data/catalog/apc-apdu11350me.json';
import {catalogInputError} from '../lib/system-specs';
import type {SystemSpecs} from '../lib/system-specs';

type DB={query:(sql:string,args?:unknown[])=>Promise<{rows:Record<string,unknown>[];rowCount?:number|null}>};
type Mode='plan'|'apply'|'verify'|'rollback';
const canonical=(v:unknown):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(canonical(x))])):v);
export const recordHash=createHash('sha256').update(canonical(record)).digest('hex');
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message);};
export type LibraryAddPlan={version:1;recordHash:string;before:typeof record|null;after:typeof record;changed:boolean};
// A narrow insert-only operation. Existing variants, installations and links are never rewritten.
export async function addApdu11350(db:DB,mode:Mode,plan?:LibraryAddPlan){
 check(['plan','apply','verify','rollback'].includes(mode),'Unsupported mode');
 check(!catalogInputError({...record,specs:record.rawData.systemSpecs as SystemSpecs}),'Invalid reviewed catalog data');
 const readOnly=mode==='plan'||mode==='verify';
 await db.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL SERIALIZABLE');
 try{
  await db.query("SET LOCAL statement_timeout='15s'");await db.query("SET LOCAL lock_timeout='5s'");
  if(!readOnly)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['catalog:APDU11350ME']);
  const found=(await db.query('SELECT id,sku,vendor,model,"heightRU",category,"rawData" FROM "CatalogDevice" WHERE id=$1 OR upper(sku)=$2 OR upper(model)=$2'+(readOnly?'':' FOR UPDATE'),[record.id,record.sku])).rows;
  check(found.length<=1&&(!found.length||same(found[0],record)),'Existing APDU11350ME record differs; preserved without writes');
  if(mode==='plan'){
   await db.query('COMMIT');return {version:1,recordHash,before:found[0]||null,after:record,changed:!found.length};
  }
  check(plan?.version===1&&plan.recordHash===recordHash&&same(plan.after,record)&&plan.changed===(plan.before===null)&&(!plan.before||same(plan.before,record)),'Saved Library plan differs from reviewed source');
  if(mode==='verify')check(found.length===1,'APDU11350ME Library addition is missing');
  if(mode==='apply'){
   check(same(found[0]||null,plan!.before),'Library changed since backup; no insert performed');
   if(plan!.changed){
    const result=await db.query('INSERT INTO "CatalogDevice" (id,sku,vendor,model,"heightRU",category,"rawData") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',[record.id,record.sku,record.vendor,record.model,record.heightRU,record.category,JSON.stringify(record.rawData)]);
    check(result.rowCount===1,'Library insert failed');
   }
  }
  if(mode==='rollback'&&plan!.changed&&found.length){
   const installed=(await db.query('SELECT id FROM "DeviceInstance" WHERE "catalogDeviceId"=$1 LIMIT 1',[record.id])).rows;
   check(!installed.length,'New PDU is now installed; preserve it for manual recovery');
   check((await db.query('DELETE FROM "CatalogDevice" WHERE id=$1 AND "rawData"=$2::jsonb',[record.id,JSON.stringify(record.rawData)])).rowCount===1,'Library changed; rollback stopped');
  }
  await db.query('COMMIT');return {outcome:mode==='verify'?'APDU11350ME Library addition verified':mode,libraryRecordsChanged:plan!.changed?1:0,recordHash,sku:record.sku,installationRowsWritten:0,connectionRowsWritten:0};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
