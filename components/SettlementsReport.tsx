import React, { useState } from 'react';
import { formatCurrency, packageLabel, PAYMENT_CATEGORY_LABELS, SERVICE_TYPE_LABELS, SERVICE_PAYMENT_STATUS_LABELS } from '../types';
import { pobierzRaportRozliczen, RaportRozliczen } from '../services/aws/dane';

// Raport rozliczeń za dowolny okres (specyfikacja zmian CRM, punkt 8). Liczy serwer, tylko dla grupy ze statystykami.
const FORMY: Record<string, string> = { przelew: 'Przelew', gotowka: 'Gotówka', karta: 'Karta', przedplata: 'Przedpłata', brak: 'Nie podano' };
const pole = 'px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-teal-600';
const POWODY: Record<string, string> = {
  'brak-pacjenta': 'nie ma pacjenta z takim numerem PESEL w CRM', niejednoznaczne: 'kilka kart z tym numerem PESEL, nie wiadomo która', 'brak-pakietu': 'karta bez pakietu',
  'zly-pesel': 'błędny numer PESEL w arkuszu', 'brak-daty': 'brak daty zgłoszenia i daty wizyty', 'blad-polaczenia': 'błąd połączenia z arkuszem',
};
const pierwszyDzien = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const SettlementsReport: React.FC = () => {
  const [od, setOd] = useState(pierwszyDzien());
  const [doDnia, setDoDnia] = useState(new Date().toISOString().split('T')[0]);
  const [r, setR] = useState<RaportRozliczen | null>(null);
  const [blad, setBlad] = useState('');
  const [czekam, setCzekam] = useState(false);

  const pokaz = async (e: React.FormEvent) => {
    e.preventDefault();
    setCzekam(true); setBlad('');
    try { setR(await pobierzRaportRozliczen(od, doDnia)); } catch (err) { setBlad((err as Error).message); } finally { setCzekam(false); }
  };

  const kafel = (tytul: string, wartosc: string, opis?: string) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase">{tytul}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{wartosc}</div>
      {opis && <div className="text-xs text-gray-500 mt-1">{opis}</div>}
    </div>
  );
  const rozbicie = (tytul: string, dane: Record<string, number>, etykiety: Record<string, string>) => Object.keys(dane).length > 0 && (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">{tytul}</div>
      <ul className="text-sm text-gray-800 space-y-1">
        {Object.entries(dane).map(([k, v]) => <li key={k} className="flex justify-between gap-4"><span>{etykiety[k] || (k === 'brak' ? 'Nie podano' : k)}</span><span className="font-semibold">{formatCurrency(v)}</span></li>)}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <form onSubmit={pokaz} className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="rap-od" className="block text-xs font-semibold text-gray-600 mb-1">Od</label>
          <input id="rap-od" type="date" required value={od} onChange={(e) => setOd(e.target.value)} className={pole} />
        </div>
        <div>
          <label htmlFor="rap-do" className="block text-xs font-semibold text-gray-600 mb-1">Do</label>
          <input id="rap-do" type="date" required value={doDnia} onChange={(e) => setDoDnia(e.target.value)} className={pole} />
        </div>
        <button type="submit" disabled={czekam} className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-300">{czekam ? 'Liczę…' : 'Pokaż raport'}</button>
        <p className="text-xs text-gray-500 basis-full">Sprzedaż pakietów liczona jest wg daty zgłoszenia, usługi wg daty usługi, a wpłaty wg daty faktycznej wpłaty.</p>
      </form>

      {blad && <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">{blad}</div>}

      {r && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kafel('Wartość sprzedanych pakietów', formatCurrency(r.pakiety.wartosc), `${r.pakiety.liczba} przyjęć w okresie`)}
            {kafel('Wpłaty faktycznie otrzymane', formatCurrency(r.wplaty.suma), `${r.wplaty.liczba} wpłat w okresie`)}
            {kafel('Należności do zapłaty (stan na dziś)', formatCurrency(r.naleznosci.suma), `${r.naleznosci.pacjentow} pacjentów z saldem`)}
            {kafel('Przychód z dodatkowych tygodni', formatCurrency(r.dodatkoweTygodnie.suma), `${r.dodatkoweTygodnie.liczba} przedłużeń`)}
            {kafel('Przychód z usług dodatkowych', formatCurrency(r.uslugiDodatkowe.suma), `${r.uslugiDodatkowe.liczba} usług`)}
            {kafel('Psychiatra', `${r.psychiatra.wPakiecie} w pakietach, ${r.psychiatra.platne} płatnych`, `wartość płatnych: ${formatCurrency(r.psychiatra.wartoscPlatnych)}`)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rozbicie('Wpłaty wg kategorii', r.wplaty.wgKategorii, PAYMENT_CATEGORY_LABELS)}
            {rozbicie('Wpłaty wg formy', r.wplaty.wgFormy, FORMY)}
            {rozbicie('Usługi dodatkowe wg rodzaju', r.uslugiDodatkowe.wgRodzaju, SERVICE_TYPE_LABELS as Record<string, string>)}
          </div>
          {r.wplatyBezDaty.liczba > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
              Poza okresem: {r.wplatyBezDaty.liczba} starych wpłat bez daty na łączną kwotę {formatCurrency(r.wplatyBezDaty.suma)} (zapisane kiedyś jako sama kwota „wpłacono”). Nie da się ich przypisać do żadnego okresu.
            </p>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Zapisy do psychiatry z formularza (arkusz)</h4>
            {!r.arkusz ? <p className="text-sm text-gray-500">Synchronizacja z arkuszem nie jest jeszcze włączona.</p> : (
              <>
                <p className="text-sm text-gray-700">
                  Ostatnie sprawdzenie: {r.arkusz.koniec ? new Date(r.arkusz.koniec).toLocaleString('pl-PL') : 'brak'}. Wierszy w arkuszu: {r.arkusz.wierszy}, w CRM: {r.arkusz.zsynchronizowano} (nowe: {r.arkusz.noweWizyty}, zaktualizowane: {r.arkusz.zaktualizowane}).
                </p>
                {r.arkusz.blad && <p className="text-sm text-red-700 mt-1">Ostatnie sprawdzenie zakończyło się błędem połączenia z arkuszem.</p>}
                {r.arkusz.doWyjasnienia.length > 0 && (
                  <table className="w-full text-sm mt-3">
                    <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-1 pr-3">Wiersz arkusza</th><th className="py-1 pr-3">Osoba w arkuszu</th><th className="py-1">Do wyjaśnienia</th></tr></thead>
                    <tbody>{r.arkusz.doWyjasnienia.map((u, i) => (
                      <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-3">{u.wiersz}</td><td className="py-1 pr-3">{u.osoba}</td><td className="py-1">{POWODY[u.powod] || u.powod}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Pacjenci z nieopłaconymi usługami ({r.nieoplaconeUslugi.length})</h4>
            {r.nieoplaconeUslugi.length === 0 ? <p className="text-sm text-gray-500">Brak.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-1 pr-3">Pacjent</th><th className="py-1 pr-3">Usługa</th><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Kwota</th><th className="py-1 pr-3">Status</th><th className="py-1">Termin</th></tr></thead>
                <tbody>{r.nieoplaconeUslugi.map((u, i) => (
                  <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-3">{u.pacjent}</td><td className="py-1 pr-3">{(SERVICE_TYPE_LABELS as Record<string, string>)[u.typ] || u.typ}</td><td className="py-1 pr-3">{u.data}</td><td className="py-1 pr-3">{formatCurrency(u.kwota)}</td><td className="py-1 pr-3">{(SERVICE_PAYMENT_STATUS_LABELS as Record<string, string>)[u.status] || u.status}</td><td className="py-1">{u.termin || ''}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Pacjenci w ośrodku z niewykorzystaną konsultacją psychiatryczną w pakiecie ({r.niewykorzystaneKonsultacje.length})</h4>
            {r.niewykorzystaneKonsultacje.length === 0 ? <p className="text-sm text-gray-500">Brak.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-1 pr-3">Pacjent</th><th className="py-1 pr-3">Pakiet</th><th className="py-1 pr-3">Wykorzystane</th><th className="py-1">Koniec terapii</th></tr></thead>
                <tbody>{r.niewykorzystaneKonsultacje.map((u, i) => (
                  <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-3">{u.pacjent}</td><td className="py-1 pr-3">{packageLabel(u.pakiet)}</td><td className="py-1 pr-3">{u.wykorzystane} z {u.limit}</td><td className="py-1">{u.terapiaDo}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SettlementsReport;
