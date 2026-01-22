// GetResponse Integration Service
// Wysyła mail powitalny do nowych pacjentów MyWay przez Cloud Function

const CLOUD_FUNCTION_URL = 'https://europe-west1-myway-point-app.cloudfunctions.net/sendWelcomeEmailToPatient';

interface PatientEmailData {
  email: string;
  firstName: string;
  lastName: string;
  package: '1' | '2' | '3';
  phone?: string;
}

export const sendWelcomeEmail = async (patient: PatientEmailData): Promise<boolean> => {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

export default { sendWelcomeEmail };
