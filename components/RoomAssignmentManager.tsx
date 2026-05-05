import React, { useState, useMemo } from 'react';
import { Patient, Room, RoomAssignment, getCurrentRoomAssignment, getRoomOccupancy } from '../types';
import { createAssignment, closeAssignment, deleteAssignment, movePatientToRoom } from '../services/roomsService';
import { UserPlus, Move, X, History, AlertTriangle } from 'lucide-react';

interface Props {
  patients: Patient[];
  rooms: Room[];
  assignments: RoomAssignment[];
}

const today = () => new Date().toISOString().slice(0, 10);

const RoomAssignmentManager: React.FC<Props> = ({ patients, rooms, assignments }) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [moveRoomId, setMoveRoomId] = useState<string>('');
  const [moveDate, setMoveDate] = useState<string>(today());
  const [moveNotes, setMoveNotes] = useState<string>('');
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);

  const activePatients = useMemo(() =>
    patients.filter(p => p.status !== 'discharged').sort((a, b) => a.lastName.localeCompare(b.lastName, 'pl')),
    [patients]
  );

  const sortedRooms = useMemo(() =>
    [...rooms].sort((a, b) => (a.order || 99) - (b.order || 99)),
    [rooms]
  );

  const selectedPatient = activePatients.find(p => p.id === selectedPatientId);
  const currentAssignment = selectedPatient ? getCurrentRoomAssignment(selectedPatient.id, assignments) : null;
  const currentRoom = currentAssignment ? rooms.find(r => r.id === currentAssignment.roomId) : null;

  const patientHistory = (patientId: string) =>
    assignments.filter(a => a.patientId === patientId).sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  const handleAssign = async () => {
    if (!selectedPatient || !moveRoomId) return alert('Wybierz pacjenta i pokój.');
    const room = rooms.find(r => r.id === moveRoomId);
    if (!room) return;
    if (room.isDisabled) return alert(`Pokój ${room.number} jest wyłączony (${room.disabledReason || 'brak powodu'}).`);
    const occ = getRoomOccupancy(room.id, assignments);
    if (occ >= room.capacity) {
      if (!confirm(`Pokój ${room.number} jest pełny (${occ}/${room.capacity}). Mimo to przypisać?`)) return;
    }
    try {
      if (currentAssignment) {
        if (currentAssignment.roomId === moveRoomId) {
          return alert(`${selectedPatient.firstName} jest już w pokoju ${room.number}.`);
        }
        await movePatientToRoom({
          patientId: selectedPatient.id,
          oldAssignmentId: currentAssignment.id,
          newRoomId: moveRoomId,
          fromDate: moveDate,
          notes: moveNotes || undefined,
        });
        alert(`${selectedPatient.firstName} przeniesiony do pokoju ${room.number}.`);
      } else {
        await createAssignment({
          patientId: selectedPatient.id,
          roomId: moveRoomId,
          fromDate: moveDate,
          toDate: null,
          notes: moveNotes || undefined,
          createdAt: new Date().toISOString(),
        });
        alert(`${selectedPatient.firstName} przypisany do pokoju ${room.number}.`);
      }
      setMoveRoomId('');
      setMoveNotes('');
    } catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  const handleEndStay = async () => {
    if (!currentAssignment || !selectedPatient) return;
    const date = prompt('Data wypisu z pokoju (YYYY-MM-DD):', today());
    if (!date) return;
    try {
      await closeAssignment(currentAssignment.id, date);
      alert(`${selectedPatient.firstName} wypisany z pokoju ${date}.`);
    } catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  const handleDeleteHistory = async (a: RoomAssignment) => {
    if (!confirm(`Usunąć wpis w historii: pokój ${rooms.find(r => r.id === a.roomId)?.number} (${a.fromDate} → ${a.toDate || 'teraz'})?`)) return;
    try { await deleteAssignment(a.id); }
    catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Przypisanie pokoju</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pacjent (aktywni: {activePatients.length})</label>
          <select
            value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">— Wybierz pacjenta —</option>
            {activePatients.map(p => (
              <option key={p.id} value={p.id}>
                {p.lastName} {p.firstName}
              </option>
            ))}
          </select>
        </div>

        {selectedPatient && (
          <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
              <span className="text-gray-500">·</span>
              <span>Terapia: {selectedPatient.treatmentStartDate || '?'} → {selectedPatient.treatmentEndDate || '?'}</span>
              <span className="text-gray-500">·</span>
              {currentRoom ? (
                <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-xs font-medium">
                  Aktualnie: pokój {currentRoom.number}
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-medium">
                  Brak przypisania
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={moveRoomId}
                onChange={e => setMoveRoomId(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">— Pokój —</option>
                {sortedRooms.map(r => {
                  const occ = getRoomOccupancy(r.id, assignments);
                  const label = `Pokój ${r.number} (${occ}/${r.capacity})${r.isDisabled ? ' — WYŁĄCZONY' : ''}${r.notes ? ' · ' + r.notes : ''}`;
                  return <option key={r.id} value={r.id}>{label}</option>;
                })}
              </select>
              <input
                type="date" value={moveDate}
                onChange={e => setMoveDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
              <input
                type="text" placeholder="Notatka (opcjonalnie)"
                value={moveNotes}
                onChange={e => setMoveNotes(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAssign}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1"
                >
                  {currentAssignment ? <><Move className="w-4 h-4" /> Przenieś</> : <><UserPlus className="w-4 h-4" /> Przypisz</>}
                </button>
                {currentAssignment && (
                  <button
                    onClick={handleEndStay}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-sm font-medium flex items-center gap-1"
                    title="Zakończ pobyt w pokoju"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setHistoryOpenFor(historyOpenFor === selectedPatient.id ? null : selectedPatient.id)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
            >
              <History className="w-3 h-3" />
              {historyOpenFor === selectedPatient.id ? 'Schowaj historię' : 'Pokaż historię pokoi'}
            </button>

            {historyOpenFor === selectedPatient.id && (
              <div className="border-t pt-2 mt-2">
                <h4 className="text-xs font-bold text-gray-600 mb-2">Historia pobytu w pokojach</h4>
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left pb-1">Pokój</th>
                      <th className="text-left pb-1">Od</th>
                      <th className="text-left pb-1">Do</th>
                      <th className="text-left pb-1">Notatka</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientHistory(selectedPatient.id).map(a => {
                      const r = rooms.find(rr => rr.id === a.roomId);
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="py-1 font-medium">{r ? `Pokój ${r.number}` : a.roomId}</td>
                          <td className="py-1">{a.fromDate}</td>
                          <td className="py-1">{a.toDate || <span className="text-teal-700 font-medium">teraz</span>}</td>
                          <td className="py-1 text-gray-500">{a.notes || '—'}</td>
                          <td className="py-1">
                            <button onClick={() => handleDeleteHistory(a)} className="text-red-500 hover:text-red-700">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {patientHistory(selectedPatient.id).length === 0 && (
                      <tr><td colSpan={5} className="py-2 text-gray-400">Brak wpisów.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista wszystkich aktualnie przypisanych */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Aktualnie w pokojach ({assignments.filter(a => a.toDate === null).length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedRooms.map(room => {
            const inRoom = assignments.filter(a => a.roomId === room.id && a.toDate === null);
            const occ = inRoom.length;
            const isFull = occ >= room.capacity;
            return (
              <div
                key={room.id}
                className={`border rounded-lg p-3 ${room.isDisabled ? 'bg-red-50 border-red-200' : isFull ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-900">Pokój {room.number}</span>
                  <span className={`text-xs font-medium ${isFull ? 'text-amber-700' : occ === 0 ? 'text-gray-400' : 'text-teal-700'}`}>
                    {occ}/{room.capacity}
                  </span>
                </div>
                {room.isDisabled && (
                  <div className="flex items-center gap-1 text-xs text-red-700 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Wyłączony{room.disabledReason ? ` (${room.disabledReason})` : ''}
                  </div>
                )}
                {inRoom.length === 0 ? (
                  <p className="text-xs text-gray-400">— pusty —</p>
                ) : (
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    {inRoom.map(a => {
                      const p = patients.find(pp => pp.id === a.patientId);
                      return (
                        <li key={a.id}>
                          {p ? `${p.firstName} ${p.lastName}` : <em>nieznany pacjent</em>}
                          <span className="text-gray-400 ml-1">(od {a.fromDate})</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoomAssignmentManager;
