import React, { useMemo, useState } from 'react';
import { QueuePatient, Room, RoomAssignment, formatCurrency } from '../types';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadFonts } from '../services/pdfGenerator';

interface Props {
  queue: QueuePatient[];
  rooms: Room[];
  assignments: RoomAssignment[];
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number): string => {
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const formatDay = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const PACKAGE_LABEL: Record<string, string> = {
  '1': 'Pakiet 1',
  '2': 'Pakiet 2',
  '3': 'Pakiet 3',
  '6tyg': '6 tygodni',
  '8tyg': '8 tygodni',
  '6tyg_roz': '6 tyg. (rozłożony)',
  '8tyg_roz': '8 tyg. (rozłożony)',
  'interwencyjna': 'Interwencyjna',
  'vip': 'VIP',
};

const AdmissionsReport: React.FC<Props> = ({ queue, rooms, assignments }) => {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 13));

  const filtered = useMemo(() => {
    return queue
      .filter(q => q.status === 'confirmed')
      .filter(q => q.plannedStartDate && q.plannedStartDate >= from && q.plannedStartDate <= to)
      .sort((a, b) => {
        const cmp = (a.plannedStartDate || '').localeCompare(b.plannedStartDate || '');
        if (cmp !== 0) return cmp;
        return (a.plannedArrivalTime || '').localeCompare(b.plannedArrivalTime || '');
      });
  }, [queue, from, to]);

  // Numer pokoju dla queue patient: szukaj po queuePatientId, fallback po linkedPatientId
  const roomFor = (q: QueuePatient): string => {
    let assignment = assignments.find(a => a.queuePatientId === q.id && a.toDate === null);
    if (!assignment && q.linkedPatientId) {
      assignment = assignments.find(a => a.patientId === q.linkedPatientId && a.toDate === null);
    }
    if (!assignment) return '—';
    const room = rooms.find(r => r.id === assignment!.roomId);
    return room ? room.number : '—';
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    await loadFonts(doc);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text(`Raport przyjęć MyWay — ${formatDay(from)} – ${formatDay(to)}`, 40, 30);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}  ·  Liczba pacjentów: ${filtered.length}`, 40, 46);

    const head = [['Data', 'Godz.', 'Imię i nazwisko', 'Telefon', 'Pakiet', 'Zaliczka', 'Pokój', 'Uwagi']];
    const body = filtered.map(q => [
      formatDay(q.plannedStartDate),
      q.plannedArrivalTime || '—',
      `${q.firstName} ${q.lastName}`,
      q.phone || '—',
      PACKAGE_LABEL[q.package] || q.package,
      q.depositAmount > 0 ? formatCurrency(q.depositAmount) : '—',
      `Pokój ${roomFor(q)}`,
      q.notes || '—',
    ]);

    autoTable(doc, {
      head, body,
      startY: 60,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [13, 79, 79], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 45, halign: 'center' },
        2: { cellWidth: 130, fontStyle: 'bold' },
        3: { cellWidth: 80 },
        4: { cellWidth: 80 },
        5: { cellWidth: 65, halign: 'right' },
        6: { cellWidth: 60, halign: 'center' },
        7: { cellWidth: 'auto' },
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`raport-przyjec-${from}-${to}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Od</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Do</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setFrom(today()); setTo(today()); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">Dziś</button>
            <button onClick={() => { setFrom(today()); setTo(addDays(today(), 6)); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">7 dni</button>
            <button onClick={() => { setFrom(today()); setTo(addDays(today(), 29)); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">30 dni</button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-600">Liczba: <strong>{filtered.length}</strong></span>
            <button
              onClick={exportPDF}
              disabled={filtered.length === 0}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Pobierz PDF
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Raport obejmuje pacjentów z kolejki ze statusem <strong>potwierdzony</strong> i planowaną datą przyjazdu w wybranym zakresie.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-900">
          <strong>Jak przypisać pokój pacjentowi z kolejki?</strong>
          <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
            <li>Otwórz zakładkę <strong>Pokoje</strong> (górna nawigacja)</li>
            <li>Sub-tab <strong>Przypisania</strong></li>
            <li>W liście wyboru pacjenta zjedź do sekcji <strong>„Z kolejki — potwierdzeni"</strong></li>
            <li>Wybierz pacjenta — daty pobytu wypełnią się automatycznie z kolejki</li>
            <li>Wybierz pokój i kliknij <strong>Zarezerwuj</strong></li>
          </ol>
          <div className="text-xs mt-2">Po przypisaniu numer pokoju pojawi się tu w kolumnie „Pokój".</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Data</th>
                <th className="border px-2 py-2 text-left">Godz.</th>
                <th className="border px-2 py-2 text-left">Imię i nazwisko</th>
                <th className="border px-2 py-2 text-left">Telefon</th>
                <th className="border px-2 py-2 text-left">Pakiet</th>
                <th className="border px-2 py-2 text-right">Zaliczka</th>
                <th className="border px-2 py-2 text-center">Pokój</th>
                <th className="border px-2 py-2 text-left">Uwagi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="border px-2 py-2">{formatDay(q.plannedStartDate)}</td>
                  <td className="border px-2 py-2 text-center font-medium">{q.plannedArrivalTime || '—'}</td>
                  <td className="border px-2 py-2 font-medium">{q.firstName} {q.lastName}</td>
                  <td className="border px-2 py-2">{q.phone || '—'}</td>
                  <td className="border px-2 py-2">{PACKAGE_LABEL[q.package] || q.package}</td>
                  <td className="border px-2 py-2 text-right">{q.depositAmount > 0 ? formatCurrency(q.depositAmount) : '—'}</td>
                  <td className="border px-2 py-2 text-center">{roomFor(q)}</td>
                  <td className="border px-2 py-2 text-xs text-gray-600">{q.notes || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">Brak potwierdzonych przyjęć w tym zakresie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdmissionsReport;
