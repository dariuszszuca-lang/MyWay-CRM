// GetResponse Integration Service
// Dodaje nowych pacjentów MyWay do GetResponse przez Cloud Functions

const CF_BASE = 'https://europe-west1-myway-point-app.cloudfunctions.net';

interface PatientEmailData {
  email: string;
  firstName: string;
  lastName: string;
  package: '1' | '2' | '3';
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
      headers: { 'Content-Type': 'application/json' },
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
  package: '1' | '2' | '3';
  phone?: string;
  startDate?: string;
  endDate?: string;
}): Promise<boolean> => {
  try {
    const response = await fetch(`${CF_BASE}/onPatientConfirmed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  package: '1' | '2' | '3';
}): Promise<boolean> => {
  try {
    const response = await fetch(`${CF_BASE}/onPatientDischarged`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
