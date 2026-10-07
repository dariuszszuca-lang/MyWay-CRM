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
  package: PatientPackage;
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
  issuer?: 'bella' | 'myway'; // spółka wystawiająca umowę (wybierana przed wydrukiem)
  // AWS: liczniki wizyt u psychiatry (z listy): zajęte miejsca w pakiecie, zrealizowane w pakiecie, płatne
  psychInPackage?: number;
  psychDone?: number;
  psychPaid?: number;
  contractNumber?: string; // nr umowy: łączy przyjazd na 5. tydzień / powrót z przerwy z umową główną

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

  // --- AWS (gałąź aws) ---
  // Numer wersji karty z serwera: zapis ze starą wersją jest odrzucany (ktoś zmienił kartę w międzyczasie).
  wersja?: number;
  // true = pełna karta (adres, e-mail, dowód, lista wpłat i usług) pobrana z serwera z wpisem w dzienniku.
  // false/brak = wiersz listy: tych pól nie ma, a amountPaid i suma usług pochodzą z sum na serwerze.
  pelny?: boolean;
  sumaUslug?: number;
}

export type PaymentCategory = 'zadatek' | 'terapia' | 'przedluzenie' | 'usluga' | 'korekta';
export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  zadatek: 'Zadatek', terapia: 'Płatność za terapię', przedluzenie: 'Przedłużenie pobytu', usluga: 'Usługa dodatkowa', korekta: 'Korekta',
};
export type ServicePaymentStatus = 'nieoplacone' | 'czesciowo' | 'oplacone';
export const SERVICE_PAYMENT_STATUS_LABELS: Record<ServicePaymentStatus, string> = { nieoplacone: 'Nieopłacone', czesciowo: 'Częściowo opłacone', oplacone: 'Opłacone' };
export const PAYMENT_METHOD_LABELS: Record<string, string> = { przelew: 'przelew', gotowka: 'gotówka', karta: 'karta', przedplata: 'przedpłata' };

export interface Payment {
  id?: string;        // AWS: identyfikator wpisu (brak = nowa wpłata do zapisania)
  cancelled?: boolean; // AWS: wpłata anulowana (storno), zostaje w historii
  amount: number;
  date: string;
  method: 'przelew' | 'gotowka' | 'karta' | 'przedplata';
  category?: PaymentCategory; // kategoria wpłaty (specyfikacja 06.10.2026)
  docNo?: number;     // AWS: kolejny numer wpisu na karcie (do numeru potwierdzenia wpłaty)
  purpose?: string; // Za co wpłata (np. kroplówka, recepta, dopłata do pakietu) — opcjonalne dla zgodności wstecz
}

export type AdditionalServiceType = 'recepta' | 'psychiatra' | 'kroplowka' | 'detoks' | 'przedluzenie' | 'inne';

export interface AdditionalService {
  id?: string;        // AWS: identyfikator wpisu
  cancelled?: boolean;
  type: AdditionalServiceType;
  date: string;
  amount: number;
  note?: string;
  // Rozliczenie usługi i przedłużenia (specyfikacja 06.10.2026); wszystkie opcjonalne.
  weeks?: 1 | 2 | 3;            // przedłużenie: liczba dodatkowych tygodni
  extensionStart?: string;      // przedłużenie: data rozpoczęcia
  newEndDate?: string;          // przedłużenie: nowa data zakończenia pobytu
  paymentDeadline?: string;
  paidDate?: string;
  paidMethod?: Payment['method'];
  paymentStatus?: ServicePaymentStatus;
  docNo?: number;               // AWS: kolejny numer wpisu na karcie (do numeru aneksu)
}

export const SERVICE_TYPE_LABELS: Record<AdditionalServiceType, string> = {
  recepta: 'Recepta',
  psychiatra: 'Psychiatra',
  kroplowka: 'Kroplówka',
  detoks: 'Detoks',
  przedluzenie: 'Przedłużenie terapii',
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
  package: PatientPackage;
  depositAmount: number;     // Wpłacona zaliczka
  depositDate: string;       // Data wpłaty zaliczki
  plannedStartDate: string;  // Planowany termin OD
  plannedEndDate: string;    // Planowany termin DO
  plannedArrivalTime?: string; // Planowana godzina przyjazdu w formacie HH:MM (opcjonalna)
  notes: string;
  // Dodatkowe usługi — detoks (pakiet 1-dniowy lub 3-dniowy)
  detoksPackage?: '1day' | '3days';  // '1day' = 1200 zł, '3days' = 3600 zł (ceny od 07.10.2026). Undefined = brak detoksu.
  // Powiązanie z kartą pacjenta w CRM (dla wracających)
  linkedPatientId?: string;
  // Stan
  createdAt: string;
  status: 'waiting' | 'confirmed' | 'cancelled' | 'noshow';
  wersja?: number;  // AWS: wersja wpisu
  pelny?: boolean;  // AWS: true = karta z PESEL, dowodem i adresem
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
  // AWS: wiersz listy nie ma listy usług, tylko ich sumę policzoną na serwerze.
  if (patient.additionalServices === undefined && typeof patient.sumaUslug === 'number') return patient.sumaUslug;
  return (patient.additionalServices || []).filter(s => !s.cancelled).reduce((sum, s) => sum + (s.amount || 0), 0);
};

