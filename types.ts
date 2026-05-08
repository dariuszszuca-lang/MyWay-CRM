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
  package: '1' | '2' | '3' | '6tyg' | '8tyg' | '6tyg_roz' | '8tyg_roz' | 'interwencyjna' | 'vip';
  totalAmount: number;
  amountPaid: number; // Legacy — suma wpłat (backwards compat)
  paymentDeadline: string;
  paymentMethod: 'przelew' | 'gotowka' | 'karta' | 'przedplata'; // Legacy

  // Wpłaty (dynamiczna lista)
  payments?: Payment[];

  // Usługi dodatkowe (recepty, psychiatra, kroplówki, inne)
  additionalServices?: AdditionalService[];

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

  // Authorization for discharge with outstanding debt (only for dischargeType='completed')
  dischargeAuthorizedBy?: 'Natalia' | 'Krystian';
  dischargeAuthorizedNote?: string;
}

export interface Payment {
  amount: number;
  date: string;
  method: 'przelew' | 'gotowka' | 'karta' | 'przedplata';
}

export type AdditionalServiceType = 'recepta' | 'psychiatra' | 'kroplowka' | 'detoks' | 'inne';

export interface AdditionalService {
  type: AdditionalServiceType;
  date: string;
  amount: number;
  note?: string;
}

export const SERVICE_TYPE_LABELS: Record<AdditionalServiceType, string> = {
  recepta: 'Recepta',
  psychiatra: 'Psychiatra',
  kroplowka: 'Kroplówka',
  detoks: 'Detoks',
  inne: 'Inne',
};

// Queue (Kolejka) - patients waiting for admission
export interface QueuePatient {
  id: string;
  // Podstawowe dane
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  // Pełne dane pacjenta (wypełniane w kolejce, żeby przyjęcie było 1 klikiem)
  pesel?: string;
  birthDate?: string;
  idSeries?: string;        // seria/nr dowodu
  address?: string;
  voivodeship?: string;
  // Pakiet i zaliczka
  package: '1' | '2' | '3' | '6tyg' | '8tyg' | '6tyg_roz' | '8tyg_roz' | 'interwencyjna' | 'vip';
  depositAmount: number;     // Wpłacona zaliczka
  depositDate: string;       // Data wpłaty zaliczki
  plannedStartDate: string;  // Planowany termin OD
  plannedEndDate: string;    // Planowany termin DO
  plannedArrivalTime?: string; // Planowana godzina przyjazdu w formacie HH:MM (opcjonalna)
  notes: string;
  // Dodatkowe usługi — detoks (pakiet 1-dniowy lub 3-dniowy)
  detoksPackage?: '1day' | '3days';  // '1day' = 1000 zł, '3days' = 2700 zł. Undefined = brak detoksu.
  // Powiązanie z kartą pacjenta w CRM (dla wracających)
  linkedPatientId?: string;
  // Stan
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

// Total additional services cost
export const getAdditionalServicesTotal = (patient: Patient): number => {
  return (patient.additionalServices || []).reduce((sum, s) => sum + (s.amount || 0), 0);
};

// Derived property for amount due (includes additional services)
export const getAmountDue = (patient: Patient): number => {
  return patient.totalAmount + getAdditionalServicesTotal(patient) - patient.amountPaid;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

// ============================================================================
// ROOMS — feature/rooms (plan pokoi). Niezależne od istniejących typów.
// ============================================================================

export interface Room {
  id: string;              // Firestore doc id (np. "1", "2", "D", "10")
  number: string;          // wyświetlana nazwa: "1", "D", "10"
  capacity: number;        // max pacjentów (sztywny limit)
  notes?: string;          // np. "Pokój dla kobiet", "Izolatka — dojrzewalnia"
  isDisabled: boolean;     // remont/awaria/sprzątanie
  disabledReason?: string;
  disabledFrom?: string;   // YYYY-MM-DD
  disabledTo?: string;     // YYYY-MM-DD
  order?: number;          // do sortowania w UI
}

export interface RoomAssignment {
  id: string;             // Firestore doc id
  patientId: string;      // ref do patients/{id} — pusty/placeholder jeśli przypisanie pochodzi z kolejki
  roomId: string;         // ref do rooms/{id}
  fromDate: string;       // YYYY-MM-DD — początek przypisania w tym pokoju
  toDate: string | null;  // null = aktualnie tu, w innym przypadku data zmiany pokoju lub wypisu
  notes?: string;
  createdAt: string;      // ISO timestamp
  queuePatientId?: string; // ref do queue/{id} — jeśli pokój zarezerwowany przed przyjęciem z kolejki
}

// Helper: który pokój ma pacjent teraz?
export const getCurrentRoomAssignment = (
  patientId: string,
  assignments: RoomAssignment[]
): RoomAssignment | null => {
  return assignments.find(a => a.patientId === patientId && a.toDate === null) || null;
};

// Helper: ile osób jest teraz w pokoju?
export const getRoomOccupancy = (
  roomId: string,
  assignments: RoomAssignment[]
): number => {
  return assignments.filter(a => a.roomId === roomId && a.toDate === null).length;
};

// Helper: wszyscy aktualni mieszkańcy pokoju
export const getRoomCurrentPatients = (
  roomId: string,
  assignments: RoomAssignment[]
): RoomAssignment[] => {
  return assignments.filter(a => a.roomId === roomId && a.toDate === null);
};

// Seed 10 pokoi — wartości od Marcina (5.05.2026)
export const ROOMS_SEED: Omit<Room, 'id'>[] = [
  { number: '1',  capacity: 4, notes: 'Pokój zazwyczaj dedykowany dla kobiet', isDisabled: false, order: 1 },
  { number: '2',  capacity: 2, isDisabled: false, order: 2 },
  { number: '3',  capacity: 3, isDisabled: false, order: 3 },
  { number: '4',  capacity: 3, isDisabled: false, order: 4 },
  { number: '5',  capacity: 2, isDisabled: false, order: 5 },
  { number: '6',  capacity: 3, isDisabled: false, order: 6 },
  { number: '7',  capacity: 2, isDisabled: false, order: 7 },
  { number: '8',  capacity: 4, isDisabled: false, order: 8 },
  { number: 'D',  capacity: 2, notes: 'Dojrzewalnia — izolatka dla osób przyjeżdżających pod wpływem', isDisabled: false, order: 9 },
  { number: '10', capacity: 3, isDisabled: false, order: 10 },
];

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