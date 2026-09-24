import React from "react";
import { Download, Phone } from "lucide-react";
import type { PhoneContact, PhoneCall } from "../../services/telephony";
const date = (s: string) =>
  s ? s.split("-").reverse().join(".") : "Brak daty";
const duration = (s: number | null) =>
  s === null
    ? "Brak czasu"
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export function PhoneCallList({
  calls,
  contacts,
  page,
  onCall,
  onExport,
}: {
  calls: PhoneCall[];
  contacts: Map<string, PhoneContact>;
  page: number;
  onCall: (c: PhoneContact) => void;
  onExport: () => void;
}) {
  const rows = calls.slice((page - 1) * 30, page * 30);
  return (
    <section className="bg-white border rounded-xl overflow-hidden">
      <div className="p-4 flex flex-wrap justify-between items-center gap-3">
        <h3 className="font-semibold">
          Zapisane rozmowy{" "}
          <span className="font-normal text-gray-500">({calls.length})</span>
        </h3>
        <button
          disabled={!calls.length}
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg disabled:opacity-40"
        >
          <Download size={16} />
          CSV
        </button>
      </div>
      {!calls.length ? (
        <div className="p-10 text-center">
          <Phone className="mx-auto text-teal-700 mb-3" size={28} />
          <h3 className="font-semibold">Brak rozmów w tym okresie</h3>
          <p className="text-sm text-gray-500 mt-2">
            Dodaj nowy kontakt lub wybierz istniejący w zakładce Kontakty.
          </p>
        </div>
      ) : (
        <>
          <ul className="sm:hidden divide-y border-t">
            {rows.map((c) => {
              const contact = contacts.get(c.contactId);
              return (
                <li key={c.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <strong className="text-sm break-words min-w-0">
                      {contact?.label}
                    </strong>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {date(c.date)}
                      <br />
                      {c.time}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-teal-50 text-teal-900 px-2 py-1">
                      {c.result}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-1">
                      {c.kind}
                    </span>
                    <span className="px-2 py-1">
                      {duration(c.durationSeconds)}{c.durationSeconds === null ? "" : " min"}
                    </span>
                  </div>
                  {c.note && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {c.note}
                    </p>
                  )}
                  {contact && (
                    <button
                      onClick={() => onCall(contact)}
                      className="text-sm text-teal-800 font-semibold py-2"
                    >
                      Kolejna rozmowa
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {[
                    "Kiedy",
                    "Kontakt",
                    "Rozmowa",
                    "Wynik",
                    "Czas",
                    "Notatka",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="text-left px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const contact = contacts.get(c.contactId);
                  return (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {date(c.date)}
                        <span className="block text-gray-500 text-xs mt-1">
                          {c.time}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {contact?.label}
                        <span className="block text-xs text-gray-500 font-normal mt-1">
                          {contact?.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{c.kind}</td>
                      <td className="px-4 py-3">{c.result}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {duration(c.durationSeconds)}
                      </td>
                      <td className="px-4 py-3 min-w-[160px] max-w-xs">
                        <p className="whitespace-pre-wrap break-words">
                          {c.note || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {contact && (
                          <button
                            onClick={() => onCall(contact)}
                            className="text-teal-800 font-medium whitespace-nowrap py-2"
                          >
                            Kolejna rozmowa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
export function PhoneContactList({
  contacts,
  counts,
  page,
  today,
  onCall,
  onEdit,
  onHistory,
}: {
  contacts: PhoneContact[];
  counts: Map<string, number>;
  page: number;
  today: string;
  onCall: (c: PhoneContact) => void;
  onEdit: (c: PhoneContact) => void;
  onHistory: (c: PhoneContact) => void;
}) {
  const rows = contacts.slice((page - 1) * 30, page * 30);
  const actions = (c: PhoneContact) => (
    <div className="flex flex-wrap sm:flex-col items-start gap-x-4">
      <button
        onClick={() => onCall(c)}
        className="text-teal-800 font-semibold py-2"
      >
        Zapisz rozmowę
      </button>
      <button onClick={() => onEdit(c)} className="text-gray-600 py-2">
        Szczegóły / edytuj
      </button>
      <button onClick={() => onHistory(c)} className="text-gray-600 py-2">
        Historia rozmów
      </button>
    </div>
  );
  return (
    <section className="bg-white border rounded-xl overflow-hidden">
      <div className="p-4">
        <h3 className="font-semibold">Kontakty ({contacts.length})</h3>
        <p className="text-xs text-gray-500 mt-1">
          Wszystkie daty pierwszego kontaktu. Każdy kontakt ma własną historię
          rozmów.
        </p>
      </div>
      {!contacts.length ? (
        <p className="p-10 text-center text-gray-500">
          Brak kontaktów pasujących do filtrów.
        </p>
      ) : (
        <>
          <ul className="sm:hidden divide-y border-t">
            {rows.map((c) => (
              <li key={c.id} className="p-4 space-y-3 text-sm">
                <div>
                  <strong className="break-words">{c.label}</strong>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.phone || "Bez numeru"} · {c.source || "Brak źródła"}
                  </p>
                </div>
                <p>
                  {c.category || "Brak kategorii"} · {c.quality || "Brak oceny"}{" "}
                  · {c.stage}
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Następny krok</p>
                  <p className="mt-1">
                    {c.nextDate
                      ? `${date(c.nextDate)} ${c.nextTime}`
                      : "Nie ustalono"}
                  </p>
                  {c.followupNote && (
                    <p className="text-xs text-gray-600 mt-1 break-words">
                      {c.followupNote}
                    </p>
                  )}
                </div>
                {actions(c)}
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {[
                    "Kontakt",
                    "Pierwszy kontakt",
                    "Kategoria / źródło",
                    "Stan",
                    "Następny krok",
                    "Rozmowy",
                    "Działania",
                  ].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <strong>{c.label}</strong>
                      <span className="block text-xs text-gray-500 mt-1">
                        {c.phone || "Bez numeru"}
                        {c.historical ? " · Historia" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {date(c.firstDate)}
                      <span className="block text-xs text-gray-500 mt-1">
                        {c.firstTime}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.category || "Brak kategorii"}
                      <span className="block text-xs text-gray-500 mt-1">
                        {c.source || "Brak źródła"} ·{" "}
                        {c.quality || "Brak oceny"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.stage}
                      <span className="block text-xs text-gray-500 mt-1">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <span
                        className={
                          c.nextDate &&
                          c.nextDate < today &&
                          (!c.historical || c.followupConfirmed)
                            ? "text-amber-800 font-medium"
                            : ""
                        }
                      >
                        {c.nextDate
                          ? `${date(c.nextDate)} ${c.nextTime}`
                          : "Nie ustalono"}
                      </span>
                      <p className="text-xs text-gray-500 mt-1 break-words max-w-xs">
                        {c.followupNote}
                      </p>
                    </td>
                    <td className="px-4 py-3">{counts.get(c.id) || 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {actions(c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
