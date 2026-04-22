import React, { useState, useMemo } from 'react';
import { Patient, formatCurrency, getAmountDue, normalizeVoivodeship, DISCHARGE_TYPE_LABELS, isInterruptedTherapy } from '../types';
import { FileText, User, ScrollText, MessageCircle, CheckSquare, Square, Pencil, Trash2, Search, Wallet, X, CheckCircle, MapPin, Calendar, CreditCard, LogOut, Download, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { generateContract, generatePatientCard, generateRegulations, generateFilteredListPDF } from '../services/pdfGenerator';
import PatientForm from './PatientForm';

interface DischargeData {
  dischargeType: 'completed' | 'resignation' | 'referral' | 'conditional_break' | 'expelled';
  dischargeDate: string;
  refundAmount?: number;
  refundDate?: string;
  conditionalReturnDate?: string;
  dischargeNotes?: string;
  authorizedBy?: 'Natalia' | 'Krystian';
  authorizedNote?: string;
}

interface PatientListProps {
  patients: Patient[];
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (id: string) => void;
  onDischargePatient: (patient: Patient, dischargeData: DischargeData) => void;
  onReactivatePatient: (patient: Patient) => void;
}

const PatientList: React.FC<PatientListProps> = ({ patients, onUpdatePatient, onDeletePatient, onDischargePatient, onReactivatePatient }) => {
  const [filterPackage, setFilterPackage] = useState<'all' | '1' | '2' | '3' | '6tyg' | '8tyg' | '6tyg_roz' | '8tyg_roz' | 'interwencyjna' | 'vip'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'discharged' | 'interrupted'>('active');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Discharge modal state
  const [dischargeModalPatient, setDischargeModalPatient] = useState<Patient | null>(null);
  const [dischargeType, setDischargeType] = useState<DischargeData['dischargeType']>('completed');
  const [dischargeDate, setDischargeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dischargeRefundAmount, setDischargeRefundAmount] = useState<number>(0);
  const [dischargeRefundDate, setDischargeRefundDate] = useState<string>('');
  const [dischargeConditionalReturnDate, setDischargeConditionalReturnDate] = useState<string>('');
  const [dischargeNotes, setDischargeNotes] = useState<string>('');
  // Override dla wypisu z długiem (tylko przy dischargeType='completed')
  const [overrideDebt, setOverrideDebt] = useState<boolean>(false);
  const [authorizedBy, setAuthorizedBy] = useState<'Natalia' | 'Krystian' | ''>('');
  const [authorizedNote, setAuthorizedNote] = useState<string>('');

  // New filters
  const [filterVoivodeship, setFilterVoivodeship] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'day' | 'week' | 'prevweek' | 'month' | '3months' | 'custom'>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // State for Payment Modal
  const [paymentModalPatient, setPaymentModalPatient] = useState<Patient | null>(null);
  const [paymentAmountPaid, setPaymentAmountPaid] = useState<number>(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Get unique voivodeships from patients (normalized, foreign → "Zagranica")
  const uniqueVoivodeships = useMemo(() => {
    const normalized = new Set<string>();
    patients.forEach(p => {
      const n = normalizeVoivodeship(p.voivodeship);
      if (n) normalized.add(n);
    });
    return [...normalized].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [patients]);

  // Date filter helper
  const isWithinDateRange = (dateStr: string, range: string): boolean => {
    if (range === 'all' || !dateStr) return true;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    switch (range) {
      case 'day': return diffDays <= 1;
      case 'week': return diffDays <= 7;
      case 'prevweek': return diffDays > 7 && diffDays <= 14;
      case 'month': return diffDays <= 30;
      case '3months': return diffDays <= 90;
      case 'custom': {
        if (!customDateFrom && !customDateTo) return true;
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        if (customDateFrom) {
          const from = new Date(customDateFrom);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (customDateTo) {
          const to = new Date(customDateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      }
      default: return true;
    }
  };

  // Filter Logic: Package + Search + Voivodeship + Date + Payment Status
  const filteredPatients = patients.filter(p => {
    const matchesPackage = filterPackage === 'all' || p.package === filterPackage;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = p.firstName.toLowerCase().includes(searchLower) ||
                          p.lastName.toLowerCase().includes(searchLower) ||
                          p.pesel.includes(searchLower);
    const matchesVoivodeship = filterVoivodeship === 'all' || normalizeVoivodeship(p.voivodeship) === filterVoivodeship;
    const matchesDateRange = isWithinDateRange(p.applicationDate, filterDateRange);
    const amountDue = getAmountDue(p);
    const matchesPayment = filterPaymentStatus === 'all' ||
                           (filterPaymentStatus === 'paid' && amountDue <= 0) ||
                           (filterPaymentStatus === 'unpaid' && amountDue > 0);
    const matchesStatus = filterStatus === 'all' ||
                          (filterStatus === 'active' && p.status !== 'discharged') ||
                          (filterStatus === 'discharged' && p.status === 'discharged') ||
                          (filterStatus === 'interrupted' && isInterruptedTherapy(p));

    return matchesPackage && matchesSearch && matchesVoivodeship && matchesDateRange && matchesPayment && matchesStatus;
  });

  // Count active filters
  const activeFiltersCount = [
    filterPackage !== 'all',
    filterStatus !== 'active',
    filterVoivodeship !== 'all',
    filterDateRange !== 'all',
    filterPaymentStatus !== 'all'
  ].filter(Boolean).length;

  const getWhatsAppLink = (phone: string) => {
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/48${cleanNumber}`;
  };

  const handleSaveEdit = (updatedPatient: Patient) => {
    onUpdatePatient(updatedPatient);
    setEditingPatient(null);
  };

  // Payment Modal Handlers
  const openPaymentModal = (patient: Patient) => {
    setPaymentModalPatient(patient);
    setPaymentAmountPaid(patient.amountPaid);
  };

  const handleSavePayment = () => {
    if (paymentModalPatient) {
      onUpdatePatient({
        ...paymentModalPatient,
        amountPaid: paymentAmountPaid
      });
      setPaymentModalPatient(null);
    }
  };

  const handlePayInFull = () => {
    if (paymentModalPatient) {
      setPaymentAmountPaid(paymentModalPatient.totalAmount);
    }
  };

  const handleExportFilteredPDF = async () => {
    setIsExportingPDF(true);
    try {
      const filterParts: string[] = [];
      if (filterPackage !== 'all') {
        const pkgNameMap: Record<string, string> = { '1': 'Pakiet 1', '2': 'Pakiet 2', '3': 'Pakiet 3', '6tyg': '6 tygodni', '8tyg': '8 tygodni', '6tyg_roz': '6 tyg. rozszerzony', '8tyg_roz': '8 tyg. rozszerzony', 'interwencyjna': 'Terapia interwencyjna', 'vip': 'Grupa VIP' };
        const pkgLabel = pkgNameMap[filterPackage] || filterPackage;
        filterParts.push(pkgLabel);
      }
      if (filterStatus === 'active') filterParts.push('Aktywni');
      if (filterStatus === 'discharged') filterParts.push('Wypisani');
      if (filterPaymentStatus === 'paid') filterParts.push('Opłacone');
      if (filterPaymentStatus === 'unpaid') filterParts.push('Nieopłacone');
      if (filterVoivodeship !== 'all') filterParts.push(filterVoivodeship);
      if (filterDateRange === 'day') filterParts.push('Dziś');
      if (filterDateRange === 'week') filterParts.push('Ostatnie 7 dni');
      if (filterDateRange === 'month') filterParts.push('Ostatnie 30 dni');
      if (filterDateRange === 'custom') {
        filterParts.push(`${customDateFrom || '...'} – ${customDateTo || '...'}`);
      }
      if (searchQuery) filterParts.push(`Szukaj: "${searchQuery}"`);

      await generateFilteredListPDF({
        patients: filteredPatients,
        filterDescription: filterParts.length > 0 ? filterParts.join(' | ') : 'Brak (wszystkie dane)',
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Błąd podczas generowania PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Discharge modal handlers
  const openDischargeModal = (patient: Patient) => {
    setDischargeModalPatient(patient);
    setDischargeType('completed');
    setDischargeDate(new Date().toISOString().split('T')[0]);
    setDischargeRefundAmount(0);
    setDischargeRefundDate('');
    setDischargeConditionalReturnDate('');
    setDischargeNotes('');
    setOverrideDebt(false);
    setAuthorizedBy('');
    setAuthorizedNote('');
  };

  const closeDischargeModal = () => {
    setDischargeModalPatient(null);
  };

  const handleConfirmDischarge = () => {
    if (!dischargeModalPatient) return;

    // Walidacja: blokada wypisu typu "completed" przy niezapłaconej całości
    const amountDue = getAmountDue(dischargeModalPatient);
    if (dischargeType === 'completed' && amountDue > 0) {
      if (!overrideDebt) {
        alert(`Nie można zakończyć terapii. Pacjent ma do zapłaty ${formatCurrency(amountDue)}.\n\nJeśli chcesz wypisać mimo zadłużenia, zaznacz opcję "Wypis mimo zadłużenia" i wybierz osobę autoryzującą.`);
        return;
      }
      if (!authorizedBy) {
        alert('Wypis mimo zadłużenia wymaga autoryzacji. Wybierz kto zatwierdza (Natalia lub Krystian).');
        return;
      }
    }

    const data: DischargeData = {
      dischargeType,
      dischargeDate,
    };
    if ((dischargeType === 'resignation' || dischargeType === 'referral') && dischargeRefundAmount > 0) {
      data.refundAmount = dischargeRefundAmount;
      data.refundDate = dischargeRefundDate || dischargeDate;
    }
    if (dischargeType === 'conditional_break' && dischargeConditionalReturnDate) {
      data.conditionalReturnDate = dischargeConditionalReturnDate;
    }
    if (dischargeNotes.trim()) {
      data.dischargeNotes = dischargeNotes.trim();
    }
    if (dischargeType === 'completed' && amountDue > 0 && overrideDebt && authorizedBy) {
      data.authorizedBy = authorizedBy as 'Natalia' | 'Krystian';
      if (authorizedNote.trim()) {
        data.authorizedNote = authorizedNote.trim();
      }
    }

    onDischargePatient(dischargeModalPatient, data);
    closeDischargeModal();
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Brak pacjentów w bazie. Dodaj pierwszego pacjenta.
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Modal for Editing */}
      {editingPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-8 animate-in fade-in zoom-in duration-200">
             <PatientForm 
                initialData={editingPatient} 
                onSubmit={handleSaveEdit} 
                onCancel={() => setEditingPatient(null)} 
             />
          </div>
        </div>
      )}

      {/* Modal for Quick Payment */}
      {paymentModalPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Rozlicz Płatność</h3>
              <button onClick={() => setPaymentModalPatient(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pacjent:</span>
                <span className="font-semibold">{paymentModalPatient.firstName} {paymentModalPatient.lastName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Całkowity koszt:</span>
                <span className="font-bold">{formatCurrency(paymentModalPatient.totalAmount)}</span>
              </div>
              <hr />
              
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Wpłacona kwota (PLN)</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={paymentAmountPaid}
                    onChange={(e) => setPaymentAmountPaid(Number(e.target.value))}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-right font-mono text-lg bg-white text-black"
                  />
                  <button 
                    onClick={handlePayInFull}
                    className="px-3 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 text-sm font-medium whitespace-nowrap"
                  >
                    Opłać całość
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mt-2">
                <span className="text-sm font-medium text-gray-600">Pozostaje do zapłaty:</span>
                <span className={`font-mono font-bold ${paymentModalPatient.totalAmount - paymentAmountPaid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(paymentModalPatient.totalAmount - paymentAmountPaid)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleSavePayment}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Zatwierdź
              </button>
              <button 
                onClick={() => setPaymentModalPatient(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Discharge */}
      {dischargeModalPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Wypis pacjenta</h3>
              <button onClick={closeDischargeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Pacjent:</span>
              <span className="ml-2 font-bold text-gray-900">{dischargeModalPatient.firstName} {dischargeModalPatient.lastName}</span>
            </div>

            {/* Discharge type selection */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Powód wypisu</label>
              <div className="space-y-2">
                {([
                  { value: 'completed', label: 'Zakończenie terapii', icon: '✅', color: 'green', desc: 'Terapia zakończona planowo — mail pożegnalny' },
                  { value: 'resignation', label: 'Rezygnacja z terapii', icon: '🚪', color: 'orange', desc: 'Pacjent rezygnuje — opcjonalny zwrot' },
                  { value: 'referral', label: 'Skierowanie do opieki specjalistycznej', icon: '🏥', color: 'blue', desc: 'Przekierowanie do innej placówki — opcjonalny zwrot' },
                  { value: 'conditional_break', label: 'Przerwa warunkowa', icon: '⏸️', color: 'amber', desc: 'Tymczasowe opuszczenie z planowanym powrotem' },
                  { value: 'expelled', label: 'Wydalony', icon: '⛔', color: 'red', desc: 'Naruszenie regulaminu / wydalenie' },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      dischargeType === opt.value
                        ? opt.color === 'green' ? 'border-green-500 bg-green-50'
                        : opt.color === 'orange' ? 'border-orange-500 bg-orange-50'
                        : opt.color === 'blue' ? 'border-blue-500 bg-blue-50'
                        : opt.color === 'amber' ? 'border-amber-500 bg-amber-50'
                        : 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dischargeType"
                      value={opt.value}
                      checked={dischargeType === opt.value}
                      onChange={() => setDischargeType(opt.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{opt.icon} {opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Dynamic fields based on type */}
            <div className="space-y-3 mb-4">
              {/* Date — always shown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  {dischargeType === 'conditional_break' ? 'Data wyjścia' : dischargeType === 'expelled' ? 'Data wydalenia' : 'Data wypisu'}
                </label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-black"
                />
              </div>

              {/* Refund fields — resignation & referral */}
              {(dischargeType === 'resignation' || dischargeType === 'referral') && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kwota zwrotu (PLN)</label>
                    <input
                      type="number"
                      min="0"
                      value={dischargeRefundAmount}
                      onChange={(e) => setDischargeRefundAmount(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono bg-white text-black"
                      placeholder="0 = brak zwrotu"
                    />
                  </div>
                  {dischargeRefundAmount > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data zwrotu</label>
                      <input
                        type="date"
                        value={dischargeRefundDate}
                        onChange={(e) => setDischargeRefundDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-black"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Conditional break — return date */}
              {dischargeType === 'conditional_break' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Planowana data powrotu</label>
                  <input
                    type="date"
                    value={dischargeConditionalReturnDate}
                    onChange={(e) => setDischargeConditionalReturnDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-black"
                  />
                </div>
              )}

              {/* Notes — always available, prominent for expelled */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Uwagi {dischargeType === 'expelled' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={dischargeNotes}
                  onChange={(e) => setDischargeNotes(e.target.value)}
                  placeholder={dischargeType === 'expelled' ? 'Powód wydalenia (wymagane)...' : 'Opcjonalne uwagi...'}
                  className="w-full h-20 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-white text-black"
                />
              </div>
            </div>

            {/* Status płatności — zawsze widoczny */}
            {(() => {
              const amountDue = getAmountDue(dischargeModalPatient);
              const isDebt = amountDue > 0;
              const isCompleted = dischargeType === 'completed';
              return (
                <div className={`p-3 rounded-lg mb-4 border-2 ${isDebt ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Status płatności
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded ${isDebt ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                      {isDebt ? 'ZADŁUŻENIE' : 'UREGULOWANE'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-500">Kwota total:</span><br/><strong>{formatCurrency(dischargeModalPatient.totalAmount)}</strong></div>
                    <div><span className="text-gray-500">Wpłacono:</span><br/><strong>{formatCurrency(dischargeModalPatient.amountPaid)}</strong></div>
                    <div><span className="text-gray-500">Do zapłaty:</span><br/><strong className={isDebt ? 'text-red-600' : 'text-green-600'}>{formatCurrency(amountDue)}</strong></div>
                  </div>
                  {isDebt && isCompleted && (
                    <div className="mt-3 pt-3 border-t border-red-300">
                      <div className="text-xs text-red-700 font-semibold mb-2">
                        ⚠️ Nie można zakończyć terapii z niezapłaconą kwotą.
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overrideDebt}
                          onChange={(e) => {
                            setOverrideDebt(e.target.checked);
                            if (!e.target.checked) { setAuthorizedBy(''); setAuthorizedNote(''); }
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-gray-800">
                          <strong>Wypis mimo zadłużenia</strong> — wymaga autoryzacji Natalii lub Krystiana
                        </span>
                      </label>
                      {overrideDebt && (
                        <div className="mt-3 ml-5 space-y-2">
                          <div>
                            <div className="text-xs font-bold text-gray-700 mb-1">Autoryzuje:</div>
                            <div className="flex gap-2">
                              {(['Natalia', 'Krystian'] as const).map(p => (
                                <label key={p} className={`flex-1 px-3 py-2 rounded-lg border-2 cursor-pointer text-center text-sm font-semibold transition-colors ${authorizedBy === p ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                  <input type="radio" name="authorizedBy" value={p} checked={authorizedBy === p} onChange={() => setAuthorizedBy(p)} className="sr-only" />
                                  {p}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-700 mb-1 block">Powód (opcjonalnie)</label>
                            <textarea
                              rows={2}
                              value={authorizedNote}
                              onChange={(e) => setAuthorizedNote(e.target.value)}
                              placeholder="np. spłata ratalnie do 31.05"
                              className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Summary */}
            <div className="p-3 bg-gray-50 rounded-lg mb-4 text-sm text-gray-700">
              <div className="font-semibold mb-1">Podsumowanie:</div>
              <ul className="space-y-1 text-xs">
                <li>Status pacjenta zmieni się na <strong>nieaktywny</strong></li>
                {dischargeType !== 'completed' && (
                  <li>Raportowany jako <strong className="text-orange-600">przerwana terapia</strong></li>
                )}
                {dischargeType === 'completed' && (
                  <li>Zostanie wysłany <strong className="text-green-600">mail pożegnalny</strong></li>
                )}
                {(dischargeType === 'resignation' || dischargeType === 'referral') && dischargeRefundAmount > 0 && (
                  <li>Zwrot: <strong className="text-red-600">{formatCurrency(dischargeRefundAmount)}</strong> — odliczony od przychodów</li>
                )}
                {dischargeType === 'conditional_break' && dischargeConditionalReturnDate && (
                  <li>Planowany powrót: <strong className="text-amber-600">{dischargeConditionalReturnDate}</strong></li>
                )}
              </ul>
            </div>

            <div className="flex gap-3">
              {(() => {
                const amountDue = getAmountDue(dischargeModalPatient);
                const blockedByDebt = dischargeType === 'completed' && amountDue > 0 && (!overrideDebt || !authorizedBy);
                const blockedByExpelled = dischargeType === 'expelled' && !dischargeNotes.trim();
                const isBlocked = blockedByDebt || blockedByExpelled;
                return (
                  <button
                    onClick={handleConfirmDischarge}
                    disabled={isBlocked}
                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={blockedByDebt ? `Do zapłaty: ${formatCurrency(amountDue)}` : ''}
                  >
                    <LogOut className="w-4 h-4" />
                    Wypisz pacjenta
                  </button>
                );
              })()}
              <button
                onClick={closeDischargeModal}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar: Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">

        {/* Row 1: Search + PDF */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Szukaj pacjenta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition duration-150 ease-in-out text-black"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleExportFilteredPDF}
              disabled={isExportingPDF || filteredPatients.length === 0}
              className="flex items-center gap-2 text-sm text-white bg-teal-600 hover:bg-teal-700 font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isExportingPDF ? 'Generowanie...' : `Pobierz PDF (${filteredPatients.length})`}
            </button>
            <button
              onClick={() => generateRegulations()}
              className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium px-3 py-1.5 rounded hover:bg-teal-50 transition-colors"
            >
              <ScrollText className="w-4 h-4" />
              Regulamin
            </button>
          </div>
        </div>

        {/* Row 2: All Filters */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">

          {/* Package Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pakiet:</span>
            <div className="flex gap-1">
              {([
                { value: 'all', label: 'Wszyscy' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '6tyg', label: '6tyg' },
                { value: '8tyg', label: '8tyg' },
                { value: '6tyg_roz', label: '6t.R' },
                { value: '8tyg_roz', label: '8t.R' },
                { value: 'interwencyjna', label: 'Interw.' },
                { value: 'vip', label: 'VIP' },
              ] as const).map((pkg) => (
                <button
                  key={pkg.value}
                  onClick={() => setFilterPackage(pkg.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                    filterPackage === pkg.value
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pkg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Status Filter (Active / Discharged) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <LogOut className="w-3 h-3" />
              Status:
            </span>
            <div className="flex gap-1">
              {([
                { value: 'active', label: 'Aktywni' },
                { value: 'discharged', label: 'Wypisani' },
                { value: 'interrupted', label: 'Przerwane' },
                { value: 'all', label: 'Wszyscy' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterStatus(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterStatus === item.value
                      ? item.value === 'active' ? 'bg-teal-600 text-white shadow-sm'
                        : item.value === 'discharged' ? 'bg-purple-600 text-white shadow-sm'
                        : item.value === 'interrupted' ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-gray-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Płatność:
            </span>
            <div className="flex gap-1">
              {([
                { value: 'all', label: 'Wszystkie' },
                { value: 'paid', label: 'Opłacone' },
                { value: 'unpaid', label: 'Nieopłacone' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterPaymentStatus(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterPaymentStatus === item.value
                      ? item.value === 'paid' ? 'bg-green-600 text-white shadow-sm'
                        : item.value === 'unpaid' ? 'bg-red-500 text-white shadow-sm'
                        : 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Okres:
            </span>
            <div className="flex gap-1 flex-wrap items-center">
              {([
                { value: 'all', label: 'Wszystkie' },
                { value: 'day', label: 'Dziś' },
                { value: 'week', label: '7 dni' },
                { value: 'month', label: '30 dni' },
                { value: 'custom', label: 'Niestandardowy' }
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilterDateRange(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterDateRange === item.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {filterDateRange === 'custom' && (
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-2 py-1 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-2 py-1 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gray-200"></div>

          {/* Voivodeship Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Region:
            </span>
            <select
              value={filterVoivodeship}
              onChange={(e) => setFilterVoivodeship(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none ${
                filterVoivodeship !== 'all'
                  ? 'bg-purple-600 text-white shadow-sm border-purple-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-100'
              } border`}
            >
              <option value="all">Wszystkie</option>
              {uniqueVoivodeships.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Clear All Filters */}
          {activeFiltersCount > 0 && (
            <>
              <div className="hidden md:block w-px h-6 bg-gray-200"></div>
              <button
                onClick={() => {
                  setFilterPackage('all');
                  setFilterStatus('active');
                  setFilterVoivodeship('all');
                  setFilterDateRange('all');
                  setFilterPaymentStatus('all');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <X className="w-4 h-4" />
                Wyczyść
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile only header for PDF button */}
        <div className="sm:hidden p-4 bg-gray-50 border-b border-gray-200 flex justify-end">
            <button
              onClick={() => generateRegulations()}
              className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium px-3 py-1.5 rounded hover:bg-teal-100 transition-colors"
            >
              <ScrollText className="w-4 h-4" />
              Pobierz Regulamin
            </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 font-semibold text-gray-700 min-w-[200px]">Pacjent / Adres</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[150px]">Kontakt</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[140px]">Terapia / Pakiet</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[220px]">Dodatkowe</th>
                <th className="p-3 font-semibold text-gray-700 min-w-[200px]">Uwagi</th>
                <th className="p-3 font-semibold text-gray-700 text-right min-w-[180px]">Dokumenty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 group">
                  {/* Pacjent / Adres */}
                  <td className={`p-3 align-top ${patient.status === 'discharged' ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                         <div>
                           <span className="font-bold text-gray-900 text-base">{patient.firstName} {patient.lastName}</span>
                           {patient.status === 'discharged' && (
                             <span className={`ml-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                               isInterruptedTherapy(patient)
                                 ? 'bg-orange-100 text-orange-800 border-orange-200'
                                 : 'bg-purple-100 text-purple-800 border-purple-200'
                             }`}>
                               <LogOut className="w-3 h-3" />
                               {patient.dischargeType ? DISCHARGE_TYPE_LABELS[patient.dischargeType] || 'Wypisany' : 'Wypisany'}
                             </span>
                           )}
                           {patient.dischargeType === 'conditional_break' && patient.conditionalReturnDate && (
                             <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                               <Clock className="w-3 h-3" />
                               Powrót: {patient.conditionalReturnDate}
                             </span>
                           )}
                         </div>
                         <div className="flex gap-1 ml-2">
                            <button onClick={() => setEditingPatient(patient)} className="p-1 text-gray-400 hover:text-teal-600" title="Edytuj dane">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDeletePatient(patient.id)} className="p-1 text-gray-400 hover:text-red-600" title="Usuń pacjenta">
                                <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">PESEL: {patient.pesel}</div>
                    <div className="text-xs text-gray-700 mt-2 bg-gray-100 p-1.5 rounded inline-block">
                      {patient.voivodeship}<br/>
                      <span className="text-gray-500">{patient.address}</span>
                    </div>
                  </td>

                  {/* Kontakt */}
                  <td className="p-3 align-top">
                    <div className="font-medium text-gray-900 mb-1">{patient.phone}</div>
                    {patient.hasWhatsapp && (
                      <a 
                        href={getWhatsAppLink(patient.phone)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded mb-2 border border-green-200"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    )}
                    <div className="text-xs text-gray-500 break-all">{patient.email}</div>
                  </td>

                  {/* Terapia / Pakiet */}
                  <td className="p-3 align-top">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${
                      patient.package === '3' ? 'bg-purple-100 text-purple-800' :
                      patient.package === '2' ? 'bg-blue-100 text-blue-800' :
                      patient.package === '6tyg' ? 'bg-cyan-100 text-cyan-800' :
                      patient.package === '8tyg' ? 'bg-emerald-100 text-emerald-800' :
                      patient.package === '6tyg_roz' ? 'bg-indigo-100 text-indigo-800' :
                      patient.package === '8tyg_roz' ? 'bg-fuchsia-100 text-fuchsia-800' :
                      patient.package === 'interwencyjna' ? 'bg-amber-100 text-amber-800' :
                      patient.package === 'vip' ? 'bg-rose-100 text-rose-800' :
                      'bg-teal-100 text-teal-800'
                    }`}>
                      {{ '1': 'Pakiet 1', '2': 'Pakiet 2', '3': 'Pakiet 3', '6tyg': '6 tygodni', '8tyg': '8 tygodni', '6tyg_roz': '6 tyg. rozszerzony', '8tyg_roz': '8 tyg. rozszerzony', 'interwencyjna': 'Terapia interwencyjna', 'vip': 'Grupa VIP' }[patient.package] || patient.package}
                    </span>
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">Start:</span> {patient.treatmentStartDate}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Koniec:</span> {patient.treatmentEndDate}
                    </div>
                    {patient.paymentMethod && (
                      <div className="text-xs text-gray-500 mb-2">
                        <span className="font-semibold">Płatność:</span>{' '}
                        <span className="capitalize">{patient.paymentMethod === 'gotowka' ? 'Gotówka' : patient.paymentMethod === 'przedplata' ? 'Przedpłata' : patient.paymentMethod === 'karta' ? 'Karta' : 'Przelew'}</span>
                      </div>
                    )}
                    <div className="text-xs mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-[10px] uppercase">Do zapłaty:</span>
                        <span className={`font-mono font-bold ${getAmountDue(patient) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(getAmountDue(patient))}
                        </span>
                      </div>
                      <button 
                        onClick={() => openPaymentModal(patient)}
                        className={`p-1.5 rounded-full transition-colors ${getAmountDue(patient) > 0 ? 'text-teal-600 hover:bg-teal-50' : 'text-gray-300 hover:bg-gray-100'}`}
                        title="Rozlicz płatność"
                      >
                        <Wallet className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                  {/* Dodatkowe (5 tydzień / WhatsApp / Konsultacje) */}
                  <td className="p-3 align-top space-y-3">
                    {/* 5 Tydzień Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer group/check">
                      <div 
                        onClick={() => onUpdatePatient({ ...patient, isWeek5: !patient.isWeek5 })}
                        className={`transition-colors ${patient.isWeek5 ? 'text-teal-600' : 'text-gray-400 group-hover/check:text-gray-600'}`}
                      >
                        {patient.isWeek5 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <span className={`text-sm ${patient.isWeek5 ? 'font-bold text-gray-900' : 'text-gray-600'}`}>5 Tydzień</span>
                    </label>

                    {/* WhatsApp Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer group/check">
                      <div 
                        onClick={() => onUpdatePatient({ ...patient, hasWhatsapp: !patient.hasWhatsapp })}
                        className={`transition-colors ${patient.hasWhatsapp ? 'text-green-600' : 'text-gray-400 group-hover/check:text-gray-600'}`}
                      >
                        {patient.hasWhatsapp ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <span className={`text-sm ${patient.hasWhatsapp ? 'font-bold text-gray-900' : 'text-gray-600'}`}>WhatsApp</span>
                    </label>

                    {/* Konsultacje Input */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Konsultacje Online</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={patient.onlineConsultations}
                          onChange={(e) => onUpdatePatient({ ...patient, onlineConsultations: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-black [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:opacity-100"
                        />
                        <span className="text-xs text-gray-500">szt.</span>
                      </div>
                    </div>
                  </td>

                  {/* Uwagi */}
                  <td className="p-3 align-top">
                    <textarea
                      value={patient.notes}
                      onChange={(e) => onUpdatePatient({ ...patient, notes: e.target.value })}
                      placeholder="Wpisz uwagi..."
                      className="w-full h-24 p-2 text-xs border border-gray-200 rounded bg-yellow-50 focus:bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none resize-none transition-colors"
                    />
                  </td>

                  {/* Dokumenty */}
                  <td className="p-3 align-top text-right space-y-2">
                    <button
                      onClick={() => generateContract(patient)}
                      className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-teal-600 text-teal-600 rounded hover:bg-teal-50 text-xs font-medium transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Umowa
                    </button>
                    <button
                      onClick={() => generatePatientCard(patient)}
                      className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-xs font-medium transition-colors"
                    >
                      <User className="w-3 h-3" />
                      Karta
                    </button>
                    {patient.status !== 'discharged' && (
                      <button
                        onClick={() => openDischargeModal(patient)}
                        className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-purple-400 text-purple-600 rounded hover:bg-purple-50 text-xs font-medium transition-colors"
                        title="Wypisz pacjenta"
                      >
                        <LogOut className="w-3 h-3" />
                        Wypisz
                      </button>
                    )}
                    {patient.status === 'discharged' && (
                      <button
                        onClick={() => onReactivatePatient(patient)}
                        className="w-full justify-center inline-flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-600 rounded hover:bg-green-50 text-xs font-medium transition-colors"
                        title="Przywróć pacjenta do aktywnych"
                      >
                        <ArrowRight className="w-3 h-3" />
                        Przywróć
                      </button>
                    )}
                    {patient.refundAmount && patient.refundAmount > 0 && (
                      <div className="text-xs text-red-600 font-medium mt-1 text-center">
                        Zwrot: {formatCurrency(patient.refundAmount)}
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nie znaleziono pacjentów pasujących do wyszukiwania "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientList;