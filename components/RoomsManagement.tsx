import React, { useMemo, useState } from 'react';
import { Patient, QueuePatient, Room, RoomAssignment, getRoomOccupancy } from '../types';
import { createRoom, updateRoom, deleteRoom, seedRooms, deleteAssignment } from '../services/roomsService';
import { Plus, Edit2, Trash2, Check, X, AlertCircle, Database, AlertTriangle } from 'lucide-react';

interface Props {
  rooms: Room[];
  assignments: RoomAssignment[];
  patients?: Patient[];
  queue?: QueuePatient[];
}

const RoomsManagement: React.FC<Props> = ({ rooms, assignments, patients = [], queue = [] }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Room>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Room, 'id'>>({
    number: '', capacity: 2, isDisabled: false, order: 99,
  });

  const startEdit = (room: Room) => {
    setEditingId(room.id);
    setEditForm({ ...room });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateRoom(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      alert('Błąd zapisu: ' + (e as Error).message);
    }
  };

  const handleDelete = async (room: Room) => {
    const occ = getRoomOccupancy(room.id, assignments);
    if (occ > 0) {
      alert(`Nie można usunąć pokoju ${room.number} — jest w nim ${occ} pacjentów.`);
      return;
    }
    if (!confirm(`Usunąć pokój ${room.number}?`)) return;
    try { await deleteRoom(room.id); }
    catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  const handleAdd = async () => {
    if (!addForm.number.trim() || addForm.capacity < 1) {
      alert('Numer pokoju i pojemność są wymagane.');
      return;
    }
    try {
      await createRoom(addForm);
      setShowAdd(false);
      setAddForm({ number: '', capacity: 2, isDisabled: false, order: 99 });
    } catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  const handleSeed = async () => {
    if (!confirm('Wgrać 10 startowych pokoi (1-8, D, 10)? Zadziała tylko gdy lista jest pusta.')) return;
    try {
      const n = await seedRooms();
      if (n === 0) alert('Lista pokoi nie jest pusta — seed pominięty.');
      else alert(`Dodano ${n} pokoi.`);
    } catch (e) { alert('Błąd: ' + (e as Error).message); }
  };

  const sortedRooms = [...rooms].sort((a, b) => (a.order || 99) - (b.order || 99));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">Pokoje ({rooms.length})</h2>
        <div className="flex gap-2">
          {rooms.length === 0 && (
            <button
              onClick={handleSeed}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Database className="w-4 h-4" /> Wgraj 10 startowych pokoi
            </button>
          )}
          <button
            onClick={() => setShowAdd(s => !s)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Dodaj pokój
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text" placeholder="Numer (np. 11)"
              value={addForm.number}
              onChange={e => setAddForm({ ...addForm, number: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="number" min={1} placeholder="Pojemność"
              value={addForm.capacity}
              onChange={e => setAddForm({ ...addForm, capacity: parseInt(e.target.value) || 0 })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="number" placeholder="Kolejność"
              value={addForm.order || 99}
              onChange={e => setAddForm({ ...addForm, order: parseInt(e.target.value) || 99 })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text" placeholder="Notatki"
              value={addForm.notes || ''}
              onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium">
              Zapisz
            </button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm">
              Anuluj
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-700">
              <th className="px-3 py-2">Pokój</th>
              <th className="px-3 py-2">Pojemność</th>
              <th className="px-3 py-2">Zajęte</th>
              <th className="px-3 py-2">Notatki</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedRooms.map(room => {
              const occ = getRoomOccupancy(room.id, assignments);
              const isFull = occ >= room.capacity;
              const isEditing = editingId === room.id;
              return (
                <tr key={room.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold text-teal-700">
                    {isEditing ? (
                      <input
                        type="text" value={editForm.number || ''}
                        onChange={e => setEditForm({ ...editForm, number: e.target.value })}
                        className="border rounded px-2 py-1 w-16"
                      />
                    ) : `Pokój ${room.number}`}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number" min={1} value={editForm.capacity || 1}
                        onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 1 })}
                        className="border rounded px-2 py-1 w-16"
                      />
                    ) : `${room.capacity} os.`}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${isFull ? 'text-red-600' : occ === 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                      {occ}/{room.capacity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {isEditing ? (
                      <input
                        type="text" value={editForm.notes || ''}
                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        className="border rounded px-2 py-1 w-full"
                      />
                    ) : (room.notes || '—')}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="space-y-1">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox" checked={editForm.isDisabled || false}
                            onChange={e => setEditForm({ ...editForm, isDisabled: e.target.checked })}
                          />
                          <span className="text-xs">Wyłączony</span>
                        </label>
                        {editForm.isDisabled && (
                          <input
                            type="text" placeholder="Powód"
                            value={editForm.disabledReason || ''}
                            onChange={e => setEditForm({ ...editForm, disabledReason: e.target.value })}
                            className="border rounded px-2 py-1 text-xs w-full"
                          />
                        )}
                      </div>
                    ) : room.isDisabled ? (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Wyłączony{room.disabledReason ? ` (${room.disabledReason})` : ''}
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                        Aktywny
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="text-green-600 hover:text-green-800" title="Zapisz">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-gray-500 hover:text-gray-700" title="Anuluj">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(room)} className="text-blue-600 hover:text-blue-800" title="Edytuj">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(room)} className="text-red-600 hover:text-red-800" title="Usuń">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedRooms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Brak pokoi. Wgraj 10 startowych pokoi albo dodaj ręcznie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <OrphanAssignmentsSection
        rooms={rooms}
        assignments={assignments}
        patients={patients}
        queue={queue}
      />
    </div>
  );
};

// --- Niewykorzystane rezerwacje (sieroty) ---

interface OrphanProps {
  rooms: Room[];
  assignments: RoomAssignment[];
  patients: Patient[];
  queue: QueuePatient[];
}

const OrphanAssignmentsSection: React.FC<OrphanProps> = ({ rooms, assignments, patients, queue }) => {
  const orphans = useMemo(() => {
    const pIds = new Set(patients.map(p => p.id));
    const qIds = new Set(queue.map(q => q.id));
    return assignments.filter(a => {
      const hasP = !!a.patientId && pIds.has(a.patientId);
      const hasQ = !!a.queuePatientId && qIds.has(a.queuePatientId);
      return !hasP && !hasQ;
    });
  }, [assignments, patients, queue]);

  const handleDelete = async (a: RoomAssignment) => {
    const room = rooms.find(r => r.id === a.roomId);
    const roomLabel = room ? `pokój ${room.number}` : `roomId ${a.roomId}`;
    const dateLabel = `${a.fromDate} → ${a.toDate || 'teraz'}`;
    if (!confirm(`Usunąć osieroconą rezerwację (${roomLabel}, ${dateLabel})?\n\nTo działanie jest nieodwracalne. Wpis zostanie skasowany z bazy.`)) return;
    try {
      await deleteAssignment(a.id);
    } catch (e) {
      alert('Błąd: ' + (e as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${orphans.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
          <h3 className="font-bold text-gray-900">Niewykorzystane rezerwacje</h3>
          {orphans.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded">
              {orphans.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-600 mb-3">
          Tu trafiają rezerwacje pokoju, których pacjent (z bazy lub kolejki) już nie istnieje.
          Najczęstszy przypadek: pacjent został przyjęty z kolejki przed wprowadzeniem migracji rezerwacji
          i jego stara rezerwacja osierociała. Plan tygodnia pokazuje wtedy „?" w pokoju.
          Usunięcie wpisu naprawia tę sytuację.
        </p>

        {orphans.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            ✓ Brak osieroconych rezerwacji. Wszystkie wpisy w bazie wskazują na istniejących pacjentów lub kolejkę.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-2 text-left">Pokój</th>
                <th className="border px-2 py-2 text-left">Od</th>
                <th className="border px-2 py-2 text-left">Do</th>
                <th className="border px-2 py-2 text-left">Notatka</th>
                <th className="border px-2 py-2 text-left">Powód osierocenia</th>
                <th className="border px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orphans.map(a => {
                const room = rooms.find(r => r.id === a.roomId);
                let reason = '';
                if (a.queuePatientId) reason = `nieistniejący queue (${a.queuePatientId.slice(0, 6)}…)`;
                else if (a.patientId) reason = `nieistniejący patient (${a.patientId.slice(0, 6)}…)`;
                else reason = 'brak patientId i queuePatientId';
                return (
                  <tr key={a.id} className="hover:bg-amber-50">
                    <td className="border px-2 py-2 font-medium">{room ? `Pokój ${room.number}` : a.roomId}</td>
                    <td className="border px-2 py-2">{a.fromDate}</td>
                    <td className="border px-2 py-2">{a.toDate || <span className="text-gray-400">teraz</span>}</td>
                    <td className="border px-2 py-2 text-xs text-gray-600">{a.notes || '—'}</td>
                    <td className="border px-2 py-2 text-xs text-gray-500">{reason}</td>
                    <td className="border px-2 py-2 text-right">
                      <button
                        onClick={() => handleDelete(a)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1"
                        title="Usuń osieroconą rezerwację"
                      >
                        <Trash2 className="w-3 h-3" /> Usuń
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RoomsManagement;
