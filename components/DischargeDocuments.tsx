import React, { useState } from 'react';
import { Download, Printer, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { Patient } from '../types';
import {
  availableDocuments, DOCUMENT_LABELS, generateDischargeDocument, documentFileName, DischargeDocumentKind,
} from '../services/dischargeDocuments';

interface Props {
  patient: Patient;
  compact?: boolean; // true = w wierszu listy (zwinięte pod przyciskiem), false = pełna lista (modal wypisu)
}

// Dokumenty wypisowe: dyplom i zaświadczenie o ukończeniu tylko po zakończonej terapii,
// zaświadczenia o pobycie i uczestnictwie także dla aktywnych pacjentów (daty do dziś).
const DischargeDocuments: React.FC<Props> = ({ patient, compact = false }) => {
  const [open, setOpen] = useState(!compact);
  const [busy, setBusy] = useState<string | null>(null);
  const kinds = availableDocuments(patient);

  const run = async (kind: DischargeDocumentKind, mode: 'download' | 'print') => {
    setBusy(`${kind}:${mode}`);
    try {
      const doc = await generateDischargeDocument(kind, patient);
      if (mode === 'download') {
        doc.save(documentFileName(kind, patient));
      } else {
        const url = String(doc.output('bloburl'));
        const win = window.open(url, '_blank');
        if (!win) alert('Przeglądarka zablokowała nowe okno. Pobierz PDF i wydrukuj z pliku.');
      }
    } catch (err) {
      console.error('Dokument wypisowy:', err);
      alert('Nie udało się przygotować dokumentu. Sprawdź połączenie z internetem (fonty) i spróbuj ponownie.');
    } finally {
      setBusy(null);
    }
  };

  const list = (
    <div className={compact ? 'mt-1 space-y-1 text-left' : 'space-y-2'}>
      {kinds.map(kind => (
        <div key={kind} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <span className="text-xs text-gray-800">{DOCUMENT_LABELS[kind]}</span>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => run(kind, 'download')}
              disabled={busy !== null}
              className="p-1.5 rounded border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
              title="Pobierz PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => run(kind, 'print')}
              disabled={busy !== null}
              className="p-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Drukuj (podgląd w nowej karcie)"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  if (!compact) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg mb-4">
        <div className="font-semibold text-sm text-gray-900 mb-2 flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          Dokumenty do wydania
        </div>
        {list}
        {kinds.length < 4 && (
          <div className="mt-2 text-[11px] text-gray-500">Dyplom i zaświadczenie o ukończeniu są dostępne po wypisie z powodem „Zakończenie terapii”.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-xs font-semibold"
        title="Dyplom i zaświadczenia (PDF / wydruk)"
      >
        <ScrollText className="w-3 h-3" />
        Zaświadczenia ({kinds.length})
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && list}
    </div>
  );
};

export default DischargeDocuments;
