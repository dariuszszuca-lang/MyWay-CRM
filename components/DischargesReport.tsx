import React, { useMemo, useState } from 'react';
import { Patient, Room, RoomAssignment, formatCurrency, getAmountDue, isCurrentAssignment } from '../types';
import { Download, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadFonts } from '../services/pdfGenerator';

interface Props {
  patients: Patient[];
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

const DischargesReport: React.FC<Props> = ({ patients, rooms, assignments }) => {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 13));
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [showStayRange, setShowStayRange] = useState(false);
  const [showPesel, setShowPesel] = useState(false);

  const filtered = useMemo(() => {
    return patients
      .filter(p => p.status !== 'discharged')
      .filter(p => p.treatmentEndDate && p.treatmentEndDate >= from && p.treatmentEndDate <= to)
      .sort((a, b) => (a.treatmentEndDate || '').localeCompare(b.treatmentEndDate || ''));
  }, [patients, from, to]);

  const roomFor = (p: Patient): string => {
    const assignment = assignments.find(a => a.patientId === p.id && isCurrentAssignment(a));
    if (!assignment) return '—';
    const room = rooms.find(r => r.id === assignment.roomId);
    return room ? room.number : '—';
  };

  const paymentStatus = (p: Patient): { label: string; due: number } => {
    const due = getAmountDue(p);
    if (due <= 0) return { label: 'Opłacone', due: 0 };
    return { label: `Zaległość: ${formatCurrency(due)}`, due };
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    await loadFonts(doc);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text(`Raport wypisów MyWay — ${formatDay(from)} – ${formatDay(to)}`, 40, 30);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}  ·  Liczba pacjentów: ${filtered.length}`, 40, 46);

    const headRow: string[] = ['Data wyjścia', 'Imię i nazwisko'];
    if (showBirthDate) headRow.push('Data ur.');
    if (showStayRange) headRow.push('Pobyt');
    if (showPesel) headRow.push('PESEL');
    headRow.push('Pokój', 'Status płatności');

    const body = filtered.map(p => {
      const ps = paymentStatus(p);
      const row: any[] = [
        formatDay(p.treatmentEndDate),
        `${p.firstName} ${p.lastName}`,
      ];
      if (showBirthDate) row.push(formatDay(p.birthDate));
      if (showStayRange) row.push(`${formatDay(p.treatmentStartDate)} – ${formatDay(p.treatmentEndDate)}`);
      if (showPesel) row.push(p.pesel || '—');
      row.push(`Pokój ${roomFor(p)}`, ps.label);
      return row;
    });

    autoTable(doc, {
      head: [headRow], body,
      startY: 60,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [13, 79, 79], textColor: 255 },
      didParseCell: (data: any) => {
        // Czerwone podświetlenie zaległości
        if (data.section === 'body' && data.column.index === headRow.length - 1) {
          const raw = String(data.cell.raw || '');
          if (raw.startsWith('Zaległość')) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`raport-wypisow-${from}-${to}.pdf`);
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

        <div className="border-t pt-3 mb-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Pola opcjonalne (uważaj na RODO przy druku):</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showBirthDate} onChange={e => setShowBirthDate(e.target.checked)} />
              Data urodzenia
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showStayRange} onChange={e => setShowStayRange(e.target.checked)} />
              Zakres pobytu (od–do)
            </label>
            <label className="flex items-center gap-2 text-amber-700">
              <input type="checkbox" checked={showPesel} onChange={e => setShowPesel(e.target.checked)} />
              <AlertTriangle className="w-3 h-3" />
              PESEL (RODO — tylko gdy konieczne)
            </label>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Raport obejmuje aktywnych pacjentów z planowaną datą zakończenia terapii w wybranym zakresie.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Data wyjścia</th>
                <th className="border px-2 py-2 text-left">Imię i nazwisko</th>
                {showBirthDate && <th className="border px-2 py-2 text-left">Data ur.</th>}
                {showStayRange && <th className="border px-2 py-2 text-left">Pobyt</th>}
                {showPesel && <th className="border px-2 py-2 text-left">PESEL</th>}
                <th className="border px-2 py-2 text-center">Pokój</th>
                <th className="border px-2 py-2 text-left">Status płatności</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const ps = paymentStatus(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="border px-2 py-2">{formatDay(p.treatmentEndDate)}</td>
                    <td className="border px-2 py-2 font-medium">{p.firstName} {p.lastName}</td>
                    {showBirthDate && <td className="border px-2 py-2">{formatDay(p.birthDate)}</td>}
                    {showStayRange && <td className="border px-2 py-2 text-xs">{formatDay(p.treatmentStartDate)} – {formatDay(p.treatmentEndDate)}</td>}
                    {showPesel && <td className="border px-2 py-2 font-mono text-xs">{p.pesel || '—'}</td>}
                    <td className="border px-2 py-2 text-center">{roomFor(p)}</td>
                    <td className={`border px-2 py-2 ${ps.due > 0 ? 'text-red-700 font-bold' : 'text-green-700'}`}>
                      {ps.label}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4 + (showBirthDate ? 1 : 0) + (showStayRange ? 1 : 0) + (showPesel ? 1 : 0)} className="text-center text-gray-400 py-8">Brak planowanych wypisów w tym zakresie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DischargesReport;
