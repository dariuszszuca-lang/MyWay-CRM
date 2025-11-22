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
}

// Derived property for amount due
export const getAmountDue = (patient: Patient): number => {
  return patient.totalAmount - patient.amountPaid;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};