// Pokoje i przydziały przez API na AWS (gałąź aws). Te same nazwy funkcji co wcześniej,
// żeby komponenty pokoi nie wymagały zmian. Poprzednia wersja na Firestore: roomsService.firebase.ts.bak.
import { useEffect, useState } from 'react';
import { Room, RoomAssignment, ROOMS_SEED } from '../types';
import { api, BladApi, nasluchuj, zmieniono } from './aws/api';
import { AWS_CONFIG } from './aws/config';
import { pokojDoApi, pokojZApi, przydzialZApi } from './aws/mapowanie';

let pokojeCache: Room[] = [];

export async function pobierzPokoje(): Promise<Room[]> {
  pokojeCache = ((await api('GET', '/pokoje')).pokoje || []).map(pokojZApi);
  return pokojeCache;
}

export async function pobierzPrzydzialy(): Promise<RoomAssignment[]> {
  const lista: RoomAssignment[] = ((await api('GET', '/przydzialy')).przydzialy || []).map(przydzialZApi);
  return lista.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// Pokoje i przydziały z odświeżaniem co 20 s i od razu po każdej zmianie (zamiast nasłuchu Firestore).
export function usePokoje(): { rooms: Room[]; assignments: RoomAssignment[] } {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  useEffect(() => {
    let zywe = true;
    const wczytaj = async () => {
      try {
        const [r, a] = await Promise.all([pobierzPokoje(), pobierzPrzydzialy()]);
        if (zywe) { setRooms(r); setAssignments(a); }
      } catch (e) {
        console.error('Nie udało się pobrać pokoi:', (e as Error).message);
      }
    };
    wczytaj();
    const odlacz = nasluchuj('pokoje', wczytaj);
    const zegar = window.setInterval(wczytaj, AWS_CONFIG.odswiezanieMs);
    return () => { zywe = false; odlacz(); window.clearInterval(zegar); };
  }, []);
  return { rooms, assignments };
}

// --- ROOMS CRUD ---
export async function createRoom(data: Omit<Room, 'id'>): Promise<string> {
  const r = await api('POST', '/pokoje', pokojDoApi(data));
  zmieniono('pokoje');
  return r.id;
}

export async function updateRoom(id: string, data: Partial<Omit<Room, 'id'>>): Promise<void> {
  const obecny = pokojeCache.find((p) => p.id === id);
  if (!obecny) throw new Error('Dane pokoi są nieaktualne. Odśwież i spróbuj ponownie.');
  await api('PUT', `/pokoje/${id}`, { ...pokojDoApi(data), wersja: obecny.wersja });
  zmieniono('pokoje');
}

export async function deleteRoom(id: string): Promise<void> {
  await api('DELETE', `/pokoje/${id}`);
  zmieniono('pokoje');
}

export async function seedRooms(): Promise<number> {
  if ((await pobierzPokoje()).length > 0) return 0;
  for (const r of ROOMS_SEED) await api('POST', '/pokoje', pokojDoApi(r));
  zmieniono('pokoje');
  return ROOMS_SEED.length;
}

// --- ASSIGNMENTS CRUD ---
// Pełny pokój: serwer odmawia (409 pokoj-pelny) i podaje obłożenie. Dopiero wtedy pytamy o zgodę
// i ponawiamy z jawnym potwierdzeniem, które serwer zapisuje w dzienniku jako przydział ponad limit.
async function zPotwierdzeniemPelnego<T>(wyslij: (mimoPelnego: boolean) => Promise<T>): Promise<T> {
  try {
    return await wyslij(false);
  } catch (e) {
    if (e instanceof BladApi && e.kod === 'pokoj-pelny') {
      if (window.confirm(`${e.message.replace(' Aby przypisać mimo to, potwierdź (mimoPelnego).', '')}\n\nMimo to przypisać?`)) return wyslij(true);
      throw new Error('Anulowano: pokój jest pełny.');
    }
    throw e;
  }
}

const przydzialDoApi = (d: Omit<RoomAssignment, 'id' | 'createdAt'> & { createdAt?: string }, mimoPelnego: boolean) => ({
  ...(d.queuePatientId ? { kolejkaId: d.queuePatientId } : { pacjentId: d.patientId }),
  pokojId: d.roomId,
  odDaty: d.fromDate,
  ...(d.toDate ? { doDaty: d.toDate } : {}),
  ...(d.notes ? { notatki: d.notes } : {}),
  ...(mimoPelnego ? { mimoPelnego: true } : {}),
});

export async function createAssignment(data: Omit<RoomAssignment, 'id'>): Promise<string> {
  const r = await zPotwierdzeniemPelnego((m) => api('POST', '/przydzialy', przydzialDoApi(data, m)));
  zmieniono('pokoje');
  return r.id;
}

export async function updateAssignment(id: string, data: Partial<Omit<RoomAssignment, 'id'>>): Promise<void> {
  const cialo: Record<string, unknown> = {};
  if (data.fromDate !== undefined) cialo.odDaty = data.fromDate;
  if (data.toDate !== undefined) cialo.doDaty = data.toDate || '';
  if (data.notes !== undefined) cialo.notatki = data.notes || '';
  await api('PUT', `/przydzialy/${id}`, cialo);
  zmieniono('pokoje');
}

export async function deleteAssignment(id: string): Promise<void> {
  await api('DELETE', `/przydzialy/${id}`);
  zmieniono('pokoje');
}

// Zamknij aktualne przypisanie (np. gdy pacjent kończy pobyt w pokoju)
export async function closeAssignment(id: string, toDate: string): Promise<void> {
  await api('PUT', `/przydzialy/${id}`, { doDaty: toDate });
  zmieniono('pokoje');
}

// Przeniesienie: serwer zamyka stary przydział i otwiera nowy w jednej transakcji.
export async function movePatientToRoom(args: {
  patientId: string;
  oldAssignmentId: string | null;
  newRoomId: string;
  fromDate: string;
  toDate?: string | null;
  notes?: string;
}): Promise<string> {
  const r = await zPotwierdzeniemPelnego((m) => api('POST', '/przydzialy/przeniesienie', przydzialDoApi({
    patientId: args.patientId, roomId: args.newRoomId, fromDate: args.fromDate, toDate: args.toDate ?? null, notes: args.notes,
  }, m)));
  zmieniono('pokoje');
  return r.id;
}
