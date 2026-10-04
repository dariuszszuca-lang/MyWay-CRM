import { db } from '../firebaseConfig';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where,
} from 'firebase/firestore';
import { Room, RoomAssignment, ROOMS_SEED } from '../types';

const ROOMS = 'rooms';
const ASSIGNMENTS = 'roomAssignments';

const stripUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: Partial<T> = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// --- ROOMS CRUD ---
export async function createRoom(data: Omit<Room, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, ROOMS), stripUndefined(data));
  return ref.id;
}

export async function updateRoom(id: string, data: Partial<Omit<Room, 'id'>>): Promise<void> {
  await updateDoc(doc(db, ROOMS, id), stripUndefined(data) as any);
}

export async function deleteRoom(id: string): Promise<void> {
  await deleteDoc(doc(db, ROOMS, id));
}

export async function seedRooms(): Promise<number> {
  const snap = await getDocs(collection(db, ROOMS));
  if (!snap.empty) return 0;
  const batch = writeBatch(db);
  for (const r of ROOMS_SEED) {
    const ref = doc(collection(db, ROOMS));
    batch.set(ref, stripUndefined(r));
  }
  await batch.commit();
  return ROOMS_SEED.length;
}

// --- ASSIGNMENTS CRUD ---
export async function createAssignment(data: Omit<RoomAssignment, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, ASSIGNMENTS), stripUndefined({
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
  }));
  return ref.id;
}

export async function updateAssignment(id: string, data: Partial<Omit<RoomAssignment, 'id'>>): Promise<void> {
  await updateDoc(doc(db, ASSIGNMENTS, id), stripUndefined(data) as any);
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, ASSIGNMENTS, id));
}

// Zamknij aktualne przypisanie (np. gdy pacjent zmienia pokój / kończy pobyt)
export async function closeAssignment(id: string, toDate: string): Promise<void> {
  await updateDoc(doc(db, ASSIGNMENTS, id), { toDate });
}

// Sync: gdy pacjent zmienia treatmentEndDate, zaktualizuj toDate w przypisaniach,
// ale TYLKO te które były wcześniej zsynchronizowane (toDate === oldEndDate).
// Pomijamy: toDate=null (open-ended, raporty już używają Patient.treatmentEndDate),
// historyczne (toDate w przeszłości), i te z różną datą (admin świadomie ustawił).
// Zwraca liczbę zaktualizowanych przypisań.
export async function syncAssignmentsToPatientEndDate(args: {
  patientId: string;
  oldEndDate: string | undefined;
  newEndDate: string | undefined;
}): Promise<number> {
  const { patientId, oldEndDate, newEndDate } = args;
  if (!oldEndDate || !newEndDate || oldEndDate === newEndDate) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;

  const snap = await getDocs(query(
    collection(db, ASSIGNMENTS),
    where('patientId', '==', patientId),
  ));

  for (const docSnap of snap.docs) {
    const a = docSnap.data() as RoomAssignment;
    if (a.toDate === null || a.toDate === undefined) continue; // open-ended → zostaw
    if (a.toDate < today) continue;                            // historyczne → zostaw
    if (a.toDate !== oldEndDate) continue;                     // admin zmienił → zostaw
    await updateDoc(doc(db, ASSIGNMENTS, docSnap.id), { toDate: newEndDate });
    updated++;
  }
  return updated;
}

// Przesuń pacjenta do innego pokoju: zamknij stare, otwórz nowe
export async function movePatientToRoom(args: {
  patientId: string;
  oldAssignmentId: string | null;
  newRoomId: string;
  fromDate: string;       // od kiedy w nowym pokoju
  toDate?: string | null; // opcjonalnie: do kiedy (default null = "do odwołania")
  notes?: string;
}): Promise<string> {
  const { patientId, oldAssignmentId, newRoomId, fromDate, toDate, notes } = args;
  if (oldAssignmentId) {
    // toDate stare = fromDate nowego (zazwyczaj)
    await closeAssignment(oldAssignmentId, fromDate);
  }
  return await createAssignment({
    patientId,
    roomId: newRoomId,
    fromDate,
    toDate: toDate ?? null,
    notes,
    createdAt: new Date().toISOString(),
  });
}
