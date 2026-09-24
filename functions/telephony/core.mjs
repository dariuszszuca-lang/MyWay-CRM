// Shared by the browser and scheduled reports. Dates are Warsaw calendar dates,
// not UTC timestamps; duration is always explicit seconds, never a clock string.
export const SOURCES = [
  "ADSY",
  "Polecenie",
  "Mail",
  "Facebook",
  "Oferteo",
  "Strona WWW",
  "Inne",
];
export const CATEGORIES = [
  "Może sprzedaż",
  "Sprzedaż",
  "NFZ",
  "Terapia indywidualna",
  "Detoks",
  "Poniżej 18 lat",
  "Współuzależnienie",
  "Inna forma terapii",
  "Brak kontaktu",
];
export const STAGES = ["Nowy", "W kontakcie", "Wygrany", "Przegrany"];
export const STATUSES = [
  "Brak decyzji",
  "Follow-up",
  "Rezerwacja",
  "Zadatek",
  "Odpada",
  "Brak kontaktu",
  "Nieaktualne",
];
export const FOLLOWUP_STATUSES = [
  "Do oddzwonienia",
  "Klient oddzwoni",
  "Oddzwoniono",
  "Brak kontaktu",
  "Zakończony",
  "Brak follow-up",
  "Konsultacja w ośrodku",
];
export const RESULTS = [
  "Umówiony krok",
  "Rezerwacja",
  "Zadatek",
  "Brak decyzji",
  "Nieodebrany",
  "Poza ofertą",
  "Rezygnacja",
];
export const KINDS = ["Pierwszy kontakt", "Kolejna rozmowa"];
const VALUABLE = new Set(["Umówiony krok", "Rezerwacja", "Zadatek"]);
export const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const validTime = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function warsawNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
const shift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function periodRange(kind, date) {
  if (!validDate(date)) throw new Error("Nieprawidłowa data.");
  const d = new Date(`${date}T12:00:00Z`),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  if (kind === "day") return { from: date, to: date };
  if (kind === "week") {
    const from = shift(date, -((d.getUTCDay() + 6) % 7));
    return { from, to: shift(from, 6) };
  }
  if (kind === "month")
    return {
      from: `${date.slice(0, 7)}-01`,
      to: new Date(Date.UTC(y, m + 1, 0, 12)).toISOString().slice(0, 10),
    };
  if (kind === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  throw new Error("Nieznany okres.");
}
export function previousPeriods(date) {
  return ["week", "month", "year"].map((kind) => ({
    kind,
    ...periodRange(kind, shift(periodRange(kind, date).from, -1)),
  }));
}
export function validateContact(c) {
  const e = [];
  if (!c.label?.trim() || c.label.length > 120)
    e.push("Podaj nazwę lub ID kontaktu (do 120 znaków).");
  if (!validDate(c.firstDate))
    e.push("Podaj poprawną datę pierwszego kontaktu.");
  if (c.firstTime && !validTime(c.firstTime))
    e.push("Godzina musi mieć format 00:00–23:59.");
  if (c.quality && !["A", "B", "C", "D"].includes(c.quality))
    e.push("Ocena: A, B, C, D lub brak.");
  if (c.stage && !STAGES.includes(c.stage)) e.push("Wybierz etap kontaktu.");
  if (c.closedDate && (!validDate(c.closedDate) || c.closedDate < c.firstDate))
    e.push("Data zamknięcia nie może poprzedzać pierwszego kontaktu.");
  if (c.stage === "Wygrany" && !c.closedDate && !c.historical)
    e.push("Dla wygranej podaj datę zamknięcia.");
  if (c.nextDate && !validDate(c.nextDate))
    e.push("Nieprawidłowy termin kolejnej rozmowy.");
  if (c.nextTime && (!c.nextDate || !validTime(c.nextTime)))
    e.push("Podaj dzień i poprawną godzinę kolejnej rozmowy.");
  for (const k of ["note", "followupNote"])
    if ((c[k] || "").length > 4000)
      e.push("Notatka może mieć najwyżej 4000 znaków.");
  return e;
}
export function validateCall(c) {
  const e = [];
  if (!validDate(c.date) || !validTime(c.time))
    e.push("Podaj poprawną datę i godzinę rozmowy.");
  if (!KINDS.includes(c.kind)) e.push("Wybierz typ rozmowy.");
  if (!RESULTS.includes(c.result)) e.push("Wybierz wynik rozmowy.");
  if (
    c.durationSeconds !== null &&
    (!Number.isInteger(c.durationSeconds) ||
      c.durationSeconds < 0 ||
      c.durationSeconds > 36000)
  )
    e.push("Czas rozmowy: od 0 do 600 minut.");
  if (c.result === "Nieodebrany" && c.answered)
    e.push("Nieodebrany telefon nie może być oznaczony jako odebrany.");
  if (c.fullConversation && !c.answered)
    e.push("Pełna rozmowa wymaga odebranego telefonu.");
  if (c.firstDate && c.date < c.firstDate)
    e.push("Rozmowa nie może poprzedzać pierwszego kontaktu.");
  return e;
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function matchesContact(c, filters = {}) {
  return ["source", "owner", "category", "quality"].every(
    (k) =>
      !filters[k] || (filters[k] === "__empty" ? !c[k] : c[k] === filters[k]),
  );
}
const tally = (list, key) =>
  Object.fromEntries(
    [
      ...list.reduce((m, c) => {
        const k = c[key] || "Brak danych";
        m.set(k, (m.get(k) || 0) + 1);
        return m;
      }, new Map()),
    ].sort((a, b) => b[1] - a[1]),
  );
const percent = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
export function summarize(
  contacts,
  calls,
  financials,
  range,
  filters = {},
  asOf = warsawNow().date,
) {
  if (!validDate(range.from) || !validDate(range.to) || range.from > range.to)
    throw new Error("Nieprawidłowy zakres dat.");
  const within = (d) => validDate(d) && d >= range.from && d <= range.to;
  const cs = contacts.filter((c) => matchesContact(c, filters)),
    ids = new Set(cs.map((c) => c.id));
  const fresh = cs.filter((c) => within(c.firstDate));
  const attempts = calls.filter(
    (c) =>
      ids.has(c.contactId) &&
      within(c.date) &&
      (!filters.kind || c.kind === filters.kind),
  );
  const won = cs.filter((c) => c.stage === "Wygrany" && within(c.closedDate));
  const oldWon = won.filter((c) => c.firstDate < range.from);
  const finance = new Map(financials.map((f) => [f.id, f.amount]));
  const amounts = won.map((c) => finance.get(c.id));
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    attempts: 0,
    valuable: 0,
    seconds: 0,
    missingDurations: 0,
    followups: 0,
    valuableFollowups: 0,
    valuablePerHour: null,
  }));
  const days = Array.from({ length: 7 }, (_, day) => ({
    day,
    attempts: 0,
    valuable: 0,
  }));
  for (const c of attempts) {
    const valuable = VALUABLE.has(c.result),
      timed = Number.isInteger(c.durationSeconds) && c.durationSeconds >= 0;
    const day = (new Date(`${c.date}T12:00:00Z`).getUTCDay() + 6) % 7;
    days[day].attempts++;
    days[day].valuable += Number(valuable);
    if (!validTime(c.time)) continue;
    const h = hours[Number(c.time.slice(0, 2))];
    h.attempts++;
    h.valuable += Number(valuable);
    h.seconds += timed ? c.durationSeconds : 0;
    h.missingDurations += Number(!timed);
    h.followups += Number(c.kind === "Kolejna rozmowa");
    h.valuableFollowups += Number(c.kind === "Kolejna rozmowa" && valuable);
  }
  for (const h of hours)
    h.valuablePerHour =
      h.seconds > 0 && !h.missingDurations
        ? Math.round((h.valuable * 360000) / h.seconds) / 100
        : null;
  const missingDurations = attempts.filter(
    (c) => !Number.isInteger(c.durationSeconds) || c.durationSeconds < 0,
  ).length;
  const historical = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    contacts: 0,
    salesCategory: 0,
  }));
  for (const c of fresh)
    if (validTime(c.firstTime)) {
      const h = historical[Number(c.firstTime.slice(0, 2))];
      h.contacts++;
      h.salesCategory += Number(c.category === "Sprzedaż");
    }
  const followupActive = (c) =>
    c.nextDate &&
    c.stage !== "Wygrany" &&
    c.stage !== "Przegrany" &&
    c.followupStatus !== "Zakończony" &&
    (!c.historical || c.followupConfirmed);
  const summary = {
    newContacts: fresh.length,
    attempts: attempts.length,
    won: won.length,
    wonEarlier: oldWon.length,
    wonNew: won.length - oldWon.length,
    cohortWon: fresh.filter(
      (c) =>
        c.stage === "Wygrany" &&
        validDate(c.closedDate) &&
        c.closedDate <= asOf,
    ).length,
    cohortConversion: percent(
      fresh.filter(
        (c) =>
          c.stage === "Wygrany" &&
          validDate(c.closedDate) &&
          c.closedDate <= asOf,
      ).length,
      fresh.length,
    ),
    revenue:
      amounts.reduce(
        (sum, a) =>
          sum +
          (typeof a === "number" && Number.isFinite(a) && a >= 0
            ? Math.round(a * 100)
            : 0),
        0,
      ) / 100,
    missingAmounts: amounts.filter(
      (a) => typeof a !== "number" || !Number.isFinite(a) || a < 0,
    ).length,
    nfzShare: percent(
      fresh.filter((c) => c.category === "NFZ").length,
      fresh.length,
    ),
    answered: attempts.filter((c) => c.answered).length,
    fullConversations: attempts.filter((c) => c.fullConversation).length,
    callbacks: attempts.filter((c) => c.callback).length,
    followups: attempts.filter((c) => c.kind === "Kolejna rozmowa").length,
    valuable: attempts.filter((c) => VALUABLE.has(c.result)).length,
    durationSeconds: attempts.reduce(
      (s, c) =>
        s +
        (Number.isInteger(c.durationSeconds) && c.durationSeconds >= 0
          ? c.durationSeconds
          : 0),
      0,
    ),
    missingDurations,
    invalidFirstTimes: fresh.filter((c) => !validTime(c.firstTime)).length,
    historicalContacts: fresh.filter((c) => c.historical).length,
    wonWithoutDate: fresh.filter((c) => c.stage === "Wygrany" && !validDate(c.closedDate)).length,
    invalidCallTimes: attempts.filter((c) => !validTime(c.time)).length,
    overdue: cs.filter((c) => followupActive(c) && c.nextDate < asOf).length,
    dueToday: cs.filter((c) => followupActive(c) && c.nextDate === asOf).length,
    qualities: tally(fresh, "quality"),
    categories: tally(fresh, "category"),
    sources: tally(fresh, "source"),
    statuses: tally(fresh, "status"),
    stages: tally(fresh, "stage"),
    temperatures: tally(fresh, "temperature"),
    provinces: tally(fresh, "province"),
    owners: tally(fresh, "owner"),
    lossReasons: tally(
      cs.filter((c) => c.stage === "Przegrany" && within(c.closedDate)),
      "lossReason",
    ),
    results: tally(attempts, "result"),
    hours,
    days,
    historical,
    asOf,
  };
  const insights = [
    `${summary.newContacts} nowych kontaktów i ${summary.attempts} prób telefonu w wybranym okresie.`,
    `${summary.won} wygranych procesów według daty zamknięcia; ${summary.wonEarlier} z kontaktów rozpoczętych wcześniej.`,
  ];
  if (summary.nfzShare !== null)
    insights.push(`Kontakty NFZ: ${summary.nfzShare}% nowych kontaktów.`);
  if (summary.historicalContacts)
    insights.push(`${summary.historicalContacts} kontaktów pochodzi z importu historii. Dawna liczba kontaktów i czas nie są osobnymi wpisami rozmów.`);
  if (summary.wonWithoutDate)
    insights.push(`${summary.wonWithoutDate} historycznych wygranych kontaktów nie ma poprawnej daty zamknięcia. Nie są doliczane do wygranych ani kwot w okresie.`);
  if (missingDurations)
    insights.push(
      `${missingDurations} prób bez czasu rozmowy. Wydajność godzin z brakami nie jest wyliczana.`,
    );
  if (summary.missingAmounts)
    insights.push(
      `${summary.missingAmounts} wygranych bez podanej kwoty. Suma kwot jest niepełna.`,
    );
  const enough = hours.filter((h) => h.attempts >= 20);
  if (enough.length >= 2) {
    const ranked = [...enough].sort(
      (a, b) => b.valuable / b.attempts - a.valuable / a.attempts,
    );
    const best = ranked[0],
      worst = ranked.at(-1);
    if (best.valuable / best.attempts !== worst.valuable / worst.attempts)
      insights.push(
        `Najwyższy udział wartościowych wyników w godzinach z co najmniej 20 próbami: ${best.hour}:00 (${best.valuable}/${best.attempts}); najniższy: ${worst.hour}:00 (${worst.valuable}/${worst.attempts}). To opis próby, nie dowód wpływu godziny.`,
      );
  }
  return { ...summary, insights };
}