// Derived property for amount due (includes additional services)
export const getAmountDue = (patient: Patient): number => {
  return patient.totalAmount + getAdditionalServicesTotal(patient) - patient.amountPaid;
};

// Pakiety terapii. JEDNO źródło nazw dla całej aplikacji.
// Wcześniej te same etykiety były przepisane w sześciu miejscach i zdążyły się rozjechać:
// raport przyjęć mówił „6 tyg. (rozłożony)", a reszta aplikacji „6 tyg. rozszerzony".
export type PatientPackage = '1' | '2' | '3' | '6tyg' | '8tyg' | '6tyg_roz' | '8tyg_roz' | 'interwencyjna' | 'vip' | 'przyjazd_5tyg' | 'powrot_przerwa';

export const PACKAGE_ORDER: PatientPackage[] = ['1', '2', '3', '6tyg', '8tyg', '6tyg_roz', '8tyg_roz', 'interwencyjna', 'vip', 'przyjazd_5tyg', 'powrot_przerwa'];

// Pakiety bez kwoty bazowej (rozliczane są tylko usługi dodatkowe), domyślnie poza statystykami.
// Przyjazd na 5. tydzień i powrót z przerwy warunkowej działają jak Grupa VIP (prośba Krystiana 06.10.2026).
export const PACKAGES_WITHOUT_BASE: PatientPackage[] = ['vip', 'przyjazd_5tyg', 'powrot_przerwa'];
// Dla tych dwóch pakietów NIE wysyłamy maili powitalnych ani pożegnalnych i nie dopisujemy do list GetResponse
// (decyzja Darka i Krystiana 07.10.2026: to powroty w ramach tej samej umowy, nie nowe przyjęcia).
export const PACKAGES_WITHOUT_MAILS: PatientPackage[] = ['przyjazd_5tyg', 'powrot_przerwa'];
export const isPackageWithoutMails = (pkg: string): boolean => PACKAGES_WITHOUT_MAILS.includes(pkg as PatientPackage);
export const isPackageWithoutBase = (pkg: string): boolean => PACKAGES_WITHOUT_BASE.includes(pkg as PatientPackage);

export const PACKAGE_LABELS: Record<PatientPackage, string> = {
  '1': 'Pakiet 1',
  '2': 'Pakiet 2',
  '3': 'Pakiet 3',
  '6tyg': '6 tygodni',
  '8tyg': '8 tygodni',
  '6tyg_roz': '6 tygodni rozszerzony',
  '8tyg_roz': '8 tygodni rozszerzony',
  'interwencyjna': 'Terapia interwencyjna',
  'vip': 'Grupa VIP',
  'przyjazd_5tyg': 'Przyjazd 5. tydzień',
  'powrot_przerwa': 'Powrót z przerwy warunkowej',
};

// Krótkie etykiety do wąskich miejsc (przyciski filtrów).
export const PACKAGE_SHORT_LABELS: Record<PatientPackage, string> = {
  '1': '1', '2': '2', '3': '3', '6tyg': '6tyg', '8tyg': '8tyg',
  '6tyg_roz': '6t.R', '8tyg_roz': '8t.R', 'interwencyjna': 'Interw.', 'vip': 'VIP',
  'przyjazd_5tyg': '5.tydz', 'powrot_przerwa': 'Powrót',
};

export const packageLabel = (pkg: string): string => PACKAGE_LABELS[pkg as PatientPackage] || pkg;

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
  wersja?: number;         // AWS: wersja rekordu
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

// Helper: przypisanie jest aktualne DZIŚ, jeśli:
//  - fromDate <= dziś (już się zaczęło, queue patient z fromDate=jutro NIE jest aktualny)
//  - oraz toDate === null (brak końca) lub toDate > dziś (koniec w przyszłości; wypisany DZIŚ = toDate=dziś NIE jest aktualny — pokój wolny od dziś)
const isCurrentAssignment = (a: RoomAssignment): boolean => {
  const today = new Date().toISOString().slice(0, 10);
  if (a.fromDate > today) return false;
  if (a.toDate === null) return true;
  return a.toDate > today;
};

// Helper: który pokój ma pacjent teraz?
export const getCurrentRoomAssignment = (
  patientId: string,
  assignments: RoomAssignment[]
): RoomAssignment | null => {
  return assignments.find(a => a.patientId === patientId && isCurrentAssignment(a)) || null;
};

