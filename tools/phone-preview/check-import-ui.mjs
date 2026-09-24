import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { firestoreImportRest } from '../firestore-import-rest.mjs';
const db=firestoreImportRest({project:'demo-myway-telefony',host:'http://127.0.0.1:8185',token:'owner'});
const baseline=(await db.doc('phoneContacts/demo1').get()).data();
if(!(await db.doc('phoneContacts/history-DEMO').get()).exists)await db.doc('phoneContacts/history-DEMO').create({...baseline,label:'Historia demonstracyjna',historical:true,firstDate:'2026-04-01',stage:'Wygrany',closedDate:'',historicalDuration:'04:15',historicalFollowupAt:'28.05.2026 13:00',historicalFirstTime:'24:13',firstTime:'',historicalExtraNotes:'Syntetyczne uzupełnienie z arkusza',revision:1});
if(!(await db.doc('phoneImportSources/demo-source').get()).exists)await db.doc('phoneImportSources/demo-source').create({title:'Demonstracyjny raport źródłowy',description:'Wyłącznie dane testowe',format:'table',content:'[["Dzień","Kontakty"],["2026-04-01",1]]'});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>['localhost','127.0.0.1','cdn.tailwindcss.com'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 await page.goto('http://127.0.0.1:3107/tools/phone-preview.html');
 await page.getByRole('button',{name:'Telefony',exact:true}).click();
 await page.getByRole('button',{name:'Pokaż analizę importu'}).click();
 await page.getByText(/historycznych wygranych kontaktów nie ma poprawnej daty/).waitFor();
 await page.getByRole('tab',{name:'Kontakty',exact:true}).click();
 await page.getByRole('row').filter({hasText:'Historia demonstracyjna'}).getByRole('button',{name:'Szczegóły / edytuj'}).click();
 await page.getByText(/Syntetyczne uzupełnienie/).waitFor();
 await page.getByLabel('Notatka o kontakcie').fill('Historia pozostaje edytowalna');
 await page.getByRole('button',{name:'Zapisz kontakt',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Kontakt zaktualizowany'}).waitFor();
 await page.getByRole('tab',{name:'Raporty',exact:true}).click();
 await page.getByText('Materiały źródłowe importu (1)').click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Pobierz CSV',exact:true}).click();
 assert.equal((await download).suggestedFilename(),'demo-source.csv');
 assert.equal(errors.length,0);
 console.log('Import UI PASS: history range, missing date, edit, source CSV download, no JS errors');
}finally{await browser.close();}
