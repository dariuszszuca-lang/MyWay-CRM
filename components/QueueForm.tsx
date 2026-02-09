import React, { useState, useEffect } from 'react';
import { QueuePatient } from '../types';
import { PlusCircle, Save, X } from 'lucide-react';

interface QueueFormProps {
  onSubmit: (patient: QueuePatient) => void;
  initialData?: QueuePatient;
  onCancel?: () => void;
}

const defaultQueue: Omit<QueuePatient, 'id'> = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  package: '1',
  depositAmount: 0,
  depositDate: new Date().toISOString().split('T')[0],
  plannedStartDate: '',
  plannedEndDate: '',
  notes: '',
  createdAt: new Date().toISOString().split('T')[0],
  status: 'waiting'
};

const QueueForm: React.FC<QueueFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const [formData, setFormData] = useState<Omit<QueuePatient, 'id'> | QueuePatient>(defaultQueue);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'depositAmount' ? Number(value) : value
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
        {/* Dane podstawowe */}
        <div>
          <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 border-b pb-2">Dane kontaktowe</h3>
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
              <input placeholder="adres@email.com (opcjonalnie)" type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Pakiet i zaliczka */}
        <div>
          <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 border-b pb-2 pt-2">Pakiet i zaliczka</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Pakiet *</label>
              <select name="package" value={formData.package} onChange={handleChange} className={inputClass}>
                <option value="1">Pakiet 1</option>
                <option value="2">Pakiet 2</option>
                <option value="3">Pakiet 3</option>
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

        {/* Planowany termin */}
        <div>
          <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4 border-b pb-2 pt-2">Planowany termin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Od</label>
              <input type="date" name="plannedStartDate" value={formData.plannedStartDate} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Do</label>
              <input type="date" name="plannedEndDate" value={formData.plannedEndDate} onChange={handleChange} className={inputClass} />
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
