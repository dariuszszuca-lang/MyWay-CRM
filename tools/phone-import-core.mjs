import { createHash } from 'node:crypto';
import { validateContact, summarize, warsawNow } from '../functions/telephony/core.mjs';
const digest = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const normalize = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const COLLECTIONS = ['phoneContacts','phoneCalls','phoneFinancials','phoneAudit','phoneFinancialAudit','phoneReports','phoneImportSources','phoneImportRuns'];
export async function snapshotPhones(db) {
  const result = {};
  for (const name of COLLECTIONS) {
    const docs=[];let cursor;
    do {
      let q=db.collection(name).orderBy('__name__').limit(1000);
      if(cursor)q=q.startAfter(cursor);
      const page=await q.get();docs.push(...page.docs.map(d=>({id:d.id,data:d.data()})));cursor=page.size===1000?page.docs.at(-1):null;
    } while(cursor);
    result[name]=docs;
  }
  return result;
}
export function planImport(input, before) {
  if (!/^[a-f0-9]{64}$/.test(input.summary.sha256)) throw Error('Invalid source fingerprint');
  const runId='marcin-'+input.summary.sha256.slice(0,16);
  const existing=new Map(before.phoneContacts.map(d=>[d.id,d.data]));
  const audits=new Map(before.phoneAudit.map(d=>[d.id,d.data]));
  const labels=new Map(before.phoneContacts.map(d=>[normalize(d.data.label),d.id]));
  const planned=[];const skipped=[];const seen=new Set();
  for(const r of input.records) {
    const c=r.contact;
    if(!/^history-[A-Za-z0-9_-]+$/.test(c.id) || !c.historical || !c.label || seen.has(normalize(c.label))) throw Error('Invalid or duplicate source ID');
    seen.add(normalize(c.label));
    const errors=validateContact(c);
    for(const [key,value] of Object.entries(c)) {
      if(typeof value==='string' && value.length > (['note','followupNote','historicalExtraNotes'].includes(key)?4000:120)) errors.push('Field too long: '+key);
    }
    if(errors.length) throw Error('Invalid source row '+r.sourceRow+': '+errors.join('; '));
    if(r.financial.amount!==null && (!Number.isFinite(r.financial.amount)||r.financial.amount<0||r.financial.amount>10000000)) throw Error('Invalid amount');
    const sourceDigest=digest(r);
    if(existing.has(c.id)) {
      if(audits.get(c.id+'_1')?.sourceDigest!==sourceDigest) throw Error('Existing record conflicts with import: '+c.id);
      skipped.push(c.id);continue;
    }
    if(labels.has(normalize(c.label))) throw Error('Source ID already exists under another document ID');
    planned.push({...r,sourceDigest});
  }
  if(seen.size!==input.summary.records)throw Error('Manifest count mismatch');
  for(const s of input.sources||[]) {
    if(!/^[a-z0-9-]+$/.test(s.key)||Buffer.byteLength(s.content)>800000)throw Error('Invalid archive');
    if(s.format==='table'&&!Array.isArray(JSON.parse(s.content)))throw Error('Invalid table archive');
  }
  return {runId,planned,skipped,total:input.records.length};
}
export async function applyImport(db,input,before,timestamp,now=new Date()) {
  const plan=planImport(input,before),actor='import:'+plan.runId;
  // Each contact, audit and optional financial pair commits together, create-only.
  for(let i=0;i<plan.planned.length;i+=50) {
    const batch=db.batch();
    for(const r of plan.planned.slice(i,i+50)) {
      const {id,...fields}=r.contact;const c={...fields,revision:1};
      batch.create(db.doc('phoneContacts/'+id),{...c,createdBy:actor,updatedBy:actor,createdAt:timestamp,updatedAt:timestamp});
      batch.create(db.doc('phoneAudit/'+id+'_1'),{contactId:id,revision:1,action:'Import historii',before:null,after:c,createdBy:actor,createdAt:timestamp,sourceDigest:r.sourceDigest,importId:plan.runId,sourceRow:r.sourceRow});
      if(r.financial.amount!==null) {
        batch.create(db.doc('phoneFinancials/'+id),{amount:r.financial.amount,updatedBy:actor,updatedAt:timestamp});
        batch.create(db.doc('phoneFinancialAudit/'+id+'_1'),{contactId:id,revision:1,before:null,after:r.financial.amount,createdBy:actor,createdAt:timestamp});
      }
    }
    await batch.commit();
  }
  for(const source of input.sources||[]) {
    const ref=db.doc('phoneImportSources/'+plan.runId+'-'+source.key),old=await ref.get();
    const hash=digest(source);
    if(old.exists){if(old.data().sourceDigest!==hash)throw Error('Archive conflict');continue;}
    await ref.create({...source,sourceDigest:hash,importId:plan.runId,createdAt:timestamp});
  }
  const after=await snapshotPhones(db);
  const contacts=after.phoneContacts.map(d=>({...d.data,id:d.id}));
  const calls=after.phoneCalls.map(d=>({...d.data,id:d.id}));
  const finances=after.phoneFinancials.map(d=>({...d.data,id:d.id}));
  const months=[...new Set(input.records.map(r=>r.contact.firstDate.slice(0,7)))].sort();
  const ranges=months.map(m=>({kind:'month',from:m+'-01',to:new Date(Date.UTC(+m.slice(0,4),+m.slice(5),0)).toISOString().slice(0,10)}));
  ranges.push({kind:'custom',from:input.summary.firstDate,to:input.summary.lastDate});
  for(const range of ranges) {
    const ref=db.doc('phoneReports/'+plan.runId+'-'+range.kind+'-'+range.from);
    if((await ref.get()).exists)continue;
    await ref.create({...range,summary:summarize(contacts,calls,finances,range,{},warsawNow(now).date),filters:{},generatedAt:now.toISOString(),automatic:false,createdBy:actor,createdAt:timestamp});
  }
  const run=db.doc('phoneImportRuns/'+plan.runId);
  if(!(await run.get()).exists)await run.create({status:'complete',sourceHash:input.summary.sha256,summary:input.summary,manifest:input.manifest||[],importedIds:input.records.map(r=>r.contact.id),createdAt:timestamp,createdBy:actor});
  return {runId:plan.runId,created:plan.planned.length,alreadyImported:plan.skipped.length};
}
