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
  package: '1' | '2' | '3';
  totalAmount: number;
  amountPaid: number; // Zadatek
  paymentDeadline: string;

  // New management fields
  isWeek5: boolean;
  hasWhatsapp: boolean;
  onlineConsultations: number;
  notes: string;

  // Patient status
  status?: 'active' | 'discharged';
}

// Queue (Kolejka) - patients waiting for admission
export interface QueuePatient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  package: '1' | '2' | '3';
  depositAmount: number;     // Wpłacona zaliczka
  depositDate: string;       // Data wpłaty zaliczki
  plannedStartDate: string;  // Planowany termin OD
  plannedEndDate: string;    // Planowany termin DO
  notes: string;
  createdAt: string;
  status: 'waiting' | 'confirmed' | 'cancelled' | 'noshow';
}

// Derived property for amount due
export const getAmountDue = (patient: Patient): number => {
  return patient.totalAmount - patient.amountPaid;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};