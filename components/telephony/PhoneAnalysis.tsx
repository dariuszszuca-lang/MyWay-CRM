import React from "react";
const number = (n: number | null, suffix = "") =>
  n === null
    ? "Brak danych"
    : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(n)}${suffix}`;
export default function PhoneAnalysis({ summary: s }: { summary: any }) {
  const metrics = [
    ["Nowe kontakty", s.newContacts, "Według pierwszego kontaktu"],
    ["Próby telefonu", s.attempts, "Każda zapisana próba"],
    ["Wygrane procesy", s.won, `${s.wonEarlier} z wcześniejszych kontaktów`],
    [
      "Kwota zamknięć",
      number(s.revenue, " zł"),
      s.missingAmounts
        ? `${s.missingAmounts} wygranych bez kwoty`
        : "Według wpisów, nie wpłat",
    ],
  ];
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="bg-white border rounded-xl p-5">
            <p className="text-sm text-gray-600">{label}</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-2">{hint}</p>
          </div>
        ))}
      </div>
      <section className="bg-teal-50 border border-teal-100 rounded-xl p-5">
        <h3 className="font-semibold mb-3">Co wynika z danych</h3>
        <ul className="space-y-2 text-sm text-teal-950">
          {s.insights.map((line: string) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs text-teal-800 mt-4">
          Podsumowanie obliczane z wpisów. „Wartościowy wynik” oznacza umówiony
          krok, rezerwację lub zadatek; nie jest oceną zdrowia ani
          potwierdzeniem sprzedaży.
        </p>
      </section>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        {[
          [
            "Konwersja nowych kontaktów",
            number(s.cohortConversion, "%"),
            `${s.cohortWon} wygranych / ${s.newContacts} kontaktów, stan ${s.asOf}`,
          ],
          [
            "Czas rozmów",
            number(s.durationSeconds / 60, " min"),
            `${s.missingDurations} prób bez podanego czasu`,
          ],
          [
            "Odebrane / pełne rozmowy",
            `${s.answered} / ${s.fullConversations}`,
            `${s.callbacks} oddzwonień; ${s.followups} kolejnych rozmów`,
          ],
          [
            "Ponowny kontakt",
            `${s.dueToday} dziś`,
            `${s.overdue} zaległych według aktualnego stanu`,
          ],
        ].map(([label, value, hint]) => (
          <div key={label} className="border rounded-xl bg-white p-4">
            <p className="text-gray-600">{label}</p>
            <p className="text-xl font-semibold mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-2">{hint}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          ["Oceny nowych kontaktów", s.qualities],
          ["Kategorie nowych kontaktów", s.categories],
          ["Źródła nowych kontaktów", s.sources],
          ["Statusy nowych kontaktów", s.statuses],
          ["Etapy nowych kontaktów", s.stages || {}],
          ["Temperatura nowych kontaktów", s.temperatures || {}],
          ["Województwa", s.provinces || {}],
          ["Opiekunowie nowych kontaktów", s.owners || {}],
          ["Wyniki rozmów", s.results],
          ["Powody przegranych w okresie", s.lossReasons],
        ].map(([label, values]) => (
          <section
            key={String(label)}
            className="bg-white border rounded-xl p-5"
          >
            <h3 className="font-semibold mb-4">{String(label)}</h3>
            {Object.keys(values).length === 0 ? (
              <p className="text-sm text-gray-500">
                Brak danych w tym okresie.
              </p>
            ) : (
              Object.entries(values).map(([name, value]: [string, number]) => (
                <div key={name} className="mb-3">
                  <div className="flex justify-between text-sm gap-3">
                    <span>{name}</span>
                    <strong>{value}</strong>
                  </div>
                  <div
                    className="bg-gray-100 rounded-full h-1.5 mt-1.5"
                    aria-hidden="true"
                  >
                    <div
                      className="bg-teal-600 rounded-full h-full"
                      style={{
                        width: `${(value / Math.max(...(Object.values(values) as number[]))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </section>
        ))}
      </div>
      <section className="bg-white border rounded-xl overflow-hidden">
        <div className="p-5">
          <h3 className="font-semibold">Godziny zapisanych rozmów</h3>
          <p className="text-sm text-gray-500 mt-1">
            Godziny polskie. Porównuj liczbę prób i podobne źródła. Mała próba
            (poniżej 20) nie wystarcza do wniosku o najlepszej godzinie.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {[
                  "Godzina",
                  "Próby",
                  "Wartościowe",
                  "Minuty",
                  "Wartościowe / 60 min",
                  "Kolejne rozmowy",
                  "Wartościowe kolejne",
                  "Próba",
                ].map((h) => (
                  <th key={h} scope="col" className="text-left px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.hours
                .filter((h: any) => h.attempts)
                .map((h: any) => (
                  <tr key={h.hour} className="border-t">
                    <td className="px-4 py-3">
                      {String(h.hour).padStart(2, "0")}:00
                    </td>
                    <td className="px-4">{h.attempts}</td>
                    <td className="px-4">{h.valuable}</td>
                    <td className="px-4">
                      {number(h.seconds / 60)}
                      {h.missingDurations ? " *" : ""}
                    </td>
                    <td className="px-4">{number(h.valuablePerHour)}</td>
                    <td className="px-4">{h.followups}</td>
                    <td className="px-4">{h.valuableFollowups}</td>
                    <td className="px-4 text-gray-500">
                      {h.attempts < 20 ? "Mała próba" : `${h.attempts} prób`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!s.attempts && (
          <p className="p-5 text-sm text-gray-500">
            W tym okresie nie zapisano rozmów.
          </p>
        )}
        {s.missingDurations > 0 && (
          <p className="p-4 text-xs text-amber-800">
            * Czas niepełny. Wskaźnik na 60 minut pominięty dla godzin z
            brakującym czasem.
          </p>
        )}
      </section>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Dni tygodnia</h3>
          {s.days.map((d: any) => (
            <div
              key={d.day}
              className="flex justify-between gap-3 py-2 border-b last:border-0 text-sm"
            >
              <span>
                {
                  [
                    "Poniedziałek",
                    "Wtorek",
                    "Środa",
                    "Czwartek",
                    "Piątek",
                    "Sobota",
                    "Niedziela",
                  ][d.day]
                }
              </span>
              <span>
                {d.attempts} prób / {d.valuable} wartościowych
              </span>
            </div>
          ))}
        </section>
        <section className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-2">Godzina pierwszego kontaktu</h3>
          <p className="text-xs text-gray-500 mb-4">
            Osobna miara: kontakty, nie kolejne rozmowy. „Sprzedaż” to kategoria
            źródłowa. {s.invalidFirstTimes} kontaktów bez prawidłowej godziny
            pominięto.
          </p>
          <div className="max-h-72 overflow-auto">
            {s.historical
              .filter((h: any) => h.contacts)
              .map((h: any) => (
                <div
                  key={h.hour}
                  className="flex justify-between py-2 border-b text-sm"
                >
                  <span>{String(h.hour).padStart(2, "0")}:00</span>
                  <span>
                    {h.contacts} kontaktów / {h.salesCategory} „Sprzedaż”
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
