import React, { useState, useEffect, useRef } from 'react';
import { Patient, Payment, QueuePatient, AdditionalService, SERVICE_TYPE_LABELS, formatCurrency } from '../types';
import type { AdditionalServiceType } from '../types';
import { PlusCircle, Calculator, Save, X, Trash2, Search, UserCheck, Stethoscope } from 'lucide-react';

interface PatientFormProps {
  onSubmit: (patient: Patient) => void;
  initialData?: Patient;
  onCancel?: () => void;
  prefillFromQueue?: QueuePatient;
  allPatients?: Patient[];
}

const defaultPatient: Omit<Patient, 'id'> = {
  firstName: '',
  lastName: '',
  pesel: '',
  birthDate: '',
  idSeries: '',
  address: '',
  voivodeship: '',
  phone: '',
  email: '',
  applicationDate: new Date().toISOString().split('T')[0],
  treatmentStartDate: '',
  treatmentEndDate: '',
  package: '1',
  totalAmount: 0,
  amountPaid: 0,
  paymentDeadline: '',
  paymentMethod: 'przelew',
  isWeek5: false,
  hasWhatsapp: false,
  onlineConsultations: 0,
  notes: ''
};

const PatientForm: React.FC<PatientFormProps> = ({ onSubmit, initialData, onCancel, prefillFromQueue, allPatients }) => {
  const [formData, setFormData] = useState<Omit<Patient, 'id'> | Patient>(defaultPatient);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [returningSearch, setReturningSearch] = useState('');
  const [showReturningResults, setShowReturningResults] = useState(false);
  const [returningPrefilled, setReturningPrefilled] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter discharged + VIP patients for returning search
  const returningCandidates = (allPatients || []).filter(p =>
    p.status === 'discharged' || p.package === 'vip'
  );

  const filteredReturning = returningSearch.length >= 2
    ? returningCandidates.filter(p => {
        const q = returningSearch.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.pesel?.includes(q) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        );
      })
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowReturningResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectReturning = (patient: Patient) => {
    const previousStay = patient.treatmentStartDate && patient.treatmentEndDate
      ? `Pobyt ponowny — poprzedni: ${patient.treatmentStartDate} – ${patient.treatmentEndDate}`
      : 'Pobyt ponowny';
    const prevNotes = patient.notes ? `${patient.notes}\n${previousStay}` : previousStay;

    setFormData({
      ...defaultPatient,
      firstName: patient.firstName,
      lastName: patient.lastName,
      pesel: patient.pesel,
      birthDate: patient.birthDate,
      idSeries: patient.idSeries,
      address: patient.address,
      voivodeship: patient.voivodeship,
      phone: patient.phone,
      email: patient.email,
      applicationDate: new Date().toISOString().split('T')[0],
      notes: prevNotes,
    });
    setPayments([]);
    setServices([]);
    setReturningSearch('');
    setShowReturningResults(false);
    setReturningPrefilled(`${patient.firstName} ${patient.lastName}`);
  };

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      // Migracja: stare amountPaid → pierwsza wpłata
      if (initialData.payments && initialData.payments.length > 0) {
        setPayments(initialData.payments);
      } else if (initialData.amountPaid > 0) {
        setPayments([{ amount: initialData.amountPaid, date: '', method: initialData.paymentMethod || 'przelew' }]);
      } else {
        setPayments([]);
      }
      // Load additional services
      setServices(initialData.additionalServices || []);
    }
  }, [initialData]);

  // Pre-fill from queue patient data
  useEffect(() => {
    if (prefillFromQueue) {
      // Jeśli kolejka ma linkedPatientId — weź pełne dane z karty pacjenta (wracający)
      const linked = prefillFromQueue.linkedPatientId
        ? (allPatients || []).find(p => p.id === prefillFromQueue.linkedPatientId)
        : null;

      setFormData(prev => ({
        ...prev,
        // Podstawowe dane: queue > linked > prev
        firstName: prefillFromQueue.firstName || linked?.firstName || prev.firstName,
        lastName: prefillFromQueue.lastName || linked?.lastName || prev.lastName,
        phone: prefillFromQueue.phone || linked?.phone || prev.phone,
        email: prefillFromQueue.email || linked?.email || '',
        // Dane osobowe: z kolejki (wypełnione pełnio), fallback na linked jeśli istnieje
        pesel: prefillFromQueue.pesel || linked?.pesel || '',
        birthDate: prefillFromQueue.birthDate || linked?.birthDate || '',
        idSeries: prefillFromQueue.idSeries || linked?.idSeries || '',
        address: prefillFromQueue.address || linked?.address || '',
        voivodeship: prefillFromQueue.voivodeship || linked?.voivodeship || '',
        // Pakiet i terminy
        package: prefillFromQueue.package,
        amountPaid: prefillFromQueue.depositAmount,
        treatmentStartDate: prefillFromQueue.plannedStartDate || '',
        treatmentEndDate: prefillFromQueue.plannedEndDate || '',
        notes: prefillFromQueue.notes || '',
      }));

      // Transfer deposit as a payment entry with date and method
      if (prefillFromQueue.depositAmount > 0) {
        setPayments([{
          amount: prefillFromQueue.depositAmount,
          date: prefillFromQueue.depositDate || new Date().toISOString().split('T')[0],
          method: 'przedplata',
        }]);
      }

      // Detoks z kolejki → dodaj jako usługę dodatkową
      if (prefillFromQueue.detoks) {
        setServices(prev => {
          const hasDetoks = prev.some(s => s.type === 'detoks');
          if (hasDetoks) return prev;
          return [
            ...prev,
            {
              type: 'detoks' as const,
              date: prefillFromQueue.plannedStartDate || new Date().toISOString().split('T')[0],
              amount: 0,
              note: 'Z kolejki — doprecyzuj kwotę',
            },
          ];
        });
      }
    }
  }, [prefillFromQueue, allPatients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['totalAmount', 'amountPaid', 'payment1Amount', 'payment2Amount', 'payment3Amount'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value
    }));
  };

  const addPayment = () => {
    setPayments(prev => [...prev, { amount: 0, date: new Date().toISOString().split('T')[0], method: 'przelew' }]);
  };

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: keyof Payment, value: string | number) => {
    setPayments(prev => prev.map((p, i) => i === index ? { ...p, [field]: field === 'amount' ? Number(value) : value } : p));
  };

  // Additional services handlers
  const addService = () => {
    setServices(prev => [...prev, { type: 'recepta' as AdditionalServiceType, date: new Date().toISOString().split('T')[0], amount: 0, note: '' }]);
  };

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: keyof AdditionalService, value: string | number) => {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: field === 'amount' ? Number(value) : value } : s));
  };

  const totalServices = services.reduce((sum, s) => sum + (s.amount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If editing (initialData exists), use existing ID, otherwise generate new
    const patientToSave: Patient = {
      ...formData,
      payments,
      additionalServices: services,
      amountPaid: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      id: initialData?.id || crypto.randomUUID()
    };

    onSubmit(patientToSave);
    
    if (!initialData) {
        setFormData(defaultPatient);
        alert("Pacjent został dodany do bazy.");
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const amountDue = formData.totalAmount + totalServices - totalPaid;
  const isVip = formData.package === 'vip';

  // Styling enforcing white background and black text for inputs
  const inputClass = "p-2.5 border border-gray-300 rounded-lg w-full bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm";
  const labelClass = "text-xs text-gray-700 font-bold mb-1 block uppercase tracking-wide";

  const isEditing = !!initialData;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-teal-800 flex items-center gap-2">
          {isEditing ? <Save className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
          {isEditing ? 'Edycja Danych Pacjenta' : 'Nowy Pacjent'}
        </h2>
        {isEditing && onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-red-500">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Returning patient search — only in create mode */}
        {!isEditing && allPatients && allPatients.length > 0 && (
          <div ref={searchRef} className="relative">
            <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3 border-b border-amber-200 pb-2 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Pacjent powracający
            </h3>
            {returningPrefilled ? (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Dane pobrane z bazy: <strong>{returningPrefilled}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReturningPrefilled(null);
                    setFormData(defaultPatient);
                    setPayments([]);
                  }}
                  className="ml-auto text-amber-500 hover:text-red-500 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Wyszukaj wypisanego pacjenta (imię, nazwisko lub PESEL)..."
                    value={returningSearch}
                    onChange={(e) => {
                      setReturningSearch(e.target.value);
                      setShowReturningResults(true);
                    }}
                    onFocus={() => setShowReturningResults(true)}
                    className="pl-10 p-2.5 border border-amber-300 rounded-lg w-full bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
                {showReturningResults && returningSearch.length >= 2 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredReturning.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Brak wyników</div>
                    ) : (
                      filteredReturning.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectReturning(p)}
                          className="w-full text-left px-4 py-3 hover:bg-amber-50 transition border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-gray-900">{p.firstName} {p.lastName}</span>
                              <span className="text-xs text-gray-500 ml-2">PESEL: {p.pesel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.package === 'vip' && (
                                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">VIP</span>
                              )}
                              {p.status === 'discharged' && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                  Wypisany {p.dischargeDate || ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {p.phone} · {p.email}
                            {p.treatmentStartDate && ` · Ostatni pobyt: ${p.treatmentStartDate} – ${p.treatmentEndDate || '?'}`}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Section 1: Personal */}
        <div>
          <h3 className="text-sm font-semibold text-teal-600 uppercase tracking-wider mb-4 border-b pb-2">Dane Personalne</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Imię</label>
              <input required placeholder="Wpisz imię" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nazwisko</label>
              <input required placeholder="Wpisz nazwisko" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PESEL</label>
              <input required placeholder="Wpisz PESEL" name="pesel" value={formData.pesel} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Data Urodzenia</label>
              <input required type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Seria i nr dowodu</label>
              <input required placeholder="Np. ABC 123456" name="idSeries" value={formData.idSeries} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefon</label>
              <input required placeholder="Np. 123 456 789" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input required placeholder="adres@email.com" type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Adres (Ulica, nr, kod, miasto)</label>
              <input required placeholder="Pełny adres zamieszkania" name="address" value={formData.address} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Województwo</label>
              <input required placeholder="Wpisz województwo" name="voivodeship" value={formData.voivodeship} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Section 2: Treatment & Financial */}
        <div>
          <h3 className="text-sm font-semibold text-teal-600 uppercase tracking-wider mb-4 border-b pb-2 pt-2">Szczegóły Terapii i Płatności</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Data zgłoszenia</label>
              <input required type="date" name="applicationDate" value={formData.applicationDate} onChange={handleChange} className={inputClass} />
            </div>
             <div>
              <label className={labelClass}>Początek terapii</label>
              <input required type="date" name="treatmentStartDate" value={formData.treatmentStartDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Koniec terapii</label>
              <input required type="date" name="treatmentEndDate" value={formData.treatmentEndDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Pakiet</label>
              <select name="package" value={formData.package} onChange={handleChange} className={inputClass}>
                <option value="1">Pakiet 1</option>
                <option value="2">Pakiet 2</option>
                <option value="3">Pakiet 3</option>
                <option value="6tyg">6 tygodni</option>
                <option value="8tyg">8 tygodni</option>
                <option value="6tyg_roz">6 tygodni rozszerzony</option>
                <option value="8tyg_roz">8 tygodni rozszerzony</option>
                <option value="interwencyjna">Terapia interwencyjna</option>
                <option value="vip">Grupa VIP</option>
              </select>
            </div>
          </div>

          {isVip ? (
            <div className="mt-6 bg-purple-50 p-4 rounded-lg border border-purple-100 text-purple-700 font-medium text-sm">
              Grupa VIP — bez kwoty do rozliczenia
            </div>
          ) : (
            <>
              {/* Kwota całkowita + termin */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div>
                  <label className="text-xs text-gray-700 font-bold mb-1 block uppercase">Kwota całkowita (PLN)</label>
                  <input required type="number" name="totalAmount" value={formData.totalAmount || ''} onChange={handleChange} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs text-gray-700 font-bold mb-1 block uppercase">Termin zapłaty reszty</label>
                  <input type="date" name="paymentDeadline" value={formData.paymentDeadline} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              {/* Wpłaty — dynamiczna lista */}
              <div className="mt-4 space-y-3">
                {payments.map((payment, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-teal-700 uppercase">Wpłata {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removePayment(index)}
                        className="text-red-400 hover:text-red-600 transition p-1"
                        title="Usuń wpłatę"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Kwota (PLN)</label>
                        <input type="number" value={payment.amount || ''} onChange={(e) => updatePayment(index, 'amount', e.target.value)} className={inputClass} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Data wpłaty</label>
                        <input type="date" value={payment.date || ''} onChange={(e) => updatePayment(index, 'date', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Forma</label>
                        <select value={payment.method || 'przelew'} onChange={(e) => updatePayment(index, 'method', e.target.value)} className={inputClass}>
                          <option value="przelew">Przelew</option>
                          <option value="gotowka">Gotówka</option>
                          <option value="karta">Karta</option>
                          <option value="przedplata">Przedpłata</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPayment}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm hover:bg-teal-50 hover:border-teal-400 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} /> Dodaj wpłatę
                </button>
              </div>

              {/* Usługi dodatkowe — dynamiczna lista */}
              <div className="mt-6 space-y-3">
                <p className="text-sm font-bold text-purple-700 uppercase flex items-center gap-2">
                  <Stethoscope size={16} /> Usługi dodatkowe
                </p>

                {services.map((service, index) => (
                  <div key={index} className="bg-purple-50 p-4 rounded-lg border border-purple-200 relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-purple-700 uppercase">
                        {SERVICE_TYPE_LABELS[service.type] || 'Usługa'} {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="text-red-400 hover:text-red-600 transition p-1"
                        title="Usuń usługę"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Rodzaj</label>
                        <select value={service.type} onChange={(e) => updateService(index, 'type', e.target.value)} className={inputClass}>
                          <option value="recepta">Recepta</option>
                          <option value="psychiatra">Psychiatra</option>
                          <option value="kroplowka">Kroplówka</option>
                          <option value="inne">Inne</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Data</label>
                        <input type="date" value={service.date || ''} onChange={(e) => updateService(index, 'date', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Kwota (PLN)</label>
                        <input type="number" value={service.amount || ''} onChange={(e) => updateService(index, 'amount', e.target.value)} className={inputClass} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold mb-1 block">Uwagi</label>
                        <input type="text" value={service.note || ''} onChange={(e) => updateService(index, 'note', e.target.value)} className={inputClass} placeholder="np. nazwa leku" />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addService}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-purple-300 text-purple-600 font-semibold text-sm hover:bg-purple-50 hover:border-purple-400 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} /> Dodaj usługę
                </button>

                {totalServices > 0 && (
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                      <Stethoscope size={14} />
                      <span>Usługi dodatkowe łącznie: {formatCurrency(totalServices)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Podsumowanie */}
              <div className="mt-4 bg-teal-50 p-4 rounded-lg border border-teal-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-teal-900 font-bold">
                    <Calculator className="w-5 h-5" />
                    <span>Wpłacono łącznie: {formatCurrency(totalPaid)}</span>
                  </div>
                  <div className={`font-bold text-lg ${amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {amountDue > 0 ? `Do zapłaty: ${formatCurrency(amountDue)}` : 'Opłacone w całości ✓'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-4">
            <button type="submit" className="w-full md:w-auto px-8 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors shadow-md hover:shadow-lg">
            {isEditing ? 'Zapisz Zmiany' : 'Zapisz Pacjenta'}
            </button>
            {isEditing && onCancel && (
                 <button type="button" onClick={onCancel} className="w-full md:w-auto px-8 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors">
                 Anuluj
                 </button>
            )}
        </div>
      </form>
    </div>
  );
};

export default PatientForm;