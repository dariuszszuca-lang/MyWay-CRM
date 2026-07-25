// Zamówienia Dziennika. Dane NIE leżą w bazie tego CRM.
// Źródłem prawdy jest projekt EduWay (tam wpada płatność ze Stripe),
// a my rozmawiamy z nim przez funkcję ordersApi. Do każdego zapytania
// dokładamy token zalogowanego użytkownika CRM, funkcja sprawdza go po stronie serwera
// i porównuje mail z listą dostępu. Spec: klienci/myway/projekty/dziennik-panel-zamowien/SPEC.md

import { auth } from '../firebaseConfig';
import { Order, OrderStatus, PromoCode } from '../types';

const ORDERS_API_URL = 'https://europe-west1-eduway-f13c4.cloudfunctions.net/ordersApi';

interface StatusChangeResult {
  status?: OrderStatus;
  emailOk?: boolean;
  emailSkipped?: boolean;
  error?: string | null;
}

async function authorizedFetch(body: Record<string, unknown> | null, action: string): Promise<any> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nie jesteś zalogowany. Odśwież stronę i zaloguj się ponownie.');
  }

  const token = await user.getIdToken();
  const isPost = body !== null;

  const response = await fetch(isPost ? ORDERS_API_URL : `${ORDERS_API_URL}?action=${action}`, {
    method: isPost ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isPost ? { 'Content-Type': 'application/json' } : {}),
    },
    body: isPost ? JSON.stringify({ action, ...body }) : undefined,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // brak treści albo nie JSON
  }

  if (!response.ok) {
    const detail = data && data.error ? data.error : `Błąd ${response.status}`;
    if (response.status === 401) {
      throw new Error('Sesja wygasła. Odśwież stronę i zaloguj się ponownie.');
    }
    if (response.status === 403) {
      throw new Error('Twoje konto nie ma dostępu do zamówień Dziennika.');
    }
    throw new Error(detail);
  }

  return data;
}

export const listOrders = async (): Promise<Order[]> => {
  const data = await authorizedFetch(null, 'list');
  return Array.isArray(data?.orders) ? (data.orders as Order[]) : [];
};

export const setOrderStatus = async (orderId: string, status: OrderStatus): Promise<StatusChangeResult> => {
  return await authorizedFetch({ orderId, status }, 'status');
};

export const resendStatusEmail = async (orderId: string, status: OrderStatus): Promise<StatusChangeResult> => {
  return await authorizedFetch({ orderId, status }, 'resendEmail');
};

// --- Kody na darmowy Dziennik ---

export const listCodes = async (): Promise<PromoCode[]> => {
  const data = await authorizedFetch(null, 'codes');
  return Array.isArray(data?.codes) ? (data.codes as PromoCode[]) : [];
};

// Zapisuje TYLKO warstwę ręczną (komu wydany, notatka). Kodu i rabatu w Stripe nie ruszamy.
export const saveCodeNote = async (
  code: string,
  fields: { issued: boolean; issuedTo: string; note: string },
): Promise<{ ok?: boolean }> => {
  return await authorizedFetch({ code, ...fields }, 'codeNote');
};
