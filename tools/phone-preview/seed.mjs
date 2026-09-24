import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import {
  warsawNow,
  periodRange,
  summarize,
} from "../../functions/telephony/core.mjs";
const project = "demo-myway-telefony";
for (const [uid, email] of [
  ["manager", "mywaymarcin@gmail.com"],
  ["staff", "beatakorzonek1@gmail.com"],
]) {
  const root = "http://127.0.0.1:9195/identitytoolkit.googleapis.com/v1";
  const r = await fetch(`${root}/accounts:signUp?key=demo-test-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "local-preview-only",
      returnSecureToken: true,
    }),
  });
  let account = await r.json();
  if (!r.ok && account.error?.message !== "EMAIL_EXISTS")
    throw new Error("Local user setup failed");
  if (account.error?.message === "EMAIL_EXISTS") {
    const login = await fetch(
      `${root}/accounts:signInWithPassword?key=demo-test-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "local-preview-only",
          returnSecureToken: true,
        }),
      },
    );
    account = await login.json();
    if (!login.ok) throw new Error("Local preview login failed");
  }
  const update = await fetch(`${root}/projects/${project}/accounts:update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({
      localId: account.localId || uid,
      email,
      emailVerified: true,
      displayName: "Podgląd lokalny",
    }),
  });
  if (!update.ok)
    throw new Error("Local email verification failed: " + update.status);
}
const env = await initializeTestEnvironment({
  projectId: project,
  firestore: {
    host: "127.0.0.1",
    port: 8185,
    rules: fs.readFileSync("firestore.rules", "utf8"),
  },
});
await env.clearFirestore();
const now = warsawNow();
const dates = [now.date, now.date, now.date];
const common = {
  phone: "",
  firstDate: now.date,
  firstTime: "09:00",
  category: "Może sprzedaż",
  quality: "B",
  temperature: "Ciepły",
  source: "ADSY",
  stage: "W kontakcie",
  province: "Pomorskie",
  status: "Follow-up",
  closedDate: "",
  lossReason: "",
  nextDate: now.date,
  nextTime: "15:00",
  followupStatus: "Do oddzwonienia",
  note: "Dane demonstracyjne",
  followupNote: "Omówienie terminu",
  owner: "Podgląd lokalny",
  revision: 1,
  createdBy: "demo",
  updatedBy: "demo",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const contacts = [
  { ...common, id: "demo1", label: "Kontakt demonstracyjny 1" },
  {
    ...common,
    id: "demo2",
    label: "Kontakt demonstracyjny 2",
    quality: "A",
    stage: "Wygrany",
    status: "Zadatek",
    closedDate: now.date,
    nextDate: "",
    nextTime: "",
    category: "Sprzedaż",
  },
  {
    ...common,
    id: "demo3",
    label: "Kontakt demonstracyjny 3",
    category: "NFZ",
    quality: "D",
    stage: "Przegrany",
    status: "Odpada",
    closedDate: now.date,
    lossReason: "Poza ofertą",
    nextDate: "",
    nextTime: "",
  },
];
const calls = contacts.map((c, i) => ({
  id: `call${i}`,
  contactId: c.id,
  date: now.date,
  time: `${String(9 + i).padStart(2, "0")}:15`,
  kind: "Pierwszy kontakt",
  durationSeconds: 300 + i * 180,
  result: ["Umówiony krok", "Zadatek", "Poza ofertą"][i],
  answered: true,
  fullConversation: true,
  callback: false,
  note: "Przykładowa rozmowa do kontroli interfejsu.",
  createdBy: "demo",
  createdAt: new Date(),
}));
const finances = [{ id: "demo2", amount: 1000 }];
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [name, list] of [
    ["phoneContacts", contacts],
    ["phoneCalls", calls],
    ["phoneFinancials", finances],
  ])
    for (const row of list) {
      const { id, ...data } = row;
      await setDoc(doc(db, name, id), data);
    }
  const range = periodRange("month", now.date);
  await setDoc(doc(db, "phoneReports", "preview"), {
    kind: "month",
    ...range,
    summary: summarize(contacts, calls, finances, range),
    filters: {},
    generatedAt: new Date().toISOString(),
    automatic: false,
  });
});
await env.cleanup();
console.log("Local synthetic preview: 3 contacts, 3 calls, 1 report.");