// Helper: ile osób jest teraz w pokoju?
export const getRoomOccupancy = (
  roomId: string,
  assignments: RoomAssignment[]
): number => {
  return assignments.filter(a => a.roomId === roomId && isCurrentAssignment(a)).length;
};

// Helper: wszyscy aktualni mieszkańcy pokoju
export const getRoomCurrentPatients = (
  roomId: string,
  assignments: RoomAssignment[]
): RoomAssignment[] => {
  return assignments.filter(a => a.roomId === roomId && isCurrentAssignment(a));
};

// Export żeby komponenty mogły używać tej samej semantyki
export { isCurrentAssignment };

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

// ============================================================================
// DZIENNIK — zamówienia Dziennika MyWay (sprzedaż przez edu-myway.pl).
// Dane NIE leżą w bazie tego CRM. Żyją w projekcie EduWay i czytamy je przez
// services/ordersApi.ts. Spec: klienci/myway/projekty/dziennik-panel-zamowien/SPEC.md
// ============================================================================

export type OrderStatus = 'new' | 'accepted' | 'packing' | 'shipped' | 'cancelled';

// Kolejność realizacji. Marcin przestawia ręcznie.
export const ORDER_STATUS_FLOW: OrderStatus[] = ['new', 'accepted', 'packing', 'shipped'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Zamówione',
  accepted: 'Przyjęte do realizacji',
  packing: 'Pakowane',
  shipped: 'Dziennik wysłany',
  cancelled: 'Anulowane',
};

// Statusy, po których klient dostaje maila. "Zamówione" nie wysyła,
// bo potwierdzenie zakupu idzie automatycznie po płatności.
export const ORDER_STATUSES_WITH_EMAIL: OrderStatus[] = ['accepted', 'packing', 'shipped'];

export interface OrderShippingAddress {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    state?: string;
  };
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  at: string | null;   // ISO
  by: string | null;   // mail osoby, która zmieniła
}

export interface OrderStatusEmailEntry {
  status: OrderStatus;
  at: string | null;   // ISO
  ok: boolean;
  error: string | null;
}

export interface Order {
  id: string;                  // = ID sesji Stripe
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: OrderShippingAddress | null;
  productName: string | null;
  productId: string | null;
  amount: number | null;
  shippingCost: number;
  currency: string;
  orderDate: string | null;    // sformatowana data z webhooka
  createdAt: string | null;    // ISO
  stripeSessionId: string;
  status: OrderStatus;
  emailSent: boolean;          // potwierdzenie zakupu po płatności
  statusHistory: OrderStatusHistoryEntry[];
  statusEmails: OrderStatusEmailEntry[];
}

// Adres w kolejności czytelnej dla kuriera. Pusta tablica = brak adresu.
export const formatOrderAddress = (shippingAddress: OrderShippingAddress | null): string[] => {
  if (!shippingAddress) return [];
  const a = shippingAddress.address || {};
  const cityLine = `${a.postal_code || ''} ${a.city || ''}`.trim();
  return [shippingAddress.name, a.line1, a.line2, cityLine, a.country].filter(Boolean) as string[];
};

// Kod na darmowy Dziennik (kupon 100% w Stripe).
// Dwie niezależne informacje: „zrealizowany" wie Stripe (nie da się tego kliknąć),
// „wydany" zaznacza Marcin ręcznie, bo Stripe nie wie, komu daliśmy kod do ręki.
export interface PromoCode {
  code: string;
  couponId: string | null;
  couponName: string | null;
  discount: string | null;      // np. "100%"
  timesRedeemed: number;
  maxRedemptions: number | null;
  redeemed: boolean;            // ze Stripe, tylko do odczytu
  active: boolean;              // Stripe wyłącza kod po wykorzystaniu
  createdAt: string | null;
  expiresAt: string | null;
  issued: boolean;              // warstwa ręczna
  issuedTo: string | null;
  note: string | null;
  issuedAt: string | null;
  updatedBy: string | null;
}

export type CodeFilter = 'all' | 'free' | 'issued' | 'redeemed';

// Trzy sytuacje, które trzeba rozróżnić: kod w szufladzie, kod wydany ale nieużyty, kod zużyty.
export const codeState = (c: PromoCode): 'redeemed' | 'issued' | 'free' => {
  if (c.redeemed) return 'redeemed';
  if (c.issued) return 'issued';
  return 'free';
};

// Czy ostatni mail dla AKTUALNEGO statusu się nie udał (czerwony znacznik w tabeli).
export const hasFailedStatusEmail = (order: Order): boolean => {
  const forStatus = order.statusEmails.filter(e => e.status === order.status);
  if (forStatus.length === 0) return false;
  return forStatus[forStatus.length - 1].ok === false;
};