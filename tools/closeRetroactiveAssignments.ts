/*
 * Skrypt jednorazowy: zamknij wiszące przypisania pokoi dla pacjentów już wypisanych.
 *
 * KIEDY URUCHOMIĆ:
 *   Raz, po deployu Sprint 1 (Plan pokoi v2). Po tym auto-zwolnienie działa
 *   automatycznie przy każdym wypisie, więc skrypt nie będzie już potrzebny.
 *
 * CO ROBI:
 *   1. Pobiera wszystkich pacjentów ze status='discharged' i dischargeDate
 *   2. Dla każdego szuka aktywnych RoomAssignment (toDate=null)
 *   3. Zamyka je z toDate = patient.dischargeDate
 *
 * BEZPIECZEŃSTWO:
 *   - Domyślnie DRY_RUN = true (tylko loguje, nic nie zmienia)
 *   - Zmienić DRY_RUN na false dopiero PO obejrzeniu logów z dry-run
 *
 * JAK URUCHOMIĆ (najprostsza metoda — devtools console):
 *   1. Otwórz CRM w przeglądarce, zaloguj się
 *   2. Otwórz devtools (Cmd+Option+I) → zakładka Console
 *   3. Wklej zawartość TEGO pliku do konsoli
 *   4. Wywołaj: await closeRetroactiveAssignments(true)   // DRY-RUN
 *   5. Sprawdź log — ile assignmentów zostanie zamkniętych, dla kogo
 *   6. Jeśli OK: await closeRetroactiveAssignments(false)  // LIVE
 *
 * Skrypt jest też importowalny:
 *   import { closeRetroactiveAssignments } from './tools/closeRetroactiveAssignments';
 */

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, RoomAssignment } from '../types';

interface RetroResult {
  scanned: number;
  toClose: { patientName: string; assignmentId: string; roomId: string; toDate: string }[];
  closed: number;
  errors: { assignmentId: string; error: string }[];
}

export async function closeRetroactiveAssignments(dryRun: boolean = true): Promise<RetroResult> {
  const result: RetroResult = { scanned: 0, toClose: [], closed: 0, errors: [] };

  console.log(`%c[retro] Start — DRY_RUN=${dryRun}`, 'color: #0d4f4f; font-weight: bold');

  // 1. Pobierz pacjentów wypisanych (status='discharged' + dischargeDate)
  const patientsSnap = await getDocs(query(
    collection(db, 'patients'),
    where('status', '==', 'discharged')
  ));
  result.scanned = patientsSnap.size;
  console.log(`[retro] Znaleziono ${result.scanned} wypisanych pacjentów.`);

  for (const pDoc of patientsSnap.docs) {
    const patient = { id: pDoc.id, ...pDoc.data() } as Patient;
    if (!patient.dischargeDate) {
      console.warn(`[retro] Pacjent ${patient.firstName} ${patient.lastName} (${patient.id}) ma status=discharged ale brak dischargeDate — pomijam.`);
      continue;
    }

    // 2. Znajdź aktywne assignmenty dla tego pacjenta
    const assignSnap = await getDocs(query(
      collection(db, 'roomAssignments'),
      where('patientId', '==', patient.id),
      where('toDate', '==', null)
    ));

    for (const aDoc of assignSnap.docs) {
      const assignment = { id: aDoc.id, ...aDoc.data() } as RoomAssignment;
      const patientName = `${patient.firstName} ${patient.lastName}`;
      result.toClose.push({
        patientName,
        assignmentId: assignment.id,
        roomId: assignment.roomId,
        toDate: patient.dischargeDate,
      });

      if (dryRun) {
        console.log(`[retro] DRY: zamknąłbym assignment ${assignment.id} (pokój ${assignment.roomId}) dla ${patientName} → toDate=${patient.dischargeDate}`);
      } else {
        try {
          await updateDoc(doc(db, 'roomAssignments', assignment.id), { toDate: patient.dischargeDate });
          result.closed++;
          console.log(`%c[retro] ✅ Zamknięto assignment ${assignment.id} dla ${patientName} → ${patient.dischargeDate}`, 'color: green');
        } catch (err) {
          const msg = (err as Error).message || String(err);
          result.errors.push({ assignmentId: assignment.id, error: msg });
          console.error(`[retro] ❌ Błąd przy assignment ${assignment.id}: ${msg}`);
        }
      }
    }
  }

  console.log(`%c[retro] Koniec. Do zamknięcia: ${result.toClose.length}. Zamknięte: ${result.closed}. Błędy: ${result.errors.length}.`, 'color: #0d4f4f; font-weight: bold');
  if (dryRun && result.toClose.length > 0) {
    console.log('[retro] To był DRY-RUN. Aby faktycznie zamknąć, wywołaj: await closeRetroactiveAssignments(false)');
  }
  return result;
}
