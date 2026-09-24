import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { savePhoneContactIn } from "../../services/phoneStore.ts";
let env;
const manager = { uid: "manager", email: "mywaymarcin@gmail.com" },
  staff = { uid: "staff", email: "beatakorzonek1@gmail.com" };
const contact = () => ({
  id: "",
  label: "Testowy kontakt",
  phone: "",
  firstDate: "2026-09-24",
  firstTime: "13:00",
  category: "NFZ",
  quality: "C",
  temperature: "Zimny",
  source: "ADSY",
  stage: "Nowy",
  province: "",
  status: "Brak decyzji",
  closedDate: "",
  lossReason: "",
  nextDate: "",
  nextTime: "",
  followupStatus: "",
  note: "",
  followupNote: "",
  owner: "Test",
  revision: 0,
});
const call = () => ({
  id: "",
  contactId: "",
  date: "2026-09-24",
  time: "13:00",
  kind: "Pierwszy kontakt",
  durationSeconds: 300,
  result: "Brak decyzji",
  answered: true,
  fullConversation: true,
  callback: false,
  note: "Syntetyczna rozmowa",
});
const dbFor = (u, verified = true) =>
  env
    .authenticatedContext(u.uid, { email: u.email, email_verified: verified })
    .firestore();
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-myway-telefony",
    firestore: {
      host: "127.0.0.1",
      port: 8185,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());
test("staff zapisuje kontakt i rozmowę atomowo; rewizje chronią przed nadpisaniem", async () => {
  const db = dbFor(staff),
    id = await savePhoneContactIn(db, staff, contact(), call(), undefined);
  const c = { ...(await getDoc(doc(db, "phoneContacts", id))).data(), id };
  assert.equal(c.revision, 1);
  assert.equal((await getDocs(collection(db, "phoneCalls"))).size, 1);
  assert.equal((await getDocs(collection(db, "phoneAudit"))).size, 1);
  await savePhoneContactIn(
    db,
    staff,
    { ...c, note: "Nowa notatka" },
    null,
    undefined,
  );
  await assert.rejects(
    () => savePhoneContactIn(db, staff, c, null, undefined),
    /Ktoś zmienił/,
  );
  assert.equal((await getDocs(collection(db, "phoneAudit"))).size, 2);
});
test("kwoty są zapisywane i czytane tylko przez osoby ze statystykami", async () => {
  const db = dbFor(manager),
    id = await savePhoneContactIn(db, manager, contact(), call(), 600);
  assert.equal(
    (await getDoc(doc(db, "phoneFinancials", id))).data().amount,
    600,
  );
  assert.equal((await getDocs(collection(db, "phoneFinancialAudit"))).size, 1);
  await assertFails(getDoc(doc(dbFor(staff), "phoneFinancials", id)));
  await assertFails(getDocs(collection(dbFor(staff), "phoneFinancialAudit")));
  await assert.rejects(
    () => savePhoneContactIn(dbFor(staff), staff, contact(), call(), 600),
    /brak dostępu/,
  );
});
test("Darek ma dostęp do raportów i kwot, personel nadal bez dostępu", async () => {
  const owner = { uid: "owner", email: "dariusz.szuca@gmail.com" };
  const db = dbFor(owner);
  const id = await savePhoneContactIn(db, owner, contact(), call(), 500);
  assert.equal((await getDoc(doc(db, "phoneFinancials", id))).data().amount, 500);
  await assertSucceeds(getDocs(collection(db, "phoneReports")));
  await assertSucceeds(getDocs(collection(db, "phoneReportState")));
  await assertFails(getDocs(collection(dbFor(staff), "phoneReports")));
});
test("obce konto, brak logowania i niezweryfikowany email nie mają dostępu", async () => {
  for (const db of [
    env.unauthenticatedContext().firestore(),
    dbFor({ uid: "outside", email: "outside@example.invalid" }),
    dbFor(staff, false),
  ]) {
    await assertFails(getDocs(collection(db, "phoneContacts")));
    await assertFails(getDocs(collection(db, "phoneCalls")));
  }
});
test("brak audytu, wstrzyknięta kwota i usunięcie nie przechodzą", async () => {
  const db = dbFor(staff),
    id = await savePhoneContactIn(db, staff, contact(), call(), undefined);
  await assertFails(
    updateDoc(doc(db, "phoneContacts", id), { note: "Bez rewizji" }),
  );
  await assertFails(updateDoc(doc(db, "phoneContacts", id), { amount: 1 }));
  await assertFails(deleteDoc(doc(db, "phoneContacts", id)));
  const logs = await getDocs(collection(db, "phoneCalls"));
  await assertFails(updateDoc(logs.docs[0].ref, { durationSeconds: -1 }));
  await assertFails(deleteDoc(logs.docs[0].ref));
});
test("archiwum dostępne tylko zarządowi, raport automatyczny tylko dla serwera", async () => {
  const db = dbFor(manager);
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "phoneReports", "r"), {
      summary: { attempts: 1 },
    }),
  );
  await assertSucceeds(getDocs(collection(db, "phoneReports")));
  await assertFails(getDocs(collection(dbFor(staff), "phoneReports")));
  await assertFails(
    setDoc(doc(db, "phoneReports", "fake"), {
      kind: "week",
      from: "2026-09-14",
      to: "2026-09-20",
      summary: {},
      filters: {},
      generatedAt: "2026-09-24",
      automatic: true,
      createdBy: manager.uid,
    }),
  );
});

test('harmonogram tworzy raporty w emulatorze i nie duplikuje po ponowieniu',async()=>{
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8185';
 const {createRequire}=await import('node:module');
 const req=createRequire(new URL('../../functions/telephony/package.json',import.meta.url));
 const admin=req('firebase-admin');const app=admin.initializeApp({projectId:'demo-myway-telefony'},'report-integration');
 const {generatePhoneReports}=req('./scheduler.cjs');
 try{
  const db=admin.firestore(app);
  await db.collection('phoneContacts').doc('synthetic').set({...contact(),firstDate:'2026-09-18',note:'PRIVATE_SYNTHETIC_NOTE'});
  const now=new Date('2026-09-24T03:00:00Z');
  await generatePhoneReports(db,now);await generatePhoneReports(db,now);
  const reports=await db.collection('phoneReports').get();assert.equal(reports.size,3);
  const weekly=reports.docs.find(d=>d.data().kind==='week').data();assert.equal(weekly.summary.newContacts,1);
  assert.equal(JSON.stringify(reports.docs.map(d=>d.data())).includes('PRIVATE_SYNTHETIC_NOTE'),false);
  assert.equal((await db.collection('phoneReportState').doc('scheduler').get()).data().status,'ok');
 }finally{await app.delete();}
});
