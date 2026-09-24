import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { validateContact, summarize } from '../functions/telephony/core.mjs';
test('legacy dates retain calendar date from date-time values without guessing invalid dates',()=>{
 const out=execFileSync('python3',['-c',`import importlib.util,json
s=importlib.util.spec_from_file_location('p','tools/preview-phone-import.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
print(json.dumps([m.date(v) for v in ['28.05.2026 13:00','1.06.2026 00:00','12-06.2026','31.02.2026','13.06']]))`],{encoding:'utf8'});
 assert.deepEqual(JSON.parse(out),['2026-05-28','2026-06-01','2026-06-12','','']);
});
test('unknown legacy closing date is editable but never assigned to a reporting period',()=>{
 const c={id:'x',label:'Sample',firstDate:'2026-04-01',firstTime:'',stage:'Wygrany',closedDate:'',historical:true};
 assert.deepEqual(validateContact(c),[]);
 assert.ok(validateContact({...c,historical:false}).length);
 const s=summarize([c],[],[{id:'x',amount:100}],{from:'2026-01-01',to:'2026-12-31'},{},'2026-09-24');
 assert.equal(s.won,0);assert.equal(s.wonWithoutDate,1);assert.equal(s.revenue,0);
});
