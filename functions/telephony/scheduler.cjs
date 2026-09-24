// No outbound messaging. Only aggregate snapshots in the CRM's own Firestore.
const CORE = import("./core.mjs");
async function all(db, name) {
  const rows = [];
  let cursor = null;
  do {
    let q = db.collection(name).orderBy("__name__").limit(1000);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    rows.push(...page.docs.map((d) => ({ ...d.data(), id: d.id })));
    cursor = page.size === 1000 ? page.docs.at(-1) : null;
  } while (cursor);
  return rows;
}
async function duePeriods(date, lastCheckedDate) {
  const { previousPeriods, validDate } = await CORE;
  // A persistent cursor recovers reports missed during outages without duplicates.
  const map = new Map();
  let cursor = validDate(lastCheckedDate) ? lastCheckedDate : date;
  if (cursor > date) cursor = date;
  while (cursor <= date) {
    for (const p of previousPeriods(cursor)) map.set(`${p.kind}-${p.from}`, p);
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return [...map.values()];
}
async function generatePhoneReports(db, now = new Date()) {
  const { warsawNow, summarize } = await CORE;
  const date = warsawNow(now).date,
    stateRef = db.collection("phoneReportState").doc("scheduler");
  const state = (await stateRef.get()).data() || {};
  const periods = await duePeriods(date, state.lastCheckedDate),
    pending = [];
  for (const p of periods) {
    const id = `auto-${p.kind}-${p.from}`,
      ref = db.collection("phoneReports").doc(id);
    if (!(await ref.get()).exists) pending.push({ ...p, id, ref });
  }
  try {
    if (pending.length) {
      const [contacts, calls, financials] = await Promise.all(
        ["phoneContacts", "phoneCalls", "phoneFinancials"].map((n) =>
          all(db, n),
        ),
      );
      for (const p of pending) {
        const report = {
          kind: p.kind,
          from: p.from,
          to: p.to,
          filters: {},
          summary: summarize(contacts, calls, financials, p, {}, date),
          generatedAt: now.toISOString(),
          automatic: true,
        };
        try {
          await p.ref.create(report);
        } catch (e) {
          if (e.code !== 6 && e.code !== "already-exists") throw e;
        }
      }
    }
    await stateRef.set(
      {
        status: "ok",
        lastCheckedDate: date,
        lastSuccessAt: now.toISOString(),
        errorCode: null,
      },
      { merge: true },
    );
    return { generated: pending.length };
  } catch (e) {
    await stateRef.set(
      {
        status: "error",
        lastAttemptAt: now.toISOString(),
        errorCode: "REPORT_GENERATION_FAILED",
      },
      { merge: true },
    );
    throw e;
  }
}
module.exports = { generatePhoneReports, duePeriods };
