import React, { useMemo } from 'react';
import { Patient, Room, RoomAssignment } from '../types';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadFonts } from '../services/pdfGenerator';

interface Props {
  patients: Patient[];
  rooms: Room[];
  assignments: RoomAssignment[];
}

const today = () => new Date().toISOString().slice(0, 10);
const formatDay = (iso: string) => {
  if (!iso) return '?';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

interface RoomFreeInfo {
  room: Room;
  freeFrom: string | null;     // null = wolny już teraz
  occupants: { name: string; endDate: string | null }[];
  isFullForever: boolean;     // pełny i nikt nie ma planowanej daty wypisu
}

const RoomAvailabilityReport: React.FC<Props> = ({ patients, rooms, assignments }) => {
  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => (a.order || 99) - (b.order || 99)), [rooms]);
  const t = today();

  const info: RoomFreeInfo[] = useMemo(() => {
    return sortedRooms.map(room => {
      const current = assignments.filter(a => a.roomId === room.id && a.toDate === null);
      const occupants = current.map(a => {
        const p = patients.find(pp => pp.id === a.patientId);
        return {
          name: p ? `${p.firstName} ${p.lastName}` : 'nieznany',
          endDate: p?.treatmentEndDate || null,
        };
      });

      if (room.isDisabled) {
        return { room, freeFrom: null, occupants, isFullForever: false };
      }

      const free = current.length < room.capacity;
      if (free) return { room, freeFrom: t, occupants, isFullForever: false };

      // Pełny — szukamy najwcześniejszej daty wypisu
      const dates = occupants.map(o => o.endDate).filter((d): d is string => !!d).sort();
      if (dates.length === 0) {
        return { room, freeFrom: null, occupants, isFullForever: true };
      }
      // Pokój zwolni się gdy odejdzie najwcześniej kończący → spadnie poniżej capacity
      // Jeśli wszyscy mają daty, pierwsze miejsce zwolni się przy najwcześniejszej dacie
      return { room, freeFrom: dates[0], occupants, isFullForever: false };
    });
  }, [sortedRooms, assignments, patients, t]);

  const exportPDF = async () => {
    const docPdf = new jsPDF({ unit: 'pt', format: 'a4' });
    // Roboto z polskimi znakami — bez tego ą/ę/ś/ć rozjeżdżają się w PDF.
    await loadFonts(docPdf);
    docPdf.setFont('Roboto', 'bold');
    docPdf.setFontSize(16);
    docPdf.text('Wolne pokoje — raport MyWay', 40, 40);
    docPdf.setFont('Roboto', 'normal');
    docPdf.setFontSize(9);
    docPdf.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`, 40, 56);

    const head = [['Pokój', 'Pojemność', 'Zajęte', 'Wolny od', 'Aktualni mieszkańcy']];
    const body = info.map(({ room, freeFrom, occupants, isFullForever }) => {
      let freeStr: string;
      if (room.isDisabled) freeStr = `WYŁĄCZONY${room.disabledReason ? ' (' + room.disabledReason + ')' : ''}`;
      else if (freeFrom === t) freeStr = 'wolny TERAZ';
      else if (freeFrom) freeStr = `od ${formatDay(freeFrom)}`;
      else if (isFullForever) freeStr = 'pełny — brak dat wypisu';
      else freeStr = '?';

      const occStr = occupants.length === 0
        ? '—'
        : occupants.map(o => `${o.name}${o.endDate ? ` (do ${formatDay(o.endDate)})` : ''}`).join('\n');

      return [
        `Pokój ${room.number}${room.notes ? '\n(' + room.notes + ')' : ''}`,
        `${room.capacity} os.`,
        `${occupants.length}/${room.capacity}`,
        freeStr,
        occStr,
      ];
    });

    autoTable(docPdf, {
      head, body,
      startY: 70,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [13, 79, 79], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: 'bold' },
        1: { cellWidth: 60, halign: 'center' },
        2: { cellWidth: 50, halign: 'center' },
        3: { cellWidth: 110 },
        4: { cellWidth: 'auto' },
      },
      margin: { left: 40, right: 40 },
    });

    docPdf.save(`wolne-pokoje-${t}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Wolne pokoje — stan na dziś</h2>
          <button
            onClick={exportPDF}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Pobierz PDF
          </button>
        </div>

        <div className="space-y-2">
          {info.map(({ room, freeFrom, occupants, isFullForever }) => {
            let badge: React.ReactNode;
            if (room.isDisabled) {
              badge = (
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Wyłączony{room.disabledReason ? ` (${room.disabledReason})` : ''}
                </span>
              );
            } else if (freeFrom === t) {
              badge = (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Wolny TERAZ
                </span>
              );
            } else if (freeFrom) {
              badge = (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-medium">
                  Wolny od {formatDay(freeFrom)}
                </span>
              );
            } else if (isFullForever) {
              badge = (
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                  Pełny — brak dat wypisu
                </span>
              );
            }

            return (
              <div key={room.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <strong className="text-gray-900">Pokój {room.number}</strong>
                    <span className="text-xs text-gray-500">{room.capacity} os.</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs">
                      Zajęte: <strong className={occupants.length >= room.capacity ? 'text-red-600' : 'text-teal-700'}>
                        {occupants.length}/{room.capacity}
                      </strong>
                    </span>
                    {room.notes && <span className="text-xs text-gray-500">· {room.notes}</span>}
                  </div>
                  {occupants.length > 0 && (
                    <ul className="text-xs text-gray-600 mt-1 ml-1">
                      {occupants.map((o, i) => (
                        <li key={i}>
                          • {o.name}
                          {o.endDate && <span className="text-gray-400"> (planowany wypis: {formatDay(o.endDate)})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex-shrink-0">{badge}</div>
              </div>
            );
          })}
          {info.length === 0 && <p className="text-gray-500 text-center py-8">Brak pokoi w bazie.</p>}
        </div>
      </div>
    </div>
  );
};

export default RoomAvailabilityReport;
