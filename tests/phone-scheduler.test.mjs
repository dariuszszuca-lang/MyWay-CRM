import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { duePeriods, generatePhoneReports } = createRequire(import.meta.url)(
  "../functions/telephony/scheduler.cjs",
);
test("harmonogram odzyskuje tygodnie pominięte podczas awarii", async () => {
  const periods = await duePeriods("2026-02-03", "2026-01-15");
  assert.ok(periods.some((p) => p.kind === "week" && p.from === "2026-01-19"));
  assert.ok(periods.some((p) => p.kind === "week" && p.from === "2026-01-26"));
  assert.ok(periods.some((p) => p.kind === "month" && p.from === "2026-01-01"));
  assert.equal(
    new Set(periods.map((p) => p.kind + p.from)).size,
    periods.length,
  );
});
// Minimal persisted store exercises retry semantics independently of the SDK.
function store() {
  const docs = new Map();
  let reads = 0;
  return {
    docs,
    get reads() {
      return reads;
    },
    collection(name) {
      return {
        doc(id) {
          const key = name + "/" + id;
          return {
            async get() {
              return { exists: docs.has(key), data: () => docs.get(key) };
            },
            async set(v) {
              docs.set(key, { ...docs.get(key), ...v });
            },
            async create(v) {
              if (docs.has(key)) {
                const e = new Error("exists");
                e.code = 6;
                throw e;
              }
              docs.set(key, v);
            },
          };
        },
        orderBy() {
          return {
            limit() {
              return {
                async get() {
                  reads++;
                  const rows = [...docs]
                    .filter(([k]) => k.startsWith(name + "/"))
                    .map(([k, v]) => ({ id: k.split("/")[1], data: () => v }));
                  return { size: rows.length, docs: rows };
                },
              };
            },
          };
        },
      };
    },
  };
}
test("ponowienie nie tworzy duplikatów i nie czyta ponownie wszystkich rozmów", async () => {
  const db = store();
  db.docs.set("phoneContacts/c", {
    firstDate: "2026-09-18",
    firstTime: "12:00",
    source: "ADSY",
    stage: "Nowy",
    note: "PRIVATE NOTE",
    phone: "PRIVATE PHONE",
  });
  await generatePhoneReports(db, new Date("2026-09-24T03:00:00Z"));
  const reports = [...db.docs].filter(([k]) => k.startsWith("phoneReports/"));
  assert.equal(reports.length, 3);
  assert.equal(db.reads, 3);
  assert.ok(!JSON.stringify(reports).includes("PRIVATE"));
  await generatePhoneReports(db, new Date("2026-09-24T04:00:00Z"));
  assert.equal(
    [...db.docs].filter(([k]) => k.startsWith("phoneReports/")).length,
    3,
  );
  assert.equal(db.reads, 3);
  assert.equal(db.docs.get("phoneReportState/scheduler").status, "ok");
});
