import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Stethoscope } from 'lucide-react';
import { Patient, packageLabel } from '../types';
import { dodajWizyte, pobierzWizyty, PodsumowaniePsychiatry, WizytaPsychiatry, zmienWizyte } from '../services/aws/dane';

// Sekcja „Psychiatra” (specyfikacja zmian CRM 06.10.2026): limit konsultacji z pakietu, wizyty i ich statusy.
// O tym, czy wizyta jest w pakiecie czy płatna (usługa „Psychiatra” 300 zł), decyduje serwer.
const STATUSY: Record<WizytaPsychiatry['status'], string> = {
  zarejestrowana: 'Zarejestrowana', potwierdzona: 'Potwierdzona', zrealizowana: 'Zrealizowana', anulowana: 'Anulowana', niezglosil: 'Pacjent nie zgłosił się',
};
const AKTYWNE = ['zarejestrowana', 'potwierdzona', 'zrealizowana'];
const pole = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-teal-600';

export default function PsychiatristPanel({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [wizyty, setWizyty] = useState<WizytaPsychiatry[] | null>(null);
  const [suma, setSuma] = useState<PodsumowaniePsychiatry | null>(null);
  const [blad, setBlad] = useState('');
  const [czekam, setCzekam] = useState(false);
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [godzina, setGodzina] = useState('');
  const [uwagi, setUwagi] = useState('');

  const wczytaj = useCallback(async () => {
    try {
      const r = await pobierzWizyty(patient.id);
      setWizyty(r.wizyty); setSuma(r.psychiatra); setBlad('');
    } catch (e) { setBlad((e as Error).message); }
  }, [patient.id]);
  useEffect(() => { wczytaj(); }, [wczytaj]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const wykonaj = async (fn: () => Promise<string | void>) => {
    if (czekam) return;
    setCzekam(true); setBlad('');
    try { const info = await fn(); await wczytaj(); if (info) alert(info); } catch (e) { setBlad((e as Error).message); } finally { setCzekam(false); }
  };

  const dodaj = (e: React.FormEvent) => {
    e.preventDefault();
    wykonaj(async () => {
      const r = await dodajWizyte(patient.id, { data, godzina, uwagi });
      setUwagi(''); setGodzina('');
      return r.rozliczenie === 'platna'
        ? 'Wizyta ponad limit pakietu: dopisana usługa „Psychiatra” 300 zł (nieopłacona). Wpłatę dodasz w karcie pacjenta.'
        : undefined;
    });
  };

  const zmienStatus = (w: WizytaPsychiatry, status: WizytaPsychiatry['status']) => {
    if (status === w.status) return;
    if (!AKTYWNE.includes(status) && !confirm(`Oznaczyć wizytę z ${w.data} jako „${STATUSY[status]}”? Tej zmiany nie da się cofnąć${w.rozliczenie === 'platna' ? ', a należność 300 zł za tę wizytę zostanie anulowana' : ''}.`)) return;
    wykonaj(async () => {
      const r = await zmienWizyte(patient.id, w.id, { status });
      return r.przeniesionaDoPakietu ? 'Zwolniło się miejsce w pakiecie: najbliższa wizyta płatna została przeniesiona do pakietu, a jej należność 300 zł anulowana.' : undefined;
    });
  };

  const kafel = (etykieta: string, wartosc: number | string) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{wartosc}</div>
      <div className="text-xs text-gray-600">{etykieta}</div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="psych-tytul" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div>
            <h3 id="psych-tytul" className="text-lg font-bold text-gray-800 flex items-center gap-2"><Stethoscope className="w-5 h-5 text-teal-600" aria-hidden="true" /> Psychiatra: {patient.firstName} {patient.lastName}</h3>
            <p className="text-sm text-gray-500">{packageLabel(patient.package)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Zamknij"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {blad && <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">{blad}</div>}

          {suma && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {kafel('w cenie pakietu', suma.limit)}
              {kafel('zarezerwowane', suma.zarezerwowane)}
              {kafel('zrealizowane', suma.zrealizowane)}
              {kafel('pozostałe w pakiecie', suma.pozostalo)}
              {kafel('dodatkowo płatne', suma.platne)}
            </div>
          )}

          <form onSubmit={dodaj} className="bg-teal-50 border border-teal-100 rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="psych-data" className="block text-xs font-semibold text-gray-700 mb-1">Data wizyty</label>
              <input id="psych-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} className={pole} />
            </div>
            <div>
              <label htmlFor="psych-godzina" className="block text-xs font-semibold text-gray-700 mb-1">Godzina</label>
              <input id="psych-godzina" type="time" value={godzina} onChange={(e) => setGodzina(e.target.value)} className={pole} />
            </div>
            <div>
              <label htmlFor="psych-uwagi" className="block text-xs font-semibold text-gray-700 mb-1">Uwagi</label>
              <input id="psych-uwagi" type="text" maxLength={500} value={uwagi} onChange={(e) => setUwagi(e.target.value)} className={pole} />
            </div>
            <button type="submit" disabled={czekam} className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-300">
              {czekam ? 'Zapisuję…' : 'Zarejestruj wizytę'}
            </button>
            {suma && suma.pozostalo === 0 && (
              <p className="md:col-span-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Limit konsultacji w pakiecie jest zajęty. Kolejna wizyta będzie płatna: 300 zł.
              </p>
            )}
          </form>

          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2">Historia wizyt</h4>
            {wizyty === null ? <p className="text-sm text-gray-500">Wczytuję…</p> : wizyty.length === 0 ? <p className="text-sm text-gray-500">Brak zarejestrowanych wizyt.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3 font-semibold">Data</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Rozliczenie</th><th className="py-2 pr-3 font-semibold">Źródło</th><th className="py-2 font-semibold">Uwagi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizyty.map((w) => {
                      const zamknieta = !AKTYWNE.includes(w.status);
                      return (
                        <tr key={w.id} className={`border-b border-gray-100 ${zamknieta ? 'text-gray-400' : 'text-gray-800'}`}>
                          <td className="py-2 pr-3 whitespace-nowrap">{w.data}{w.godzina ? `, ${w.godzina}` : ''}</td>
                          <td className="py-2 pr-3">
                            {zamknieta ? STATUSY[w.status] : (
                              <select value={w.status} disabled={czekam} onChange={(e) => zmienStatus(w, e.target.value as WizytaPsychiatry['status'])} className="px-2 py-1 text-sm border border-gray-300 rounded bg-white text-black" aria-label={`Status wizyty z ${w.data}`}>
                                {Object.entries(STATUSY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.rozliczenie === 'pakiet' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{w.rozliczenie === 'pakiet' ? 'w pakiecie' : 'płatna 300 zł'}</span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">{w.zrodlo === 'arkusz' ? 'formularz (arkusz)' : 'wpis w CRM'}</td>
                          <td className="py-2">{w.uwagi || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
