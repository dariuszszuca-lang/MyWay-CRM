import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import {
  PhoneContact,
  PhoneCall,
  SOURCES,
  CATEGORIES,
  STAGES,
  STATUSES,
  FOLLOWUP_STATUSES,
  RESULTS,
  warsawNow,
} from "../../services/telephony";
export const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="text-sm font-medium text-gray-700">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, { id })
        : children}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  empty = "Wybierz…",
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
  empty?: string;
}) {
  return (
    <Field label={label}>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{empty}</option>
        {[...new Set([...options, ...(value ? [value] : [])])].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </Field>
  );
}
export function newContact(owner: string): PhoneContact {
  const now = warsawNow();
  return {
    id: "",
    label: "",
    phone: "",
    firstDate: now.date,
    firstTime: now.time,
    category: "",
    quality: "",
    temperature: "",
    source: "",
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
    owner,
    revision: 0,
    followupConfirmed: true,
  };
}
export default function PhoneForm({
  initial,
  initialAmount,
  canFinance,
  recordCall,
  onSave,
  onClose,
}: {
  initial: PhoneContact;
  initialAmount: number | null;
  canFinance: boolean;
  recordCall: boolean;
  onSave: (
    c: PhoneContact,
    call: PhoneCall | null,
    amount: number | null | undefined,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const now = warsawNow();
  const [c, setC] = useState(initial),
    [amount, setAmount] = useState(
      initialAmount === null ? "" : String(initialAmount),
    );
  const [call, setCall] = useState<PhoneCall>({
    id: "",
    contactId: initial.id,
    date: now.date,
    time: now.time,
    kind: initial.id ? "Kolejna rozmowa" : "Pierwszy kontakt",
    durationSeconds: null,
    result: "Brak decyzji",
    answered: true,
    fullConversation: false,
    callback: false,
    note: "",
  });
  const [minutes, setMinutes] = useState(""),
    [seconds, setSeconds] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false);
  const change = (k: keyof PhoneContact, v: string) =>
    setC((prev) => ({
      ...prev,
      [k]: v,
      ...(["nextDate", "nextTime", "followupStatus", "followupNote"].includes(k)
        ? { followupConfirmed: true }
        : {}),
    }));
  const text = (k: keyof PhoneContact, label: string, type = "text") => (
    <Field label={label}>
      <input
        type={type}
        className={inputClass}
        value={String(c[k] ?? "")}
        onChange={(e) => change(k, e.target.value)}
        maxLength={type === "text" ? 120 : undefined}
      />
    </Field>
  );
  const select = (k: keyof PhoneContact, label: string, options: string[]) => (
    <Select
      label={label}
      value={String(c[k] || "")}
      onChange={(v) => change(k, v)}
      options={options}
    />
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const duration =
        minutes === "" && seconds === ""
          ? null
          : Number(minutes || 0) * 60 + Number(seconds || 0);
      if (
        (seconds !== "" &&
          (!Number.isInteger(Number(seconds)) ||
            Number(seconds) < 0 ||
            Number(seconds) > 59)) ||
        (minutes !== "" &&
          (!Number.isInteger(Number(minutes)) || Number(minutes) < 0))
      )
        throw new Error("Podaj pełne minuty i sekundy od 0 do 59.");
      const contact =
        !c.id && recordCall
          ? { ...c, firstDate: call.date, firstTime: call.time }
          : c;
      await onSave(
        contact,
        recordCall ? { ...call, durationSeconds: duration } : null,
        canFinance ? (amount === "" ? null : Number(amount)) : undefined,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się zapisać. Spróbuj ponownie.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="bg-white border border-teal-200 rounded-xl shadow-sm mb-6"
      aria-label="Formularz kontaktu"
    >
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-semibold text-lg">
          {!initial.id
            ? "Nowy kontakt"
            : recordCall
              ? "Zapisz kolejną rozmowę"
              : "Edytuj kontakt"}
        </h3>
        <button
          type="button"
          aria-label="Zamknij formularz"
          onClick={onClose}
          disabled={busy}
          className="p-3 rounded-lg hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} className="p-4 sm:p-6 space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nazwa / ID kontaktu *">
              <input
                autoFocus
                required
                maxLength={120}
                className={inputClass}
                value={c.label}
                onChange={(e) => change("label", e.target.value)}
                placeholder="np. L727 lub imię"
              />
            </Field>
            {text("phone", "Telefon", "tel")}
            {select("source", "Źródło", SOURCES)}
            {select("category", "Kategoria", CATEGORIES)}
            {select("quality", "Ocena kontaktu", ["A", "B", "C", "D"])}
            {text("owner", "Opiekun")}
          </div>
          {recordCall && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <h4 className="font-semibold">Rozmowa</h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Data *">
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={call.date}
                    onChange={(e) => setCall({ ...call, date: e.target.value })}
                  />
                </Field>
                <Field label="Godzina (Polska) *">
                  <input
                    required
                    type="time"
                    className={inputClass}
                    value={call.time}
                    onChange={(e) => setCall({ ...call, time: e.target.value })}
                  />
                </Field>
                <Field label="Minuty">
                  <input
                    type="number"
                    min="0"
                    max="600"
                    step="1"
                    className={inputClass}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="Brak danych"
                  />
                </Field>
                <Field label="Sekundy">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    className={inputClass}
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Select
                  label="Wynik *"
                  value={call.result}
                  options={RESULTS}
                  onChange={(v) => {
                    setCall({
                      ...call,
                      result: v,
                      answered: v === "Nieodebrany" ? false : call.answered,
                      fullConversation:
                        v === "Nieodebrany" ? false : call.fullConversation,
                    });
                    if (v === "Rezerwacja" || v === "Zadatek")
                      change("status", v);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                {(
                  [
                    ["answered", "Odebrany"],
                    ["fullConversation", "Pełna rozmowa"],
                    ["callback", "Oddzwoniono"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={call[k]}
                      onChange={(e) =>
                        setCall({
                          ...call,
                          [k]: e.target.checked,
                          ...(k === "answered" && !e.target.checked
                            ? { fullConversation: false }
                            : {}),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Field label="Notatka z rozmowy">
                <textarea
                  rows={2}
                  maxLength={4000}
                  className={inputClass}
                  value={call.note}
                  onChange={(e) => setCall({ ...call, note: e.target.value })}
                />
              </Field>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {text("nextDate", "Następny kontakt", "date")}
            {text("nextTime", "Godzina kolejnego kontaktu", "time")}
            {select(
              "followupStatus",
              "Status ponownego kontaktu",
              FOLLOWUP_STATUSES,
            )}
          </div>
          <Field label="Cel następnej rozmowy">
            <textarea
              rows={2}
              maxLength={4000}
              className={inputClass}
              value={c.followupNote}
              onChange={(e) => change("followupNote", e.target.value)}
            />
          </Field>
          <details
            className="rounded-lg border border-gray-200 p-4"
            open={!recordCall}
          >
            <summary className="cursor-pointer font-medium text-sm py-1">
              Szczegóły kontaktu i wynik sprzedaży
            </summary>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {initial.id && text("firstDate", "Pierwszy kontakt", "date")}
              {initial.id &&
                text("firstTime", "Godzina pierwszego kontaktu", "time")}
              {text("province", "Województwo")}
              {select("temperature", "Temperatura", [
                "Zimny",
                "Ciepły",
                "Gorący",
              ])}
              {select("stage", "Etap", STAGES)}
              {select("status", "Status końcowy", STATUSES)}
              {text("closedDate", "Data zamknięcia", "date")}
              {text("lossReason", "Powód odpadnięcia")}
              {canFinance && (
                <Field label="Kwota zamknięcia (zł)">
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    className={inputClass}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Brak danych"
                  />
                </Field>
              )}
            </div>
            <div className="mt-4">
              <Field label="Notatka o kontakcie">
                <textarea
                  rows={3}
                  maxLength={4000}
                  className={inputClass}
                  value={c.note}
                  onChange={(e) => change("note", e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Oceny A–D wybierasz ręcznie. Kwota zamknięcia nie jest
              potwierdzeniem wpłaty.
            </p>
            {c.historical && (
              <div className="text-sm text-amber-800 mt-3 space-y-2">
                <p>
                Dane historyczne. Dawny czas: {c.historicalDuration || "brak"},
                liczba kontaktów: {c.historicalCount || "brak"}. Termin wymaga
                potwierdzenia.
                </p>
                <p>Godzina źródłowa: {c.historicalFirstTime || "brak"}. Zamknięcie źródłowe: {c.historicalClosedAt || "brak"}. Follow-up źródłowy: {c.historicalFollowupAt || "brak"}.</p>
                {c.stage === "Wygrany" && !c.closedDate && <p>Brak poprawnej daty zamknięcia. Uzupełnij ją po sprawdzeniu — do tego czasu wygrana nie wchodzi do wyników okresowych.</p>}
                {c.historicalExtraNotes && <p className="whitespace-pre-wrap">{c.historicalExtraNotes}</p>}
              </div>
            )}
          </details>
        </fieldset>
        {error && (
          <p
            role="alert"
            className="bg-red-50 text-red-800 rounded-lg p-3 text-sm"
          >
            {error}
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-3 text-sm rounded-lg border"
          >
            Anuluj
          </button>
          <button
            disabled={busy}
            className="px-5 py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {busy
              ? "Zapisywanie…"
              : recordCall
                ? "Zapisz rozmowę"
                : "Zapisz kontakt"}
          </button>
        </div>
      </form>
    </section>
  );
}
