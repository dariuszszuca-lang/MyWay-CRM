import test from "node:test";
import assert from "node:assert/strict";
import {
  periodRange,
  previousPeriods,
  warsawNow,
  summarize,
  validateContact,
  validateCall,
  csvCell,
} from "../functions/telephony/core.mjs";

test("tydzień od poniedziałku przechodzi przez rok; luty przestępny", () => {
  assert.deepEqual(periodRange("week", "2026-01-01"), {
    from: "2025-12-29",
    to: "2026-01-04",
  });
  assert.deepEqual(periodRange("month", "2024-02-14"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(periodRange("year", "2026-09-24"), {
    from: "2026-01-01",
    to: "2026-12-31",
  });
  assert.throws(() => periodRange("day", "2026-02-31"));
});
test("raporty zamkniętych okresów i strefa PL przy zmianie czasu", () => {
  assert.deepEqual(
    previousPeriods("2026-01-01").map((x) => [x.kind, x.from, x.to]),
    [
      ["week", "2025-12-22", "2025-12-28"],
      ["month", "2025-12-01", "2025-12-31"],
      ["year", "2025-01-01", "2025-12-31"],
    ],
  );
  assert.equal(warsawNow(new Date("2026-03-29T01:30:00Z")).time, "03:30");
  assert.equal(warsawNow(new Date("2026-09-23T22:30:00Z")).date, "2026-09-24");
});
const contacts = [
  {
    id: "old",
    firstDate: "2026-08-01",
    firstTime: "12:00",
    category: "Może sprzedaż",
    quality: "A",
    source: "ADSY",
    stage: "Wygrany",
    closedDate: "2026-09-24",
  },
  {
    id: "new",
    firstDate: "2026-09-24",
    firstTime: "13:00",
    category: "NFZ",
    quality: "",
    source: "ADSY",
    stage: "Nowy",
    nextDate: "2026-09-25",
  },
  {
    id: "sale",
    firstDate: "2026-09-24",
    firstTime: "24:13",
    category: "Sprzedaż",
    quality: "B",
    source: "Polecenie",
    stage: "Wygrany",
    closedDate: "2026-09-24",
  },
];
const calls = [
  {
    id: "1",
    contactId: "new",
    date: "2026-09-24",
    time: "13:00",
    kind: "Pierwszy kontakt",
    durationSeconds: 600,
    result: "Umówiony krok",
    answered: true,
    fullConversation: true,
  },
  {
    id: "2",
    contactId: "old",
    date: "2026-09-24",
    time: "13:15",
    kind: "Kolejna rozmowa",
    durationSeconds: 1200,
    result: "Zadatek",
    answered: true,
  },
  {
    id: "3",
    contactId: "new",
    date: "2026-09-24",
    time: "13:45",
    kind: "Kolejna rozmowa",
    durationSeconds: 300,
    result: "Brak decyzji",
    answered: true,
  },
  {
    id: "4",
    contactId: "new",
    date: "2026-09-25",
    time: "12:00",
    kind: "Kolejna rozmowa",
    durationSeconds: null,
    result: "Nieodebrany",
    answered: false,
  },
];
test("kontakty, próby i wcześniejsze wygrane nie dublują się", () => {
  const s = summarize(
    contacts,
    calls,
    [{ id: "old", amount: 500 }],
    { from: "2026-09-24", to: "2026-09-24" },
    {},
    "2026-09-24",
  );
  assert.equal(s.newContacts, 2);
  assert.equal(s.attempts, 3);
  assert.equal(s.won, 2);
  assert.equal(s.wonEarlier, 1);
  assert.equal(s.wonNew, 1);
  assert.equal(s.revenue, 500);
  assert.equal(s.missingAmounts, 1);
  assert.equal(s.cohortConversion, 50);
  assert.equal(s.nfzShare, 50);
  assert.equal(s.hours[13].attempts, 3);
  assert.equal(s.hours[13].valuable, 2);
  assert.equal(s.hours[13].seconds, 2100);
  assert.equal(s.hours[13].followups, 2);
  assert.equal(s.hours[13].valuableFollowups, 1);
  assert.equal(s.invalidFirstTimes, 1);
  assert.equal(s.durationSeconds, 2100);
});
test("filtry źródła dotyczą kontaktów i przypisanych rozmów", () => {
  const s = summarize(
    contacts,
    calls,
    [],
    { from: "2026-09-24", to: "2026-09-24" },
    { source: "Polecenie" },
    "2026-09-24",
  );
  assert.equal(s.newContacts, 1);
  assert.equal(s.attempts, 0);
  assert.equal(s.wonEarlier, 0);
});
test("brak minut i pusty mianownik nie udają zera lub skuteczności", () => {
  const s = summarize(
    contacts,
    calls,
    [],
    { from: "2026-09-25", to: "2026-09-25" },
    {},
    "2026-09-25",
  );
  assert.equal(s.missingDurations, 1);
  assert.equal(s.cohortConversion, null);
  assert.equal(s.hours[12].valuablePerHour, null);
});
test("walidacja dat, czasu, kwot, spójności i danych wymaganych", () => {
  assert.ok(
    validateContact({ firstDate: "2026-02-31", firstTime: "24:00", label: "" })
      .length,
  );
  assert.ok(
    validateCall({
      date: "2026-09-24",
      time: "13:00",
      kind: "Kolejna rozmowa",
      result: "Nieodebrany",
      durationSeconds: -1,
      answered: true,
    }).length,
  );
  assert.deepEqual(
    validateCall({
      date: "2026-09-24",
      time: "13:00",
      kind: "Pierwszy kontakt",
      result: "Brak decyzji",
      durationSeconds: null,
      answered: true,
      fullConversation: false,
    }),
    [],
  );
});
test("CSV zabezpiecza formuły i zachowuje cytaty", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('\t=HYPERLINK("x")'), '"\'\t=HYPERLINK(""x"")"');
});
