// Konfiguracja nowego zaplecza CRM na AWS (konto MyWay Produkcja, Frankfurt).
// To identyfikatory publiczne (nie sekrety): przeglądarka i tak je widzi. Dostęp daje dopiero logowanie z kodem z telefonu.
const env = (import.meta as any).env || {};

export const AWS_CONFIG = {
  region: 'eu-central-1',
  userPoolId: env.VITE_COGNITO_POOL_ID || 'eu-central-1_W4CJ896Wx',
  clientId: env.VITE_COGNITO_CLIENT_ID || '2bcttdj4aluitt5nanjgm4f9fh',
  apiUrl: (env.VITE_CRM_API_URL || 'https://g1jms7gi10.execute-api.eu-central-1.amazonaws.com').replace(/\/$/, ''),
  // Odświeżanie danych zamiast stałego połączenia (decyzja D3): co 20 s i od razu po własnym zapisie.
  odswiezanieMs: 20_000,
};
