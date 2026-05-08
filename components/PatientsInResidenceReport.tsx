import React, { useMemo, useState } from 'react';
import { Patient, Room, RoomAssignment } from '../types';
import { Download, ArrowUp, ArrowDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadFonts } from '../services/pdfGenerator';

interface Props {
  patients: Patient[];
  rooms: Room[];
  assignments: RoomAssignment[];
}

type SortKey = 'lastName' | 'firstName' | 'treatmentStartDate' | 'treatmentEndDate' | 'room' | 'notes';
type SortDir = 'asc' | 'desc';

const formatDay = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

// Naturalne porównanie numerów pokoi: "1", "2", "10", "D" → 1, 2, 10, D (alfa po liczbach)
const compareRoom = (a: string, b: string): number => {
  const ai = parseInt(a, 10);
  const bi = parseInt(b, 10);
  const aIsNum = !isNaN(ai);
  const bIsNum = !isNaN(bi);
  if (aIsNum && bIsNum) return ai - bi;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;
  return a.localeCompare(b, 'pl');
};

interface Row {
  patient: Patient;
  roomNumber: string;
  roomNumberSortKey: string;
}

const PatientsInResidenceReport: React.FC<Props> = ({ patients, rooms, assignments }) => {
  const [sortBy, setSortBy] = useState<SortKey>('lastName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows: Row[] = useMemo(() => {
    const out: Row[] = patients
      .filter(p => p.status !== 'discharged')
      .map(p => {
        const assignment = assignments.find(a => a.patientId === p.id && a.toDate === null);
        const room = assignment ? rooms.find(r => r.id === assignment.roomId) : undefined;
        return {
          patient: p,
          roomNumber: room ? room.number : '—',
          roomNumberSortKey: room ? room.number : '￿', // bez pokoju leci na koniec
        };
      });

    out.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'lastName':
          cmp = a.patient.lastName.localeCompare(b.patient.lastName, 'pl');
          if (cmp === 0) cmp = a.patient.firstName.localeCompare(b.patient.firstName, 'pl');
          break;
        case 'firstName':
          cmp = a.patient.firstName.localeCompare(b.patient.firstName, 'pl');
          if (cmp === 0) cmp = a.patient.lastName.localeCompare(b.patient.lastName, 'pl');
          break;
        case 'treatmentStartDate':
          cmp = (a.patient.treatmentStartDate || '').localeCompare(b.patient.treatmentStartDate || '');
          break;
        case 'treatmentEndDate':
          cmp = (a.patient.treatmentEndDate || '').localeCompare(b.patient.treatmentEndDate || '');
          break;
        case 'room':
          cmp = compareRoom(a.roomNumberSortKey, b.roomNumberSortKey);
          break;
        case 'notes':
          cmp = (a.patient.notes || '').localeCompare(b.patient.notes || '', 'pl');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return out;
  }, [patients, rooms, assignments, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return <span className="text-gray-300 text-xs ml-1">↕</span>;
    return sortDir === 'asc'
      ? <ArrowUp className="inline w-3 h-3 ml-1" />
      : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    await loadFonts(doc);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.text(`Pacjenci w ośrodku — ${new Date().toLocaleDateString('pl-PL')}`, 40, 30);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    const sortLabel: Record<SortKey, string> = {
      lastName: 'Nazwisko', firstName: 'Imię',
      treatmentStartDate: 'Data wjazdu', treatmentEndDate: 'Data wyjazdu',
      room: 'Pokój', notes: 'Uwagi',
    };
    doc.text(`Liczba pacjentów: ${rows.length}  ·  Sortowanie: ${sortLabel[sortBy]} (${sortDir === 'asc' ? 'rosnąco' : 'malejąco'})`, 40, 46);

    const head = [['Imię i nazwisko', 'Wjazd', 'Wyjazd', 'Pokój', 'Uwagi']];
    const body = rows.map(r => [
      `${r.patient.firstName} ${r.patient.lastName}`,
      formatDay(r.patient.treatmentStartDate),
      formatDay(r.patient.treatmentEndDate),
      `Pokój ${r.roomNumber}`,
      r.patient.notes || '—',
    ]);

    autoTable(doc, {
      head, body,
      startY: 60,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [13, 79, 79], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 160, fontStyle: 'bold' },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 80, halign: 'center' },
        3: { cellWidth: 70, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`pacjenci-w-osrodku-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const headerBtn = (key: SortKey, label: string, extraClass = '') => (
    <th
      className={`border px-2 py-2 text-left cursor-pointer hover:bg-gray-100 select-none ${extraClass}`}
      onClick={() => toggleSort(key)}
      title="Kliknij, aby sortować"
    >
      {label}{sortIcon(key)}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Pacjenci w ośrodku</h2>
          <span className="text-sm text-gray-600">Liczba: <strong>{rows.length}</strong></span>
          <span className="text-xs text-gray-500">· Kliknij nagłówek kolumny aby zmienić sortowanie</span>
          <button
            onClick={exportPDF}
            disabled={rows.length === 0}
            className="ml-auto bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Pobierz PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {headerBtn('lastName', 'Nazwisko')}
                {headerBtn('firstName', 'Imię')}
                {headerBtn('treatmentStartDate', 'Wjazd')}
                {headerBtn('treatmentEndDate', 'Wyjazd')}
                {headerBtn('room', 'Pokój', 'text-center')}
                {headerBtn('notes', 'Uwagi')}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.patient.id} className="hover:bg-gray-50">
                  <td className="border px-2 py-2 font-medium">{r.patient.lastName}</td>
                  <td className="border px-2 py-2">{r.patient.firstName}</td>
                  <td className="border px-2 py-2 text-center">{formatDay(r.patient.treatmentStartDate)}</td>
                  <td className="border px-2 py-2 text-center">{formatDay(r.patient.treatmentEndDate)}</td>
                  <td className="border px-2 py-2 text-center font-medium">{r.roomNumber}</td>
                  <td className="border px-2 py-2 text-xs text-gray-600">{r.patient.notes || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">Brak aktywnych pacjentów.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientsInResidenceReport;
