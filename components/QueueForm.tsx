import React, { useState, useEffect, useRef } from 'react';
import { QueuePatient, Patient } from '../types';
import { PlusCircle, Save, X, Search, UserCheck } from 'lucide-react';

interface QueueFormProps {
  onSubmit: (patient: QueuePatient) => void;
  initialData?: QueuePatient;
  onCancel?: () => void;
  allPatients?: Patient[];
}

const defaultQueue: Omit<QueuePatient, 'id'> = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  pesel: '',
  birthDate: '',
  idSeries: '',
  address: '',
  voivodeship: '',
  package: '1',
  depositAmount: 0,
  depositDate: new Date().toISOString().split('T')[0],
  plannedStartDate: '',
  plannedEndDate: '',
  notes: '',
  detoks: false,
  linkedPatientId: undefined,
  createdAt: new Date().toISOString().split('T')[0],
  status: 'waiting'
};

const QueueForm: React.FC<QueueFormProps> = ({ onSubmit, initialData, onCancel, allPatients = [] }) => {
  const [formData, setFormData] = useState<Omit<QueuePatient, 'id'> | QueuePatient>(defaultQueue);
  const [returningSearch, setReturningSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Wybrany pacjent wracający — wyliczany live z linkedPatientId
  const linkedPatient = formData.linkedPatientId
    ? allPatients.find(p => p.id === formData.linkedPatientId) || null
    : null;

  // Format daty YYYY-MM-DD → MM.YYYY
  const formatShort = (d?: string) => {
    if (!d) return '';
    const parts = d.split('-');
    return parts.length >= 2 ? `${parts[1]}.${parts[0]}` : d;
  };
  const previousStayLabel = linkedPatient
    ? (linkedPatient.treatmentStartDate
        ? `poprzedni pobyt ${formatShort(linkedPatient.treatmentStartDate)}`
        : 'poprzedni pobyt')
    : '';

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Wyszukiwanie wracających: imię, nazwisko, telefon, PESEL
  const searchResults = React.useMemo(() => {
    const q = returningSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPatients.filter(p => {
      const hay = `${p.firstName} ${p.lastName} ${p.phone || ''} ${p.pesel || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);
  }, [returningSearch, allPatients]);

  const pickReturning = (p: Patient) => {
    setFormData(prev => ({
      ...prev,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone || '',
      email: p.email || '',
      pesel: p.pesel || '',
      birthDate: p.birthDate || '',
      idSeries: p.idSeries || '',
      address: p.address || '',
      voivodeship: p.voivodeship || '',
      linkedPatientId: p.id,
    }));
    setReturningSearch('');
    setShowResults(false);
  };

  const changeSelection = () => {
    // "Zmień" — czyści link, wraca do wyszukiwarki. Dane w formularzu zostają (user może tylko zmienić link).
    setFormData(prev => ({ ...prev, linkedPatientId: undefined }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'depositAmount' ? Number(value) : (type === 'checkbox' ? checked : value)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patientToSave: QueuePatient = {
      ...formData,
      id: initialData?.id || crypto.randomUUID(),
      createdAt: initialData?.createdAt || new Date().toISOString().split('T')[0]
    };
    onSubmit(patientToSave);
    if (!initialData) {
      setFormData(defaultQueue);
    }
  };

  const isEditing = !!initialData;
  const inputClass = "p-2.5 border border-gray-300 rounded-lg w-full bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm";
  const labelClass = "text-xs text-gray-700 font-bold mb-1 block uppercase tracking-wide";
  const sectionHeader = "text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 border-b pb-2 pt-2";

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
          {isEditing ? <Save className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
          {isEditing ? 'Edycja - Kolejka' : 'Dodaj do kolejki'}
        </h2>
        {isEditing && onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-red-500">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Wyszukiwanie wracających */}
        {!isEditing && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4" ref={searchRef}>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-amber-700" />
              <span className="text-sm font-bold text-amber-800">Pacjent wracający?</span>
              <span className="text-xs text-amber-700">Wpisz imię, nazwisko, telefon lub PESEL — zaciągniemy dane z karty.</span>
            </div>
            {linkedPatient ? (
              <div className="flex items-center justify-between bg-green-100 border border-green-300 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <UserCheck className="w-4 h-4" />
                  <span className="font-semibold">
                    Wybrano: {linkedPatient.firstName} {linkedPatient.lastName}
                    {previousStayLabel && <span className="text-green-700 font-normal"> ({previousStayLabel})</span>}
                  </span>
                </div>
                <button type="button" onClick={changeSelection} className="text-green-700 hover:text-amber-700 text-xs font-bold uppercase">
                  Zmień
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={returningSearch}
                  onChange={(e) => { setReturningSearch(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  placeholder="np. Jan Kowalski lub 500 123 456"
                  className={inputClass}
                />
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => pickReturning(p)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-semibold text-gray-900">{p.firstName} {p.lastName}</div>
                        <div className="text-xs text-gray-500">
                          {p.phone && <span>📞 {p.phone}</span>}
                          {p.pesel && <span className="ml-2">PESEL {p.pesel}</span>}
                          {p.status === 'discharged' && <span className="ml-2 text-red-600">(wypisany {p.dischargeDate})</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showResults && returningSearch.length >= 2 && searchResults.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
                    Brak wyników. Wypełnij dane poniżej ręcznie.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dane kontaktowe */}
        <div>
          <h3 className={sectionHeader}>Dane kontaktowe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Imię *</label>
              <input required placeholder="Imię" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nazwisko *</label>
              <input required placeholder="Nazwisko" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefon *</label>
              <input required placeholder="Np. 123 456 789" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input placeholder="adres@email.com" type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Dane osobowe (pełne, żeby przyjęcie było 1 klikiem) */}
        <div>
          <h3 className={sectionHeader}>Dane osobowe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>PESEL</label>
              <input name="pesel" value={formData.pesel || ''} onChange={handleChange} className={inputClass} placeholder="11 cyfr" />
            </div>
            <div>
              <label className={labelClass}>Data urodzenia</label>
              <input type="date" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Seria i nr dowodu</label>
              <input name="idSeries" value={formData.idSeries || ''} onChange={handleChange} className={inputClass} placeholder="ABC 123456" />
            </div>
            <div>
              <label className={labelClass}>Województwo</label>
              <input name="voivodeship" value={formData.voivodeship || ''} onChange={handleChange} className={inputClass} placeholder="np. Pomorskie" />
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className={labelClass}>Adres</label>
              <input name="address" value={formData.address || ''} onChange={handleChange} className={inputClass} placeholder="Ulica, miasto, kod" />
            </div>
          </div>
        </div>

        {/* Pakiet i zaliczka */}
        <div>
          <h3 className={sectionHeader}>Pakiet i zaliczka</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Pakiet *</label>
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
            <div>
              <label className={labelClass}>Zaliczka (PLN)</label>
              <input type="number" name="depositAmount" value={formData.depositAmount || ''} onChange={handleChange} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Data wpłaty zaliczki</label>
              <input type="date" name="depositDate" value={formData.depositDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                <option value="waiting">Oczekuje</option>
                <option value="confirmed">Potwierdzony</option>
                <option value="cancelled">Anulowany</option>
                <option value="noshow">Nie przyjechał</option>
              </select>
            </div>
          </div>
        </div>

        {/* Planowany termin + detoks + uwagi */}
        <div>
          <h3 className={sectionHeader}>Termin i usługi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Od</label>
              <input type="date" name="plannedStartDate" value={formData.plannedStartDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Do</label>
              <input type="date" name="plannedEndDate" value={formData.plannedEndDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Detoks</label>
              <label className="flex items-center gap-2 h-[42px] px-3 bg-white border border-gray-300 rounded-lg cursor-pointer">
                <input type="checkbox" name="detoks" checked={!!formData.detoks} onChange={handleChange} className="w-4 h-4 text-amber-600 rounded" />
                <span className="text-sm text-gray-700">Wymagany detoks</span>
              </label>
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className={labelClass}>Uwagi</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Dodatkowe informacje..." rows={2}
                className="p-2.5 border border-gray-300 rounded-lg w-full bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm resize-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="w-full md:w-auto px-8 py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-md hover:shadow-lg">
            {isEditing ? 'Zapisz zmiany' : 'Dodaj do kolejki'}
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

export default QueueForm;
