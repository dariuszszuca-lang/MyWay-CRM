import { db } from '../firebaseConfig';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch,
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

// Przesuń pacjenta do innego pokoju: zamknij stare, otwórz nowe
export async function movePatientToRoom(args: {
  patientId: string;
  oldAssignmentId: string | null;
  newRoomId: string;
  fromDate: string;       // od kiedy w nowym pokoju
  notes?: string;
}): Promise<string> {
  const { patientId, oldAssignmentId, newRoomId, fromDate, notes } = args;
  if (oldAssignmentId) {
    // toDate stare = fromDate nowego (zazwyczaj)
    await closeAssignment(oldAssignmentId, fromDate);
  }
  return await createAssignment({
    patientId,
    roomId: newRoomId,
    fromDate,
    toDate: null,
    notes,
    createdAt: new Date().toISOString(),
  });
}
