import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { firestoreImportRest } from '../../tools/firestore-import-rest.mjs';
import { snapshotPhones, planImport, applyImport } from '../../tools/phone-import-core.mjs';
const require=createRequire(new URL('../../functions/telephony/package.json',import.meta.url));
const {Firestore,FieldValue}=require('@google-cloud/firestore');
const sdk=new Firestore({projectId:'demo-myway-telefony',host:'127.0.0.1:8185',ssl:false});
const db=firestoreImportRest({project:'demo-myway-telefony',token:'owner',host:'http://127.0.0.1:8185'});
const c=(n)=>({id:'history-TEST'+n,label:'TEST'+n,phone:'',firstDate:'2026-04-01',firstTime:'10:00',category:'NFZ',quality:'A',temperature:'Zimny',source:'ADSY',stage:'Wygrany',province:'',status:'Rezerwacja',closedDate:n===1?'':'2026-04-20',lossReason:'',nextDate:'',nextTime:'',followupStatus:'',note:'Syntetyczny rekord',followupNote:'',owner:'',revision:0,historical:true,followupConfirmed:false,historicalCount:'3',historicalDuration:'04:15'});
const input={summary:{sha256:'b'.repeat(64),records:2,firstDate:'2026-04-01',lastDate:'2026-04-01'},records:[1,2].map(n=>({contact:c(n),financial:{amount:n===1?null:123},sourceRow:n+1,source:{id:'TEST'+n}})),sources:[{key:'example',title:'Dane syntetyczne',format:'table',content:'[["ID"],["TEST1"]]',description:'Test'}],manifest:[]};
test('import creates only missing records, archives all data and protects later edits on retry',async()=>{
 try{
  // This endpoint exists only in the local Firestore emulator.
  const clear=await fetch('http://127.0.0.1:8185/emulator/v1/projects/demo-myway-telefony/databases/(default)/documents',{method:'DELETE'});assert.equal(clear.ok,true);
  await db.doc('phoneContacts/existing').create({label:'Existing demo',note:'Keep me'});
  const before=await snapshotPhones(db);
  const plan=planImport(input,before);assert.equal(plan.planned.length,2);
  const first=await applyImport(db,input,before,new Date(),new Date('2026-09-24T10:00:00Z'));assert.equal(first.created,2);
  const after=await snapshotPhones(db);assert.equal(after.phoneContacts.length,3);assert.equal(after.phoneCalls.length,0);assert.equal(after.phoneFinancials.length,1);assert.equal(after.phoneImportSources.length,1);assert.equal(after.phoneReports.length,2);
  const summary=after.phoneReports.find(r=>r.data.kind==='month').data.summary;assert.equal(summary.wonWithoutDate,1);assert.equal(summary.revenue,123);
  assert.deepEqual(after.phoneContacts.find(r=>r.id==='existing'),before.phoneContacts[0]);
  await sdk.doc('phoneContacts/history-TEST1').update({note:'Edited by staff after import'});
  const second=await applyImport(db,input,await snapshotPhones(db),new Date());assert.equal(second.created,0);assert.equal(second.alreadyImported,2);
  assert.equal((await db.doc('phoneContacts/history-TEST1').get()).data().note,'Edited by staff after import');
  const bad=structuredClone(input);bad.records[0].contact.phone='different';
  assert.throws(()=>planImport(bad,after),/conflicts/);
  const batch=db.batch();batch.create(db.doc('phoneContacts/existing'),{label:'Overwrite'});batch.create(db.doc('phoneContacts/no-partial'),{label:'New'});await assert.rejects(()=>batch.commit(),/409/);assert.equal((await db.doc('phoneContacts/no-partial').get()).exists,false);
 } finally {await sdk.terminate();}
});
