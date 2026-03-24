export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  pesel: string;
  birthDate: string;
  idSeries: string; // Seria i nr dowodu
  address: string;
  voivodeship: string;
  phone: string;
  email: string;
  
  // Dates
  applicationDate: string; // Data zgłoszenia
  treatmentStartDate: string; // Data rozpoczęcia terapii
  treatmentEndDate: string; // Data zakończenia terapii
  
  // Financial
  package: '1' | '2' | '3' | 'interwencyjna' | 'vip';
  totalAmount: number;
  amountPaid: number; // Legacy — suma wpłat (backwards compat)
  paymentDeadline: string;
  paymentMethod: 'przelew' | 'gotowka' | 'karta' | 'przedplata'; // Legacy

  // Wpłaty (dynamiczna lista)
  payments?: Payment[];

  // New management fields
  isWeek5: boolean;
  hasWhatsapp: boolean;
  onlineConsultations: number;
  notes: string;

  // Patient status
  status?: 'active' | 'discharged';

  // Discharge details
  dischargeType?: 'completed' | 'resignation' | 'referral' | 'conditional_break' | 'expelled';
  dischargeDate?: string;
  refundAmount?: number;
  refundDate?: string;
  conditionalReturnDate?: string;
  dischargeNotes?: string;
}

export interface Payment {
  amount: number;
  date: string;
  method: 'przelew' | 'gotowka' | 'karta' | 'przedplata';
}

// Queue (Kolejka) - patients waiting for admission
export interface QueuePatient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  package: '1' | '2' | '3' | 'interwencyjna' | 'vip';
  depositAmount: number;     // Wpłacona zaliczka
  depositDate: string;       // Data wpłaty zaliczki
  plannedStartDate: string;  // Planowany termin OD
  plannedEndDate: string;    // Planowany termin DO
  notes: string;
  createdAt: string;
  status: 'waiting' | 'confirmed' | 'cancelled' | 'noshow';
}

// Discharge type labels
export const DISCHARGE_TYPE_LABELS: Record<string, string> = {
  completed: 'Zakończenie terapii',
  resignation: 'Rezygnacja z terapii',
  referral: 'Skierowanie do opieki specjalistycznej',
  conditional_break: 'Przerwa warunkowa',
  expelled: 'Wydalony',
};

// Is discharge type = interrupted therapy (not completed)?
export const isInterruptedTherapy = (patient: Patient): boolean => {
  return patient.status === 'discharged' &&
    !!patient.dischargeType &&
    patient.dischargeType !== 'completed';
};

// Derived property for amount due
export const getAmountDue = (patient: Patient): number => {
  return patient.totalAmount - patient.amountPaid;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

// Normalize voivodeship names (typos, case, dashes, foreign)
export const normalizeVoivodeship = (v: string): string | null => {
  if (!v) return null;
  const s = v.toLowerCase().trim().replace(/-/g, '');
  const map: Record<string, string> = {
    'dolnoslaskie': 'Dolnośląskie',
    'dolnośląskie': 'Dolnośląskie',
    'kujawskopomorskie': 'Kujawsko-pomorskie',
    'kujawsko pomorskie': 'Kujawsko-pomorskie',
    'lubelskie': 'Lubelskie',
    'lubuskie': 'Lubuskie',
    'lodzkie': 'Łódzkie',
    'łodzkie': 'Łódzkie',
    'łódzkie': 'Łódzkie',
    'malopolskie': 'Małopolskie',
    'małopolskie': 'Małopolskie',
    'mazowieckie': 'Mazowieckie',
    'opolskie': 'Opolskie',
    'podkarpackie': 'Podkarpackie',
    'podlaskie': 'Podlaskie',
    'pomorskie': 'Pomorskie',
    'slaskie': 'Śląskie',
    'śląskie': 'Śląskie',
    'swietokrzyskie': 'Świętokrzyskie',
    'świętokrzyskie': 'Świętokrzyskie',
    'warminskomazurskie': 'Warmińsko-mazurskie',
    'warmińskomazurskie': 'Warmińsko-mazurskie',
    'wielkopolskie': 'Wielkopolskie',
    'zachodniopomorskie': 'Zachodniopomorskie',
  };
  return map[s] || 'Zagranica';
};