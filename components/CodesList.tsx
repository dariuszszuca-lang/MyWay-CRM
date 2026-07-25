import React, { useCallback, useEffect, useState } from 'react';
import { PromoCode, CodeFilter, codeState } from '../types';
import { listCodes, saveCodeNote } from '../services/ordersApi';
import {
  Ticket, CheckCircle, Clock, Gift, RefreshCw, Pencil, Save, X, Copy, Info,
} from 'lucide-react';

// Kody na darmowy Dziennik. Dwa niezależne stany:
//  - „Zrealizowany" wie Stripe (klient zapłacił tym kodem). Tego nie da się kliknąć ani cofnąć.
//  - „Wydany" zaznacza Marcin, bo Stripe nie wie, komu kod poszedł do ręki.
const AUTO_REFRESH_MS = 120_000;

const stateConfig = {
  free: { label: 'Wolny', color: 'bg-blue-100 text-blue-800 border-blue-200', pill: 'bg-blue-600', icon: Ticket },
  issued: { label: 'Wydany, nieużyty', color: 'bg-amber-100 text-amber-800 border-amber-200', pill: 'bg-amber-600', icon: Clock },
  redeemed: { label: 'Zrealizowany', color: 'bg-green-100 text-green-800 border-green-200', pill: 'bg-green-600', icon: CheckCircle },
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pl-PL') : '';

const CodesList: React.FC = () => {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CodeFilter>('all');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ issued: false, issuedTo: '', note: '' });
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await listCodes();
      setCodes(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  useEffect(() => {
    const timer = setInterval(() => { if (!editingCode) load(false); }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, editingCode]);

  const startEdit = (c: PromoCode) => {
    setEditingCode(c.code);
    setEditForm({ issued: c.issued, issuedTo: c.issuedTo || '', note: c.note || '' });
  };

  const handleSave = async (code: string) => {
    setSavingCode(code);
    try {
      await saveCodeNote(code, editForm);
      setEditingCode(null);
      await load(false);
    } catch (e) {
      window.alert(`Nie udało się zapisać: ${(e as Error).message}`);
    } finally {
      setSavingCode(null);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      window.alert(`Skopiuj ręcznie: ${code}`);
    }
  };

  const counts = {
    all: codes.length,
    free: codes.filter(c => codeState(c) === 'free').length,
    issued: codes.filter(c => codeState(c) === 'issued').length,
    redeemed: codes.filter(c => codeState(c) === 'redeemed').length,
  };

  const filtered = filter === 'all' ? codes : codes.filter(c => codeState(c) === filter);

  return (
    <div className="space-y-4">
      {/* Liczniki i odświeżanie */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-800">
          <Ticket className="w-3.5 h-3.5 inline mr-1" />
          Wolne: {counts.free}
        </div>
        <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-800">
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          Wydane, nieużyte: {counts.issued}
        </div>
        <div className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-medium text-green-800">
          <Gift className="w-3.5 h-3.5 inline mr-1" />
          Zrealizowane: {counts.redeemed}
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="ml-auto flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg text-xs flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          „Zrealizowany" ustawia sam Stripe, kiedy ktoś zapłaci tym kodem, i tego nie da się zmienić ani cofnąć.
          „Wydany" zaznaczasz sam, żeby pamiętać, komu kod poszedł, zanim zostanie użyty.
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong className="font-bold">Nie udało się pobrać kodów: </strong>{error}
        </div>
      )}

      {/* Filtry */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-1">
        {([
          ['all', `Wszystkie (${counts.all})`],
          ['free', `Wolne (${counts.free})`],
          ['issued', `Wydane, nieużyte (${counts.issued})`],
          ['redeemed', `Zrealizowane (${counts.redeemed})`],
        ] as [CodeFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === key
                ? key === 'all' ? 'bg-teal-600 text-white' : `${stateConfig[key].pill} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && codes.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
          Pobieram kody...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Kod</th>
                <th className="px-4 py-3 font-semibold">Rabat</th>
                <th className="px-4 py-3 font-semibold">Stan</th>
                <th className="px-4 py-3 font-semibold">Komu wydany</th>
                <th className="px-4 py-3 font-semibold">Notatka</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const state = codeState(c);
                const cfg = stateConfig[state];
                const StateIcon = cfg.icon;
                const isEditing = editingCode === c.code;
                const isSaving = savingCode === c.code;

                return (
                  <tr key={c.code} className={`border-b last:border-0 hover:bg-gray-50 ${state === 'redeemed' ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">{c.code}</span>
                        <button
                          onClick={() => handleCopy(c.code)}
                          className="text-gray-400 hover:text-teal-700 transition-colors"
                          title="Kopiuj kod"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedCode === c.code && <span className="text-xs text-teal-700">skopiowany</span>}
                      </div>
                      {c.couponName && <div className="text-xs text-gray-400 mt-0.5">{c.couponName}</div>}
                    </td>

                    <td className="px-4 py-3 align-top text-gray-800 whitespace-nowrap">{c.discount || 'brak danych'}</td>

                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        <StateIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {state === 'issued' && c.issuedAt && (
                        <div className="text-xs text-gray-400 mt-1">wydany {formatDate(c.issuedAt)}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={editForm.issued}
                              onChange={e => setEditForm({ ...editForm, issued: e.target.checked })}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            Wydany komuś
                          </label>
                          <input
                            type="text"
                            value={editForm.issuedTo}
                            onChange={e => setEditForm({ ...editForm, issuedTo: e.target.value })}
                            placeholder="imię, nazwisko albo skąd"
                            className="block w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-black focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-700">{c.issuedTo || <span className="text-gray-300">brak</span>}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.note}
                          onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                          placeholder="np. warsztat, festiwal, prezent"
                          className="block w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-black focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      ) : (
                        <span className="text-gray-600">{c.note || <span className="text-gray-300">brak</span>}</span>
                      )}
                      {!isEditing && c.updatedBy && (
                        <div className="text-xs text-gray-300 mt-0.5">{c.updatedBy}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSave(c.code)}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
                          >
                            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Zapisz
                          </button>
                          <button
                            onClick={() => setEditingCode(null)}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(c)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edytuj
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-gray-500">
              {codes.length === 0 ? 'Nie ma żadnych kodów.' : 'Nie ma kodów pasujących do filtra.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodesList;
