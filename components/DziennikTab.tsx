import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Order, OrderStatus, ORDER_STATUS_LABELS } from '../types';
import { listOrders, setOrderStatus, resendStatusEmail } from '../services/ordersApi';
import OrdersList from './OrdersList';
import { RefreshCw, Package, Truck, ShoppingBag, AlertTriangle } from 'lucide-react';

// Zamówienia Dziennika. Dane pochodzą z projektu EduWay (tam wpada płatność),
// więc nie ma tu nasłuchu na bazę CRM. Lista odświeża się przyciskiem i sama co minutę.
const AUTO_REFRESH_MS = 60_000;

const DziennikTab: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Nie chcemy, żeby automatyczne odświeżanie podmieniło listę w trakcie zapisu statusu.
  const busyRef = useRef<string | null>(null);
  busyRef.current = busyOrderId;

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await listOrders();
      setOrders(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!busyRef.current) load(false);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleChangeStatus = async (order: Order, status: OrderStatus) => {
    setBusyOrderId(order.id);
    try {
      const result = await setOrderStatus(order.id, status);
      await load(false);

      if (result.emailSkipped) {
        window.alert(`Status zmieniony na "${ORDER_STATUS_LABELS[status]}". Mail do klienta NIE został wysłany (tak ustaliliśmy dla tej zmiany).`);
      } else if (result.emailOk) {
        window.alert(`Gotowe. Status: "${ORDER_STATUS_LABELS[status]}", mail do klienta wysłany.`);
      } else {
        window.alert(`Status zapisany ("${ORDER_STATUS_LABELS[status]}"), ale mail do klienta NIE wyszedł.\n\nSzczegóły: ${result.error || 'brak'}\n\nUżyj przycisku "Wyślij ponownie" w tabeli.`);
      }
    } catch (e) {
      window.alert(`Nie udało się zmienić statusu: ${(e as Error).message}`);
      await load(false);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleResendEmail = async (order: Order) => {
    if (!window.confirm(`Wysłać ponownie maila "${ORDER_STATUS_LABELS[order.status]}" do ${order.customerEmail || 'klienta'}?`)) return;

    setBusyOrderId(order.id);
    try {
      const result = await resendStatusEmail(order.id, order.status);
      await load(false);
      window.alert(result.emailOk
        ? 'Mail wysłany.'
        : `Mail znowu nie wyszedł.\n\nSzczegóły: ${result.error || 'brak'}`);
    } catch (e) {
      window.alert(`Nie udało się wysłać maila: ${(e as Error).message}`);
    } finally {
      setBusyOrderId(null);
    }
  };

  const countBy = (status: OrderStatus) => orders.filter(o => o.status === status).length;
  const missingAddress = orders.filter(
    o => o.status !== 'cancelled' && o.status !== 'shipped' && !o.shippingAddress,
  ).length;

  return (
    <div className="space-y-4">
      {/* Pasek stanu: co czeka na Marcina */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-800">
          <ShoppingBag className="w-3.5 h-3.5 inline mr-1" />
          Nowe zamówienia: {countBy('new')}
        </div>
        <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-800">
          <Package className="w-3.5 h-3.5 inline mr-1" />
          W realizacji: {countBy('accepted') + countBy('packing')}
        </div>
        <div className="bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-medium text-green-800">
          <Truck className="w-3.5 h-3.5 inline mr-1" />
          Wysłane: {countBy('shipped')}
        </div>
        {missingAddress > 0 && (
          <div className="bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
            Bez adresu wysyłki: {missingAddress}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Odświeżono {lastRefresh.toLocaleTimeString('pl-PL')}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-teal-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong className="font-bold">Nie udało się pobrać zamówień: </strong>{error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
          Pobieram zamówienia...
        </div>
      ) : (
        <OrdersList
          orders={orders}
          onChangeStatus={handleChangeStatus}
          onResendEmail={handleResendEmail}
          busyOrderId={busyOrderId}
        />
      )}
    </div>
  );
};

export default DziennikTab;
