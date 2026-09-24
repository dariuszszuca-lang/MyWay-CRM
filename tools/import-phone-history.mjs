#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { firestoreImportRest } from './firestore-import-rest.mjs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { snapshotPhones, planImport, applyImport } from './phone-import-core.mjs';
const args=process.argv.slice(2),inputPath=args.find(a=>!a.startsWith('--'));
if(!inputPath)throw Error('Usage: node tools/import-phone-history.mjs PRIVATE_PAYLOAD.json [--apply]');
if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('Production script refuses emulator environment');
const input=JSON.parse(readFileSync(inputPath,'utf8'));
if(input.summary.records!==725||input.summary.sourceAttachments!==7)throw Error('Unexpected import scope');
const db=firestoreImportRest({project:'myway-crm-a4593',token:execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim()});
try {
 const before=await snapshotPhones(db),plan=planImport(input,before);
 console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'plan',runId:plan.runId,toCreate:plan.planned.length,alreadyImported:plan.skipped.length,existingContacts:before.phoneContacts.length,archiveSources:input.sources.length,warnings:input.summary.warnings}));
 if(args.includes('--apply')) {
  const dir=join(homedir(),'.local/state/myway-crm/phone-imports',plan.runId);mkdirSync(dir,{recursive:true,mode:0o700});
  const stamp=new Date().toISOString().replaceAll(':','-');
  writeFileSync(join(dir,stamp+'-before.json'),JSON.stringify(before),{mode:0o600,flag:'wx'});
  writeFileSync(join(dir,stamp+'-input.json'),JSON.stringify(input),{mode:0o600,flag:'wx'});
  const result=await applyImport(db,input,before,new Date());
  const after=await snapshotPhones(db);
  const hash=d=>createHash('sha256').update(JSON.stringify(d)).digest('hex');
  // Existing documents must remain byte-for-byte equivalent, including revisions.
  for(const [name,docs] of Object.entries(before)) {
   const map=new Map(after[name].map(d=>[d.id,d.data]));
   for(const doc of docs)if(hash(doc.data)!==hash(map.get(doc.id)))throw Error('Pre-existing document changed: '+name);
  }
  const verification=planImport(input,after);
  if(verification.planned.length||verification.skipped.length!==725)throw Error('Incomplete import');
  const receipt={...result,verified:725,counts:Object.fromEntries(Object.entries(after).map(([k,v])=>[k,v.length]))};
  writeFileSync(join(dir,stamp+'-receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify(receipt));
 }
} finally {await db.terminate();}
