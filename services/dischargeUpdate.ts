// Zmiana zapisanego wypisu: buduje zapis do Firestore z samych pól wypisu.
// Celowo NIE dotyka `status`, autoryzacji wypisu z długiem, pokoi ani maila pożegnalnego.
// Pola, które nie pasują do nowego powodu, są czyszczone (null), żeby po zmianie
// np. z przerwy warunkowej na zakończenie nie została stara data powrotu.
// Plik bez importów w czasie wykonania, żeby test `node --test` czytał go bez bundlera.

export type DischargeReason = 'completed' | 'resignation' | 'referral' | 'conditional_break' | 'expelled';

export interface DischargeUpdateInput {
  dischargeType: DischargeReason;
  dischargeDate: string;
  refundAmount?: number;
  refundDate?: string;
  conditionalReturnDate?: string;
  dischargeNotes?: string;
  authorizedBy?: string;
  authorizedNote?: string;
}

// `type`, nie `interface`: updateDoc z Firestore wymaga typu z sygnaturą indeksu,
// a alias z literalnymi kluczami ją spełnia (interfejs nie).
export type DischargeUpdatePayload = {
  dischargeType: DischargeReason;
  dischargeDate: string;
  refundAmount: number | null;
  refundDate: string | null;
  conditionalReturnDate: string | null;
  dischargeNotes: string | null;
};

export const buildDischargeUpdatePayload = (data: DischargeUpdateInput): DischargeUpdatePayload => {
  const refundAllowed = data.dischargeType === 'resignation' || data.dischargeType === 'referral';
  const hasRefund = refundAllowed && (data.refundAmount || 0) > 0;
  const notes = (data.dischargeNotes || '').trim();
  return {
    dischargeType: data.dischargeType,
    dischargeDate: data.dischargeDate,
    refundAmount: hasRefund ? (data.refundAmount as number) : null,
    refundDate: hasRefund ? (data.refundDate || data.dischargeDate) : null,
    conditionalReturnDate: data.dischargeType === 'conditional_break' && data.conditionalReturnDate ? data.conditionalReturnDate : null,
    dischargeNotes: notes ? notes : null,
  };
};
