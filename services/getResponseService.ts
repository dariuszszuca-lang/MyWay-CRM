import type { PatientPackage } from '../types';
import { sesja } from './aws/auth';
// GetResponse Integration Service
// Dodaje nowych pacjentów MyWay do GetResponse i wysyła maile powitalny oraz pożegnalny.
// Od przeniesienia rezerwacji na AWS te adresy są częścią API rezerwacji i wymagają tokenu pracownika CRM
// (wcześniej: publiczne funkcje Firebase w projekcie myway-point-app).

export const CF_BASE = 'https://glkbxptm1f.execute-api.eu-central-1.amazonaws.com/crm';

// Nagłówki zapytania z tokenem zalogowanego pracownika.
export const naglowkiCrm = async (): Promise<Record<string, string>> => {
  const s = await sesja();
  return { 'Content-Type': 'application/json', ...(s ? { authorization: `Bearer ${s.token}` } : {}) };
};

interface PatientEmailData {
  email: string;
  firstName: string;
  lastName: string;
  package: PatientPackage;
  phone?: string;
}

/**
 * Istniejąca: dodaje pacjenta do list GetResponse (bez maila)
 * Wywoływana przy "Przyjmij" (admit)
 */
export const sendWelcomeEmail = async (patient: PatientEmailData): Promise<boolean> => {
  try {
    const response = await fetch(`${CF_BASE}/addPatientToGetResponse`, {
      method: 'POST',
      headers: await naglowkiCrm(),
      body: JSON.stringify({
        email: patient.email,
        firstName: patient.firstName,
        lastName: patient.lastName,
        package: patient.package,
        phone: patient.phone || ''
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Pacjent dodany do GetResponse:', result.message);
      return true;
    }

    console.error('❌ GetResponse error:', result.error);
    return false;

  } catch (error) {
    console.error('❌ Błąd wysyłania do GetResponse:', error);
    return false;
  }
};

/**
 * NOWA: Potwierdzenie pacjenta — dodaje do list + wysyła maila powitalnego
 * Wywoływana przy zmianie statusu kolejki na "confirmed"
 */
export const confirmPatientEmail = async (data: {
  email: string;
  firstName: string;
  lastName: string;
  package: PatientPackage;
  phone?: string;
  startDate?: string;
  endDate?: string;
  detoksPackage?: '1day' | '3days';
}): Promise<boolean> => {
  try {
    const response = await fetch(`${CF_BASE}/onPatientConfirmed`, {
      method: 'POST',
      headers: await naglowkiCrm(),
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Pacjent potwierdzony:', result.message);
      if (!result.emailSent) {
        console.warn('⚠️ Dodano do list, ale mail nie wysłany');
      }
      return true;
    }

    console.error('❌ Błąd potwierdzenia:', result.error);
    return false;

  } catch (error) {
    console.error('❌ Błąd confirmPatientEmail:', error);
    return false;
  }
};

/**
 * NOWA: Wypisanie pacjenta — wysyła maila pożegnalnego
 * Wywoływana przy zmianie statusu pacjenta na "discharged"
 */
export const dischargePatientEmail = async (data: {
  email: string;
  firstName: string;
  package: PatientPackage;
}): Promise<boolean> => {
  try {
    const response = await fetch(`${CF_BASE}/onPatientDischarged`, {
      method: 'POST',
      headers: await naglowkiCrm(),
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Mail pożegnalny:', result.message);
      return true;
    }

    console.error('❌ Błąd wypisania:', result.error);
    return false;

  } catch (error) {
    console.error('❌ Błąd dischargePatientEmail:', error);
    return false;
  }
};

export default { sendWelcomeEmail, confirmPatientEmail, dischargePatientEmail };
