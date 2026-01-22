// GetResponse Integration Service
// Wysyła mail powitalny do nowych pacjentów MyWay

const GETRESPONSE_API_KEY = '9ax00x1rt3wdfv36xcqoshr8t50fwhtk';
const CAMPAIGN_ID_PACJENCI = 'LGv86'; // Lista: 10. MY WAY PACJENCI

interface PatientEmailData {
  email: string;
  firstName: string;
  lastName: string;
  package: '1' | '2' | '3';
  phone?: string;
}

export const sendWelcomeEmail = async (patient: PatientEmailData): Promise<boolean> => {
  try {
    // Dodaj kontakt do listy MY WAY PACJENCI
    const response = await fetch('https://api.getresponse.com/v3/contacts', {
      method: 'POST',
      headers: {
        'X-Auth-Token': `api-key ${GETRESPONSE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: patient.email,
        name: `${patient.firstName} ${patient.lastName}`,
        campaign: {
          campaignId: CAMPAIGN_ID_PACJENCI
        },
        dayOfCycle: 0, // Trigger autoresponder immediately
        customFieldValues: [
          {
            customFieldId: 'naIkxY', // pakiet
            value: [patient.package]
          },
          ...(patient.phone ? [{
            customFieldId: 'naIF5S', // telefon
            value: [patient.phone]
          }] : [])
        ]
      }),
    });

    if (response.ok || response.status === 202) {
      console.log('✅ Pacjent dodany do GetResponse, mail powitalny zostanie wysłany');
      return true;
    }

    const errorData = await response.json();

    // Kontakt już istnieje - to OK
    if (errorData.code === 1008) {
      console.log('ℹ️ Pacjent już istnieje w GetResponse');
      return true;
    }

    console.error('❌ GetResponse error:', errorData);
    return false;

  } catch (error) {
    console.error('❌ Błąd wysyłania do GetResponse:', error);
    return false;
  }
};

export default { sendWelcomeEmail };
