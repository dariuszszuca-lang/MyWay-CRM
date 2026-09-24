import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Phone,
  Search,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  PhoneContact,
  PhoneCall,
  PhoneFinancial,
  PhoneReport,
  PhoneFilters,
  watchPhoneCollection,
  savePhoneContact,
  savePhoneReport,
  warsawNow,
  periodRange,
  validDate,
  summarize,
  matchesContact,
  SOURCES,
  CATEGORIES,
} from "../services/telephony";
import PhoneForm, {
  newContact,
  inputClass,
  Field,
  Select,
} from "./telephony/PhoneForm";
import PhoneAnalysis from "./telephony/PhoneAnalysis";
import { PhoneCallList, PhoneContactList } from "./telephony/PhoneLists";
import { exportPhoneCsv, exportPhonePdf } from "../services/telephonyExport";

type Tab = "Dziennik" | "Kontakty" | "Analiza" | "Raporty";
export interface PhoneData {
  contacts: PhoneContact[];
  calls: PhoneCall[];
  financials: PhoneFinancial[];
  reports: PhoneReport[];
  reportState?: { status: string; lastSuccessAt?: string }[];
}
// Data injection also supports local UI verification without connecting to patient data.
export function TelefonyView({
  data,
  canStats,
  owner,
  onSave,
  onReport,
}: {
  data: PhoneData;
  canStats: boolean;
  owner: string;
  onSave: typeof savePhoneContact;
  onReport: typeof savePhoneReport;
}) {
  const today = warsawNow().date;
  const [tab, setTab] = useState<Tab>("Dziennik"),
    [form, setForm] = useState<{ contact: PhoneContact; call: boolean } | null>(
      null,
    );
  const [search, setSearch] = useState(""),
    [followupOnly, setFollowupOnly] = useState(false),
    [filters, setFilters] = useState<PhoneFilters>({});
  const [period, setPeriod] = useState("month"),
    [anchor, setAnchor] = useState(today),
    [custom, setCustom] = useState({ from: today, to: today });
  const [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedReport, setSelectedReport] = useState<PhoneReport | null>(null);
  const range = useMemo(() => {
    try {
      return period === "custom" ? custom : periodRange(period, anchor);
    } catch {
      return { from: "", to: "" };
    }
  }, [period, anchor, custom]);
  const rangeValid =
    validDate(range.from) && validDate(range.to) && range.from <= range.to;
  const summary = useMemo(() => {
    try {
      return summarize(
        data.contacts,
        data.calls,
        data.financials,
        range,
        filters,
        today,
      );
    } catch {
      return null;
    }
  }, [data, range, filters, today]);
  const contactMap = useMemo(
    () => new Map(data.contacts.map((c) => [c.id, c])),
    [data.contacts],
  );
  const amounts = useMemo(
    () => new Map(data.financials.map((c) => [c.id, c.amount])),
    [data.financials],
  );
  const filteredContacts = data.contacts.filter(
    (c) =>
      matchesContact(c, filters) &&
      (!search ||
        `${c.label} ${c.phone}`.toLowerCase().includes(search.toLowerCase())) &&
      (!followupOnly ||
        (c.nextDate &&
          c.nextDate <= today &&
          c.stage !== "Wygrany" &&
          c.stage !== "Przegrany" &&
          c.followupStatus !== "Zakończony" &&
          (!c.historical || c.followupConfirmed))),
  );
  const contactIds = new Set(filteredContacts.map((c) => c.id));
  const calls = data.calls
    .filter(
      (c) =>
        contactIds.has(c.contactId) &&
        c.date >= range.from &&
        c.date <= range.to &&
        (!filters.kind || c.kind === filters.kind),
    )
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const contacts = filteredContacts.sort((a, b) =>
    `${b.firstDate} ${b.firstTime}`.localeCompare(
      `${a.firstDate} ${a.firstTime}`,
    ),
  );
  const callCounts = useMemo(
    () =>
      data.calls.reduce(
        (m, c) => m.set(c.contactId, (m.get(c.contactId) || 0) + 1),
        new Map<string, number>(),
      ),
    [data.calls],
  );
  const pages = Math.max(
    1,
    Math.ceil((tab === "Kontakty" ? contacts.length : calls.length) / 30),
  );
  useEffect(
    () => setPage(1),
    [search, filters, followupOnly, period, anchor, custom, tab],
  );
  useEffect(() => setPage((p) => Math.min(p, pages)), [pages]);
  const updateFilter = (key: keyof PhoneFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setSelectedReport(null);
  };
  const report = () => ({
    kind: period,
    from: range.from,
    to: range.to,
    filters: { ...filters },
    summary,
    generatedAt: new Date().toISOString(),
    automatic: false,
  });
  const actionRunning = useRef(false);
  async function action(fn: () => Promise<void>, success = "") {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operacja nie powiodła się.");
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Telefony</h2>
          <p className="text-sm text-gray-500 mt-1">
            Rozmowy, kolejne kontakty i wyniki w jednym miejscu.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ contact: newContact(owner), call: true });
            setNotice("");
          }}
          className="flex items-center gap-2 bg-teal-700 text-white hover:bg-teal-800 px-4 py-3 rounded-lg font-semibold text-sm"
        >
          <Plus size={18} />
          Nowy kontakt
        </button>
      </div>
      <div
        className="flex flex-wrap gap-1 border-b border-gray-200"
        role="tablist"
        aria-label="Telefony"
      >
        {(
          [
            "Dziennik",
            "Kontakty",
            ...(canStats ? ["Analiza", "Raporty"] : []),
          ] as Tab[]
        ).map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            key={t}
            onClick={() => {
              setTab(t);
              setSelectedReport(null);
            }}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${t === tab ? "border-teal-700 text-teal-800" : "border-transparent text-gray-600 hover:bg-gray-100"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="p-4 rounded-lg bg-red-50 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="p-3 rounded-lg bg-teal-50 text-teal-900 text-sm"
        >
          {notice}
        </p>
      )}
      {form && (
        <PhoneForm
          key={`${form.contact.id}-${form.call}`}
          initial={form.contact}
          initialAmount={amounts.get(form.contact.id) ?? null}
          canFinance={canStats}
          recordCall={form.call}
          onClose={() => setForm(null)}
          onSave={async (c, call, amount) => {
            await onSave(c, call, amount);
            setNotice(call ? "Rozmowa zapisana." : "Kontakt zaktualizowany.");
          }}
        />
      )}
      <section
        className="bg-white border border-gray-200 rounded-xl p-4 space-y-4"
        aria-label="Filtry telefonów"
      >
        {tab !== "Kontakty" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Okres">
              <select
                className={inputClass}
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setSelectedReport(null);
                }}
              >
                {[
                  ["day", "Dzień"],
                  ["week", "Tydzień"],
                  ["month", "Miesiąc"],
                  ["year", "Rok"],
                  ["custom", "Własny zakres"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {period !== "custom" ? (
              <Field label="Data w wybranym okresie">
                <input
                  type="date"
                  className={inputClass}
                  value={anchor}
                  onChange={(e) => {
                    setAnchor(e.target.value);
                    setSelectedReport(null);
                  }}
                />
              </Field>
            ) : (
              <>
                <Field label="Od">
                  <input
                    type="date"
                    className={inputClass}
                    value={custom.from}
                    onChange={(e) =>
                      setCustom({ ...custom, from: e.target.value })
                    }
                  />
                </Field>
                <Field label="Do">
                  <input
                    type="date"
                    className={inputClass}
                    value={custom.to}
                    onChange={(e) =>
                      setCustom({ ...custom, to: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
            <p className="text-sm text-gray-500 self-end py-3">
              {range.from} – {range.to}
            </p>
          </div>
        )}
        {(tab === "Dziennik" || tab === "Kontakty") && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="relative w-full sm:flex-1 min-w-0">
              <span className="sr-only">Szukaj kontaktu</span>
              <Search
                size={17}
                className="absolute left-3 top-4 text-gray-400"
              />
              <input
                className={`${inputClass} pl-9 mt-0`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj po nazwie, ID lub telefonie"
              />
            </label>
            <label className="flex items-center gap-2 text-sm py-3">
              <input
                type="checkbox"
                checked={followupOnly}
                onChange={(e) => setFollowupOnly(e.target.checked)}
              />
              Do kontaktu dziś i zaległe
            </label>
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-teal-800 py-1">
            Filtry szczegółowe{" "}
            {Object.values(filters).filter(Boolean).length > 0 &&
              `(${Object.values(filters).filter(Boolean).length})`}
          </summary>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            <Select
              label="Źródło"
              value={filters.source || ""}
              onChange={(v) => updateFilter("source", v)}
              options={[
                ...SOURCES,
                ...data.contacts.map((c) => c.source).filter(Boolean),
              ]}
              empty="Wszystkie"
            />
            <Select
              label="Kategoria"
              value={filters.category || ""}
              onChange={(v) => updateFilter("category", v)}
              options={[
                ...CATEGORIES,
                ...data.contacts.map((c) => c.category).filter(Boolean),
              ]}
              empty="Wszystkie"
            />
            <Select
              label="Opiekun"
              value={filters.owner || ""}
              onChange={(v) => updateFilter("owner", v)}
              options={data.contacts.map((c) => c.owner).filter(Boolean)}
              empty="Wszyscy"
            />
            <Field label="Ocena">
              <select
                className={inputClass}
                value={filters.quality || ""}
                onChange={(e) => updateFilter("quality", e.target.value)}
              >
                <option value="">Wszystkie</option>
                {["A", "B", "C", "D"].map((q) => (
                  <option key={q}>{q}</option>
                ))}
                <option value="__empty">Brak oceny</option>
              </select>
            </Field>
            <Select
              label="Typ rozmowy"
              value={filters.kind || ""}
              onChange={(v) => updateFilter("kind", v)}
              options={["Pierwszy kontakt", "Kolejna rozmowa"]}
              empty="Wszystkie"
            />
          </div>
          <button
            className="text-sm underline text-gray-600 mt-3 py-2"
            onClick={() => setFilters({})}
          >
            Wyczyść filtry
          </button>
        </details>
      </section>
      {!rangeValid && (
        <p role="alert" className="text-red-700">
          Podaj poprawny zakres dat.
        </p>
      )}
      {tab === "Dziennik" && (
        <PhoneCallList
          calls={calls}
          contacts={contactMap}
          page={page}
          onCall={(c) => setForm({ contact: c, call: true })}
          onExport={() => exportPhoneCsv(filteredContacts, calls)}
        />
      )}
      {tab === "Kontakty" && (
        <PhoneContactList
          contacts={contacts}
          counts={callCounts}
          page={page}
          today={today}
          onCall={(c) => setForm({ contact: c, call: true })}
          onEdit={(c) => setForm({ contact: c, call: false })}
          onHistory={(c) => {
            setSearch(c.label);
            setTab("Dziennik");
            setPeriod("custom");
            setCustom({ from: c.firstDate, to: today });
          }}
        />
      )}
      {(tab === "Dziennik" || tab === "Kontakty") && pages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-3 border rounded-lg disabled:opacity-40"
          >
            Poprzednia
          </button>
          <span>
            Strona {page} z {pages}
          </span>
          <button
            disabled={page === pages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-3 border rounded-lg disabled:opacity-40"
          >
            Następna
          </button>
        </div>
      )}
      {tab === "Analiza" && canStats && summary && (
        <PhoneAnalysis summary={summary} />
      )}
      {tab === "Raporty" && canStats && summary && (
        <div className="space-y-5">
          <section className="bg-white border rounded-xl p-5">
            <h3 className="font-semibold">Raport za wybrany okres</h3>
            <p className="text-sm text-gray-500 mt-2">
              Wybierz zakres i filtry powyżej. PDF pobierzesz od razu; zapis w
              archiwum zachowa dzisiejszy stan obliczeń.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                disabled={busy || !rangeValid}
                onClick={() => action(() => exportPhonePdf(report()))}
                className="flex items-center gap-2 px-4 py-3 bg-teal-700 text-white rounded-lg disabled:opacity-40"
              >
                <Download size={16} />
                Pobierz PDF
              </button>
              <button
                disabled={busy || !rangeValid}
                onClick={() =>
                  action(
                    () => onReport(report()),
                    "Raport zapisany w archiwum.",
                  )
                }
                className="px-4 py-3 border rounded-lg text-sm disabled:opacity-40"
              >
                {busy ? "Przetwarzanie…" : "Zapisz raport w archiwum"}
              </button>
            </div>
          </section>
          <section className="bg-white border rounded-xl p-5">
            <h3 className="font-semibold">Archiwum raportów</h3>
            <p className="text-sm text-gray-500 mt-2">
              Raporty automatyczne za zakończone tygodnie, miesiące i lata oraz
              raporty zapisane na żądanie.
            </p>
            {data.reportState?.[0]?.status === "error" && (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                Ostatni raport automatyczny nie powstał. Możesz pobrać raport za
                wybrany okres powyżej.
              </p>
            )}
            {data.reportState?.[0]?.lastSuccessAt && (
              <p className="mt-2 text-xs text-gray-500">
                Ostatnia kontrola raportów:{" "}
                {new Date(data.reportState[0].lastSuccessAt).toLocaleString(
                  "pl-PL",
                  { timeZone: "Europe/Warsaw" },
                )}
              </p>
            )}
            {!data.reports.length ? (
              <p className="text-sm text-gray-500 py-6">
                Brak zapisanych raportów.
              </p>
            ) : (
              <div className="divide-y mt-4">
                {[...data.reports]
                  .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap justify-between items-center gap-3 py-4"
                    >
                      <div>
                        <strong className="text-sm">
                          {r.from} – {r.to}
                        </strong>
                        <p className="text-xs text-gray-500 mt-1">
                          {r.automatic ? "Automatyczny" : "Na żądanie"} ·{" "}
                          {
                            (
                              {
                                week: "tydzień",
                                month: "miesiąc",
                                year: "rok",
                                day: "dzień",
                                custom: "własny zakres",
                              } as any
                            )[r.kind]
                          }{" "}
                          ·{" "}
                          {new Date(r.generatedAt).toLocaleDateString("pl-PL")}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="text-sm text-teal-800 px-3 py-2"
                          onClick={() => setSelectedReport(r)}
                        >
                          Podgląd
                        </button>
                        <button
                          disabled={busy}
                          className="text-sm border rounded-lg px-3 py-2"
                          onClick={() => action(() => exportPhonePdf(r))}
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
          {selectedReport && (
            <>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  Zapisany raport: {selectedReport.from} – {selectedReport.to}
                </h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-sm underline"
                >
                  Zamknij
                </button>
              </div>
              <PhoneAnalysis summary={selectedReport.summary} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default function TelefonyTab({
  canStats,
  owner,
}: {
  canStats: boolean;
  owner: string;
}) {
  const [data, setData] = useState<PhoneData>({
      contacts: [],
      calls: [],
      financials: [],
      reports: [],
    }),
    [loaded, setLoaded] = useState<string[]>([]),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoaded([]);
    setError(false);
    setData({ contacts: [], calls: [], financials: [], reports: [] });
    const names = {
      contacts: "phoneContacts",
      calls: "phoneCalls",
      ...(canStats
        ? {
            financials: "phoneFinancials",
            reports: "phoneReports",
            reportState: "phoneReportState",
          }
        : {}),
    };
    const off = Object.entries(names).map(([key, name]) =>
      watchPhoneCollection(
        name,
        (rows: any[]) => {
          setData((d) => ({ ...d, [key]: rows }));
          setLoaded((a) => [...new Set([...a, key])]);
        },
        () => setError(true),
      ),
    );
    return () => off.forEach((fn) => fn());
  }, [canStats, retry]);
  if (error)
    return (
      <div
        role="alert"
        className="bg-red-50 border border-red-200 rounded-xl p-6"
      >
        <h2 className="font-semibold text-red-900">
          Nie udało się pobrać telefonów
        </h2>
        <p className="text-sm text-red-800 mt-2">
          Sprawdź połączenie i dostęp do modułu. Spróbuj wczytać dane ponownie.
        </p>
        <button
          onClick={() => setRetry(retry + 1)}
          className="mt-4 px-4 py-3 bg-white border rounded-lg"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  if (loaded.length < (canStats ? 5 : 2))
    return (
      <div
        role="status"
        className="py-12 flex items-center justify-center gap-3 text-gray-600"
      >
        <RefreshCw className="animate-spin" size={20} />
        Wczytywanie telefonów…
      </div>
    );
  return (
    <TelefonyView
      data={data}
      canStats={canStats}
      owner={owner}
      onSave={savePhoneContact}
      onReport={savePhoneReport}
    />
  );
}
