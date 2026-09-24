import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Patient } from '../types';

interface Props {
  patient: Patient;
  onSave: (id: string, notes: string, originalNotes: string) => Promise<void>;
  onClose: () => void;
}

export default function PatientNotesPanel({ patient, onSave, onClose }: Props) {
  const originalNotes = patient.notes || '';
  const [notes, setNotes] = useState(originalNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);
  const dirty = notes !== originalNotes;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  const close = () => {
    if (savingRef.current) return;
    if (!dirty || window.confirm('Masz niezapisane zmiany. Zamknąć panel i je odrzucić?')) onClose();
  };

  const save = async () => {
    if (savingRef.current || !dirty) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(patient.id, notes, originalNotes);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error && !('code' in cause) ? cause.message : 'Nie udało się zapisać uwag. Sprawdź połączenie i spróbuj ponownie. Twój tekst pozostaje w panelu.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return createPortal(
    <dialog ref={dialog} aria-labelledby="patient-notes-title" onCancel={event => { event.preventDefault(); close(); }} className="fixed inset-y-0 left-auto right-0 m-0 h-[100dvh] max-h-none w-full max-w-[600px] border-0 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-slate-900/40">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 id="patient-notes-title" className="text-xl font-bold">Uwagi</h2>
            <p className="mt-1 break-words text-base text-gray-600">{patient.firstName} {patient.lastName}</p>
          </div>
          <button type="button" onClick={close} disabled={saving} aria-label="Zamknij uwagi" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-teal-600 disabled:opacity-50"><X className="h-6 w-6" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <label htmlFor="patient-notes-text" className="mb-2 text-sm font-semibold text-gray-700">Treść uwag</label>
          <textarea id="patient-notes-text" autoFocus value={notes} onChange={event => setNotes(event.target.value)} readOnly={saving} placeholder="Wpisz uwagi dotyczące pacjenta…" className="min-h-[220px] w-full flex-1 resize-none rounded-lg border border-gray-300 bg-yellow-50/50 p-4 text-base leading-7 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20" />
          <p className="mt-3 text-sm text-gray-500" role="status">{saving ? 'Zapisywanie…' : dirty ? 'Masz niezapisane zmiany.' : 'Zmiany zapiszesz przyciskiem poniżej.'}</p>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </div>
        <footer className="flex shrink-0 justify-end gap-3 border-t border-gray-200 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={close} disabled={saving} className="min-h-[44px] rounded-lg border border-gray-300 px-5 font-medium hover:bg-gray-50 disabled:opacity-50">Anuluj</button>
          <button type="button" onClick={save} disabled={saving || !dirty} className="min-h-[44px] rounded-lg bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
        </footer>
      </div>
    </dialog>, document.body
  );
}
