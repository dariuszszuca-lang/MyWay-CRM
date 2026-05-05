import React, { useMemo, useState } from 'react';
import { Patient, Room, RoomAssignment } from '../types';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
const dateRange = (from: string, to: string): string[] => {
  const out: string[] = [];
  let d = from;
  while (d <= to) { out.push(d); d = addDays(d, 1); }
  return out;
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const formatDayShort = (iso: string) => {
  const d = new Date(iso);
  const wd = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'][d.getDay()];
  return `${wd} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const RoomTimelineReport: React.FC<Props> = ({ patients, rooms, assignments }) => {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 13));

  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => (a.order || 99) - (b.order || 99)), [rooms]);
  const days = useMemo(() => dateRange(from, to), [from, to]);

  // Dla każdego (pokój, dzień) — kto tam jest?
  const occupancyMatrix = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const room of sortedRooms) {
      map[room.id] = {};
      for (const day of days) {
        map[room.id][day] = [];
      }
    }
    for (const a of assignments) {
      if (!map[a.roomId]) continue;
      for (const day of days) {
        const inRange = a.fromDate <= day && (a.toDate === null || day < a.toDate);
        if (inRange) {
          const p = patients.find(pp => pp.id === a.patientId);
          const label = p ? `${p.firstName.charAt(0)}.${p.lastName}` : '?';
          map[a.roomId][day].push(label);
        }
      }
    }
    return map;
  }, [sortedRooms, days, assignments, patients]);

  const exportPDF = () => {
    const docPdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    docPdf.setFontSize(14);
    docPdf.text(`Plan pokoi MyWay — ${formatDay(from)} – ${formatDay(to)}`, 40, 30);
    docPdf.setFontSize(9);
    docPdf.text(`Wygenerowane: ${new Date().toLocaleString('pl-PL')}`, 40, 46);

    const head = [['Pokój / Pojemność', ...days.map(formatDayShort)]];
    const body = sortedRooms.map(room => {
      const cells: any[] = [`${room.number}\n(${room.capacity} os.)${room.isDisabled ? '\n[wyłączony]' : ''}`];
      for (const day of days) {
        const occ = occupancyMatrix[room.id][day];
        cells.push(occ.length === 0 ? '' : occ.join('\n'));
      }
      return cells;
    });

    autoTable(docPdf, {
      head, body,
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [13, 79, 79], textColor: 255, fontSize: 7 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const room = sortedRooms[data.row.index];
          const day = days[data.column.index - 1];
          const occ = occupancyMatrix[room.id][day];
          if (occ.length >= room.capacity && occ.length > 0) {
            data.cell.styles.fillColor = [254, 226, 226]; // pełny → różowo
          } else if (occ.length > 0) {
            data.cell.styles.fillColor = [220, 252, 231]; // zajęty → zielono
          }
          if (room.isDisabled) data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });

    docPdf.save(`plan-pokoi-${from}-${to}.pdf`);
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
            <button onClick={() => { setFrom(today()); setTo(addDays(today(), 6)); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">7 dni</button>
            <button onClick={() => { setFrom(today()); setTo(addDays(today(), 13)); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">14 dni</button>
            <button onClick={() => { setFrom(today()); setTo(addDays(today(), 29)); }} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded">30 dni</button>
          </div>
          <button
            onClick={exportPDF}
            className="ml-auto bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Pobierz PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-100 border px-2 py-2 text-left font-bold whitespace-nowrap z-10">Pokój</th>
                {days.map(d => (
                  <th key={d} className="border px-2 py-2 text-center font-medium bg-gray-50 whitespace-nowrap">
                    {formatDayShort(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRooms.map(room => (
                <tr key={room.id} className={room.isDisabled ? 'bg-gray-100' : ''}>
                  <td className="sticky left-0 border px-2 py-2 font-bold bg-white z-10 whitespace-nowrap">
                    Pokój {room.number}
                    <div className="text-xs text-gray-500 font-normal">{room.capacity} os.</div>
                    {room.isDisabled && <div className="text-xs text-red-600">wyłączony</div>}
                  </td>
                  {days.map(d => {
                    const occ = occupancyMatrix[room.id][d];
                    const isFull = occ.length >= room.capacity;
                    const bg = room.isDisabled ? 'bg-gray-100' : isFull ? 'bg-red-50' : occ.length > 0 ? 'bg-green-50' : 'bg-white';
                    return (
                      <td key={d} className={`border px-1 py-1 align-top ${bg}`}>
                        {occ.map((label, i) => (
                          <div key={i} className="bg-teal-100 text-teal-800 rounded px-1 py-0.5 mb-0.5 text-[10px] truncate">
                            {label}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sortedRooms.length === 0 && (
                <tr><td colSpan={days.length + 1} className="px-3 py-8 text-center text-gray-500">Brak pokoi.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 mt-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-50 border" /> zajęty</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border" /> pełny</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 border" /> wyłączony</span>
        </div>
      </div>
    </div>
  );
};

export default RoomTimelineReport;
