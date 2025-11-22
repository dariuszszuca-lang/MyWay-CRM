import React, { useState } from 'react';
import { Patient, getAmountDue, formatCurrency } from '../types';
import { PlusCircle, Calculator } from 'lucide-react';

interface PatientFormProps {
  onAddPatient: (patient: Patient) => void;
}

const initialPatient: Omit<Patient, 'id'> = {
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
  isWeek5: false,
  hasWhatsapp: false,
  onlineConsultations: 0,
  notes: ''
};

const PatientForm: React.FC<PatientFormProps> = ({ onAddPatient }) => {
  const [formData, setFormData] = useState(initialPatient);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'totalAmount' || name === 'amountPaid' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = {
      ...formData,
      id: crypto.randomUUID()
    };
    onAddPatient(newPatient);
    setFormData(initialPatient);
    alert("Pacjent został dodany do bazy.");
  };

  const amountDue = formData.totalAmount - formData.amountPaid;

  // Styling enforcing white background and black text for inputs
  const inputClass = "p-2.5 border border-gray-300 rounded-lg w-full bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm";
  const labelClass = "text-xs text-gray-700 font-bold mb-1 block uppercase tracking-wide";

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-teal-800 mb-6 flex items-center gap-2">
        <PlusCircle className="w-6 h-6" />
        Nowy Pacjent
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
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
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6 bg-gray-50 p-5 rounded-lg border border-gray-200">
            <div>
              <label className="text-xs text-gray-700 font-bold mb-1 block uppercase">Kwota całkowita (PLN)</label>
              <input required type="number" name="totalAmount" value={formData.totalAmount || ''} onChange={handleChange} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-700 font-bold mb-1 block uppercase">Wpłacono (PLN)</label>
              <input required type="number" name="amountPaid" value={formData.amountPaid || ''} onChange={handleChange} className={inputClass} placeholder="0.00" />
            </div>
            <div>
                <label className="text-xs text-gray-700 font-bold mb-1 block uppercase">Termin zapłaty reszty</label>
                <input required type="date" name="paymentDeadline" value={formData.paymentDeadline} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          
          <div className="mt-6 flex items-center gap-2 text-teal-900 font-bold bg-teal-50 p-4 rounded-lg border border-teal-100 shadow-sm">
            <Calculator className="w-5 h-5" />
            <span>Do zapłaty: {formatCurrency(amountDue)}</span>
          </div>
        </div>

        <button type="submit" className="w-full md:w-auto px-8 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors shadow-md hover:shadow-lg">
          Zapisz Pacjenta
        </button>
      </form>
    </div>
  );
};

export default PatientForm;