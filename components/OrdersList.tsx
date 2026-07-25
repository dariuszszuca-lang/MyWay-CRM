import React, { useState } from 'react';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES_WITH_EMAIL,
  formatCurrency,
  formatOrderAddress,
  hasFailedStatusEmail,
} from '../types';
import {
  Package, PackageCheck, Truck, ShoppingBag, XCircle, AlertTriangle,
  MailWarning, RefreshCw, ChevronDown, ChevronUp, Phone, Mail, Search,
} from 'lucide-react';

interface Props {
  orders: Order[];
  onChangeStatus: (order: Order, status: OrderStatus) => void;
  onResendEmail: (order: Order) => void;
  busyOrderId: string | null;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; pill: string; icon: any }> = {
  new: { label: ORDER_STATUS_LABELS.new, color: 'bg-blue-100 text-blue-800 border-blue-200', pill: 'bg-blue-600', icon: ShoppingBag },
  accepted: { label: ORDER_STATUS_LABELS.accepted, color: 'bg-amber-100 text-amber-800 border-amber-200', pill: 'bg-amber-600', icon: Package },
  packing: { label: ORDER_STATUS_LABELS.packing, color: 'bg-purple-100 text-purple-800 border-purple-200', pill: 'bg-purple-600', icon: PackageCheck },
  shipped: { label: ORDER_STATUS_LABELS.shipped, color: 'bg-green-100 text-green-800 border-green-200', pill: 'bg-green-600', icon: Truck },
  cancelled: { label: ORDER_STATUS_LABELS.cancelled, color: 'bg-gray-100 text-gray-600 border-gray-200', pill: 'bg-gray-500', icon: XCircle },
};

const ALL_STATUSES: OrderStatus[] = [...ORDER_STATUS_FLOW, 'cancelled'];

const formatDate = (order: Order): string => {
  if (order.orderDate) return order.orderDate;
  if (order.createdAt) return new Date(order.createdAt).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
  return 'brak daty';
};

const formatHistoryDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) : 'brak daty';

const OrdersList: React.FC<Props> = ({ orders, onChangeStatus, onResendEmail, busyOrderId }) => {
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const filtered = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = q === '' ||
      (order.customerName || '').toLowerCase().includes(q) ||
      (order.customerEmail || '').toLowerCase().includes(q) ||
      (order.customerPhone || '').includes(q) ||
      (order.productName || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleSelect = (order: Order, next: OrderStatus) => {
    if (next === order.status) return;

    const currentRank = ORDER_STATUS_FLOW.indexOf(order.status);
    const nextRank = ORDER_STATUS_FLOW.indexOf(next);
    const isBackward = order.status !== 'cancelled' && next !== 'cancelled' && nextRank < currentRank;

    if (next === 'cancelled') {
      if (!window.confirm(`Anulować zamówienie dla ${order.customerName || order.customerEmail}? Klient NIE dostanie o tym maila.`)) return;
    } else if (isBackward || order.status === 'cancelled') {
      if (!window.confirm(`Cofnąć status na "${ORDER_STATUS_LABELS[next]}"? Klient NIE dostanie maila, bo tę wiadomość już wysłaliśmy.`)) return;
    } else if (ORDER_STATUSES_WITH_EMAIL.includes(next)) {
      if (!window.confirm(`Ustawić "${ORDER_STATUS_LABELS[next]}" i wysłać maila do ${order.customerEmail || 'klienta'}?`)) return;
    }

    onChangeStatus(order, next);
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
        Nie ma jeszcze żadnych zamówień Dziennika.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtry i szukajka */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Szukaj: nazwisko, mail, telefon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm text-black"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Wszystkie ({orders.length})
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filterStatus === s ? `${statusConfig[s].pill} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {statusConfig[s].label} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Klient</th>
              <th className="px-4 py-3 font-semibold">Co pakujemy</th>
              <th className="px-4 py-3 font-semibold">Adres wysyłki</th>
              <th className="px-4 py-3 font-semibold">Kwota</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const cfg = statusConfig[order.status];
              const StatusIcon = cfg.icon;
              const addressLines = formatOrderAddress(order.shippingAddress);
              const mailFailed = hasFailedStatusEmail(order);
              const isBusy = busyOrderId === order.id;
              const isExpanded = expandedId === order.id;
              const isCancelled = order.status === 'cancelled';

              return (
                <React.Fragment key={order.id}>
                  <tr className={`border-b last:border-0 hover:bg-gray-50 ${isCancelled ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap align-top">{formatDate(order)}</td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-gray-900">{order.customerName || 'Brak imienia'}</div>
                      {order.customerEmail && (
                        <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                          <Mail className="w-3 h-3" />{order.customerEmail}
                        </div>
                      )}
                      {order.customerPhone && (
                        <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                          <Phone className="w-3 h-3" />{order.customerPhone}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top font-medium text-gray-800">
                      {order.productName || 'Nieznany produkt'}
                    </td>

                    <td className="px-4 py-3 align-top text-gray-600">
                      {addressLines.length > 0 ? (
                        addressLines.map((line, i) => <div key={i}>{line}</div>)
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Brak adresu, dopytaj klienta
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap text-gray-800">
                      {order.amount !== null ? formatCurrency(order.amount) : 'brak'}
                      {order.shippingCost > 0 && (
                        <div className="text-xs text-gray-400">w tym wysyłka {formatCurrency(order.shippingCost)}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border mb-2 ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <select
                        value={order.status}
                        disabled={isBusy}
                        onChange={(e) => handleSelect(order, e.target.value as OrderStatus)}
                        className="block w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-black disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s} disabled={s === 'cancelled' && order.status === 'shipped'}>
                            {statusConfig[s].label}
                          </option>
                        ))}
                      </select>
                      {isBusy && (
                        <div className="flex items-center gap-1 text-xs text-teal-700 mt-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Zapisuję i wysyłam maila...
                        </div>
                      )}
                      {mailFailed && !isBusy && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1 text-xs font-semibold text-red-700">
                            <MailWarning className="w-3.5 h-3.5" />
                            Mail nie wyszedł
                          </div>
                          <button
                            onClick={() => onResendEmail(order)}
                            className="mt-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                          >
                            Wyślij ponownie
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="text-xs font-medium text-gray-600 hover:text-teal-700 flex items-center gap-1 whitespace-nowrap"
                        title="Historia zmian i maili"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Historia
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50 border-b last:border-0">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                          <div>
                            <div className="font-semibold text-gray-700 mb-1">Zmiany statusu</div>
                            {order.statusHistory.length === 0 ? (
                              <div className="text-gray-400">Brak zmian. Zamówienie czeka na przyjęcie do realizacji.</div>
                            ) : (
                              order.statusHistory.map((h, i) => (
                                <div key={i}>
                                  {formatHistoryDate(h.at)}: {ORDER_STATUS_LABELS[h.status] || h.status}
                                  {h.by ? ` (${h.by})` : ''}
                                </div>
                              ))
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-700 mb-1">Maile do klienta</div>
                            <div>
                              Potwierdzenie zakupu: {order.emailSent ? 'wysłane' : 'NIE wysłane'}
                            </div>
                            {order.statusEmails.map((e, i) => (
                              <div key={i} className={e.ok ? '' : 'text-red-700'}>
                                {formatHistoryDate(e.at)}: {ORDER_STATUS_LABELS[e.status] || e.status}
                                {e.ok ? ' wysłany' : ` NIE wysłany (${e.error || 'brak szczegółów'})`}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-3">Numer płatności Stripe: {order.stripeSessionId}</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            Nie ma zamówień pasujących do filtra.
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersList;
