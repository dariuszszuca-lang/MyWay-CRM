import React, { useState, useMemo } from 'react';
import { Patient, formatCurrency, getAmountDue, normalizeVoivodeship, isInterruptedTherapy, DISCHARGE_TYPE_LABELS } from '../types';
import { generateStatsPDF, StatsData } from '../services/pdfGenerator';
import { Download, Users, Wallet, AlertTriangle, TrendingUp, Calendar, RotateCcw, UserX } from 'lucide-react';

interface StatsDashboardProps {
  patients: Patient[];
}

const MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

const StatsDashboard: React.FC<StatsDashboardProps> = ({ patients }) => {
  const [timePeriod, setTimePeriod] = useState<'all' | 'week' | 'month' | '3months' | 'year' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const timePeriodLabel = (period: string) => {
    switch (period) {
      case 'all': return 'Wszystkie';
      case 'week': return 'Tydzień';
      case 'month': return 'Miesiąc';
      case '3months': return '3 miesiące';
      case 'year': return 'Rok';
      case 'custom': return customFrom && customTo ? `${customFrom} — ${customTo}` : 'Niestandardowy';
      default: return period;
    }
  };

  // Filter patients by time period
  const filtered = useMemo(() => {
    if (timePeriod === 'all') return patients;
    if (timePeriod === 'custom') {
      if (!customFrom && !customTo) return patients;
      return patients.filter(p => {
        if (!p.applicationDate) return false;
        const d = new Date(p.applicationDate);
        if (customFrom) {
          const from = new Date(customFrom);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (customTo) {
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }
    const now = new Date();
    return patients.filter(p => {
      if (!p.applicationDate) return false;
      const d = new Date(p.applicationDate);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      switch (timePeriod) {
        case 'week': return diffDays <= 7;
        case 'month': return diffDays <= 30;
        case '3months': return diffDays <= 90;
        case 'year': return diffDays <= 365;
        default: return true;
      }
    });
  }, [patients, timePeriod, customFrom, customTo]);

  // KPIs
  const stats = useMemo(() => {
    const active = filtered.filter(p => p.status !== 'discharged').length;
    const discharged = filtered.filter(p => p.status === 'discharged').length;
    const totalRevenue = filtered.reduce((s, p) => s + p.totalAmount, 0);
    const totalCollected = filtered.reduce((s, p) => s + p.amountPaid, 0);
    const totalOutstanding = filtered.reduce((s, p) => s + getAmountDue(p), 0);
    const unpaidCount = filtered.filter(p => getAmountDue(p) > 0).length;
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

    // Refunds & interrupted therapy
    const totalRefunds = filtered.reduce((s, p) => s + (p.refundAmount || 0), 0);
    const netRevenue = totalCollected - totalRefunds;
    const interruptedCount = filtered.filter(p => isInterruptedTherapy(p)).length;
    const interruptedByType = {
      resignation: filtered.filter(p => p.dischargeType === 'resignation').length,
      referral: filtered.filter(p => p.dischargeType === 'referral').length,
      conditional_break: filtered.filter(p => p.dischargeType === 'conditional_break').length,
      expelled: filtered.filter(p => p.dischargeType === 'expelled').length,
    };

    return { active, discharged, totalRevenue, totalCollected, totalOutstanding, unpaidCount, collectionRate, totalRefunds, netRevenue, interruptedCount, interruptedByType };
  }, [filtered]);

  // Package breakdown
  const packages = useMemo(() => {
    return (['1', '2', '3', 'interwencyjna', 'vip'] as const).map(pkg => {
      const list = filtered.filter(p => p.package === pkg);
      return {
        pkg,
        count: list.length,
        revenue: list.reduce((s, p) => s + p.totalAmount, 0),
        collected: list.reduce((s, p) => s + p.amountPaid, 0),
      };
    });
  }, [filtered]);

  // Voivodeship breakdown
  const voivodeships = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach(p => {
      const name = normalizeVoivodeship(p.voivodeship) || 'Nieznane';
      const existing = map.get(name) || { count: 0, revenue: 0 };
      map.set(name, { count: existing.count + 1, revenue: existing.revenue + p.totalAmount });
    });
    return [...map.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Monthly trends
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(p => {
      if (p.applicationDate) {
        const key = p.applicationDate.substring(0, 7); // YYYY-MM
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => {
        const [y, m] = month.split('-');
        return { month, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, count };
      });
  }, [filtered]);

  const maxMonthly = Math.max(...monthly.map(m => m.count), 1);
  const maxVoiv = Math.max(...voivodeships.map(v => v.count), 1);

  // Export PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const data: StatsData = {
        totalPatients: filtered.length,
        activePatients: stats.active,
        dischargedPatients: stats.discharged,
        totalRevenue: stats.totalRevenue,
        totalCollected: stats.totalCollected,
        totalOutstanding: stats.totalOutstanding,
        collectionRate: stats.collectionRate,
        packageBreakdown: packages,
        voivodeshipBreakdown: voivodeships,
        monthlyTrends: monthly,
        timePeriod: timePeriodLabel(timePeriod),
      };
      await generateStatsPDF(data);
    } catch (err) {
      console.error('Stats PDF error:', err);
      alert('Błąd podczas generowania raportu.');
    } finally {
      setIsExporting(false);
    }
  };

  const pkgColors: Record<string, string> = { '1': 'teal', '2': 'blue', '3': 'purple', 'interwencyjna': 'amber', 'vip': 'rose' };
  const pkgNames: Record<string, string> = { '1': 'Pakiet 1', '2': 'Pakiet 2', '3': 'Pakiet 3', 'interwencyjna': 'Terapia interwencyjna', 'vip': 'Grupa VIP' };

  if (patients.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Brak danych do wyświetlenia. Dodaj pacjentów aby zobaczyć statystyki.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar: Period filter + Export */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Okres:
          </span>
          <div className="flex gap-1 flex-wrap">
            {([
              { value: 'all', label: 'Wszystkie' },
              { value: 'week', label: 'Tydzień' },
              { value: 'month', label: 'Miesiąc' },
              { value: '3months', label: '3 miesiące' },
              { value: 'year', label: 'Rok' },
              { value: 'custom', label: 'Niestandardowy' },
            ] as const).map(item => (
              <button
                key={item.value}
                onClick={() => setTimePeriod(item.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  timePeriod === item.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
            {timePeriod === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Od"
                />
                <span className="text-gray-400 text-sm">—</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Do"
                />
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-medium px-4 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Generowanie...' : 'Pobierz raport PDF'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Pacjenci</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{filtered.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            aktywni: {stats.active} · wypisani: {stats.discharged}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Przychód</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</div>
          <div className="text-xs text-gray-400 mt-1">
            śr. na pacjenta: {filtered.length > 0 ? formatCurrency(stats.totalRevenue / filtered.length) : '-'}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Wpłaty</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalCollected)}</div>
          <div className="text-xs text-gray-400 mt-1">
            ściągalność: {stats.collectionRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Zaległości</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</div>
          <div className="text-xs text-gray-400 mt-1">
            nieopłaconych: {stats.unpaidCount}
          </div>
        </div>

        {/* Refunds KPI */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Zwroty</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalRefunds)}</div>
          <div className="text-xs text-gray-400 mt-1">
            przychód netto: <span className="font-semibold text-gray-700">{formatCurrency(stats.netRevenue)}</span>
          </div>
        </div>

        {/* Interrupted therapy KPI */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserX className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Przerwane terapie</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.interruptedCount}</div>
          <div className="text-xs text-gray-400 mt-1">
            {stats.interruptedByType.resignation > 0 && `rezygnacje: ${stats.interruptedByType.resignation} `}
            {stats.interruptedByType.referral > 0 && `skierowania: ${stats.interruptedByType.referral} `}
            {stats.interruptedByType.conditional_break > 0 && `przerwy: ${stats.interruptedByType.conditional_break} `}
            {stats.interruptedByType.expelled > 0 && `wydaleni: ${stats.interruptedByType.expelled}`}
            {stats.interruptedCount === 0 && 'brak'}
          </div>
        </div>
      </div>

      {/* Packages + Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Packages */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Pakiety</h3>
          <div className="space-y-4">
            {packages.map(p => {
              const pct = filtered.length > 0 ? (p.count / filtered.length) * 100 : 0;
              const color = pkgColors[p.pkg] || 'gray';
              const name = pkgNames[p.pkg] || `Pakiet ${p.pkg}`;
              const barClass =
                color === 'teal' ? 'bg-teal-500' :
                color === 'blue' ? 'bg-blue-500' :
                color === 'purple' ? 'bg-purple-500' :
                color === 'amber' ? 'bg-amber-500' :
                color === 'rose' ? 'bg-rose-500' :
                'bg-gray-500';
              const textClass =
                color === 'teal' ? 'text-teal-700' :
                color === 'blue' ? 'text-blue-700' :
                color === 'purple' ? 'text-purple-700' :
                color === 'amber' ? 'text-amber-700' :
                color === 'rose' ? 'text-rose-700' :
                'text-gray-700';
              return (
                <div key={p.pkg}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-bold ${textClass}`}>{name}</span>
                    <span className="text-sm text-gray-500">
                      {p.count} ({pct.toFixed(0)}%) · {formatCurrency(p.revenue)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Status płatności</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-green-700">Opłacone</span>
                <span className="text-sm text-gray-500">
                  {filtered.length - stats.unpaidCount} · {formatCurrency(stats.totalCollected)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-700"
                  style={{ width: `${stats.collectionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-red-600">Zaległości</span>
                <span className="text-sm text-gray-500">
                  {stats.unpaidCount} · {formatCurrency(stats.totalOutstanding)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-700"
                  style={{ width: `${stats.totalRevenue > 0 ? (stats.totalOutstanding / stats.totalRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCollected)}</div>
              <div className="text-xs text-gray-500">Wpłaty brutto</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalRefunds)}</div>
              <div className="text-xs text-gray-500">Zwroty</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(stats.netRevenue)}</div>
              <div className="text-xs text-gray-500">Przychód netto</div>
            </div>
          </div>
        </div>
      </div>

      {/* Voivodeships */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Województwa</h3>
        <div className="space-y-2.5">
          {voivodeships.map(v => (
            <div key={v.name} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-40 shrink-0 truncate">{v.name}</span>
              <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded bg-purple-500 transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${(v.count / maxVoiv) * 100}%`, minWidth: v.count > 0 ? '28px' : '0' }}
                >
                  <span className="text-[10px] font-bold text-white">{v.count}</span>
                </div>
              </div>
              <span className="text-xs text-gray-500 w-24 text-right shrink-0">{formatCurrency(v.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trends */}
      {monthly.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-4">Przyjęcia miesięczne</h3>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 h-44 min-w-[400px]">
              {monthly.map(m => (
                <div key={m.month} className="flex flex-col items-center flex-1 min-w-[40px]">
                  <span className="text-xs font-bold text-gray-700 mb-1">{m.count}</span>
                  <div
                    className="w-full bg-teal-500 rounded-t transition-all duration-700"
                    style={{ height: `${(m.count / maxMonthly) * 100}%`, minHeight: m.count > 0 ? '8px' : '2px' }}
                  />
                  <span className="text-[10px] text-gray-500 mt-1.5 text-center leading-tight">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsDashboard;
