// Logowanie do CRM przez Amazon Cognito: e-mail + hasło + kod z aplikacji w telefonie (obowiązkowy).
// Tokeny trzymamy w sessionStorage: znikają po zamknięciu karty przeglądarki.
import {
  AuthenticationDetails, CognitoUser, CognitoUserPool, CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { AWS_CONFIG } from './config';

const pool = new CognitoUserPool({
  UserPoolId: AWS_CONFIG.userPoolId,
  ClientId: AWS_CONFIG.clientId,
  Storage: window.sessionStorage,
});

export interface Sesja {
  email: string;
  // Nazwa wyświetlana konta (atrybut „name”). W telefonii trafia do pola „owner” kontaktu, jak dotąd nazwa z konta Google.
  nazwa: string;
  konto: string;
  grupy: string[];
  token: string;
  // Token tożsamości (z e-mailem): dla funkcji ordersApi w EduWay, która sprawdza adres na liście dostępu.
  tokenTozsamosci: string;
}

export type KrokLogowania =
  | { krok: 'gotowe'; sesja: Sesja }
  | { krok: 'nowe-haslo' }
  | { krok: 'ustaw-kod'; sekret: string; otpauth: string }
  | { krok: 'podaj-kod' };

let wToku: CognitoUser | null = null;

const naSesje = (s: CognitoUserSession): Sesja => {
  const dostep = s.getAccessToken();
  const id = s.getIdToken().decodePayload();
  return {
    email: String(id.email || ''),
    nazwa: String(id.name || id.email || ''),
    konto: String(dostep.payload.sub),
    grupy: (dostep.payload['cognito:groups'] as string[]) || [],
    token: dostep.getJwtToken(),
    tokenTozsamosci: s.getIdToken().getJwtToken(),
  };
};

const polskiBlad = (e: any): Error => {
  const kod = e?.code || e?.name || '';
  const mapa: Record<string, string> = {
    NotAuthorizedException: 'Niepoprawny e-mail albo hasło.',
    UserNotFoundException: 'Niepoprawny e-mail albo hasło.',
    CodeMismatchException: 'Niepoprawny kod. Sprawdź aplikację w telefonie i spróbuj ponownie.',
    EnableSoftwareTokenMFAException: 'Niepoprawny kod. Sprawdź aplikację w telefonie i spróbuj ponownie.',
    ExpiredCodeException: 'Kod wygasł. Wpisz aktualny kod z aplikacji.',
    InvalidPasswordException: 'Hasło jest za słabe: co najmniej 12 znaków, wielka i mała litera, cyfra i znak specjalny.',
    PasswordResetRequiredException: 'Hasło wymaga zmiany. Skontaktuj się z administratorem.',
    LimitExceededException: 'Za dużo prób. Odczekaj kilka minut.',
    TooManyRequestsException: 'Za dużo prób. Odczekaj kilka minut.',
    UserNotConfirmedException: 'Konto nie jest jeszcze aktywne. Skontaktuj się z administratorem.',
    NetworkError: 'Brak połączenia z serwerem logowania.',
  };
  return new Error(mapa[kod] || 'Logowanie nie powiodło się. Spróbuj ponownie.');
};

// Wspólna obsługa odpowiedzi Cognito dla każdego kroku logowania.
function obsluga(uzytkownik: CognitoUser, email: string, wynik: (k: KrokLogowania) => void, blad: (e: Error) => void) {
  return {
    onSuccess: (s: CognitoUserSession) => { wToku = null; wynik({ krok: 'gotowe', sesja: naSesje(s) }); },
    onFailure: (e: any) => blad(polskiBlad(e)),
    newPasswordRequired: () => { wToku = uzytkownik; wynik({ krok: 'nowe-haslo' }); },
    totpRequired: () => { wToku = uzytkownik; wynik({ krok: 'podaj-kod' }); },
    mfaSetup: () => {
      wToku = uzytkownik;
      uzytkownik.associateSoftwareToken({
        associateSecretCode: (sekret: string) => wynik({
          krok: 'ustaw-kod',
          sekret,
          otpauth: `otpauth://totp/${encodeURIComponent('MyWay CRM')}:${encodeURIComponent(email)}?secret=${sekret}&issuer=${encodeURIComponent('MyWay CRM')}`,
        }),
        onFailure: (e: any) => blad(polskiBlad(e)),
      });
    },
  };
}

export function zaloguj(email: string, haslo: string): Promise<KrokLogowania> {
  const login = email.trim().toLowerCase();
  const uzytkownik = new CognitoUser({ Username: login, Pool: pool, Storage: window.sessionStorage });
  return new Promise((wynik, blad) => {
    uzytkownik.authenticateUser(new AuthenticationDetails({ Username: login, Password: haslo }), obsluga(uzytkownik, login, wynik, blad) as any);
  });
}

export function ustawNoweHaslo(email: string, noweHaslo: string): Promise<KrokLogowania> {
  return new Promise((wynik, blad) => {
    if (!wToku) return blad(new Error('Sesja logowania wygasła. Zacznij od początku.'));
    wToku.completeNewPasswordChallenge(noweHaslo, {}, obsluga(wToku, email.trim().toLowerCase(), wynik, blad) as any);
  });
}

// Pierwsze logowanie: potwierdzenie kodu z nowo dodanej aplikacji.
export function potwierdzUstawienieKodu(kod: string): Promise<KrokLogowania> {
  return new Promise((wynik, blad) => {
    if (!wToku) return blad(new Error('Sesja logowania wygasła. Zacznij od początku.'));
    wToku.verifySoftwareToken(kod.trim(), 'telefon', {
      onSuccess: (s: CognitoUserSession) => { wToku = null; wynik({ krok: 'gotowe', sesja: naSesje(s) }); },
      onFailure: (e: any) => blad(polskiBlad(e)),
    });
  });
}

export function podajKod(email: string, kod: string): Promise<KrokLogowania> {
  return new Promise((wynik, blad) => {
    if (!wToku) return blad(new Error('Sesja logowania wygasła. Zacznij od początku.'));
    wToku.sendMFACode(kod.trim(), obsluga(wToku, email.trim().toLowerCase(), wynik, blad) as any, 'SOFTWARE_TOKEN_MFA');
  });
}

// Aktualna sesja (z automatycznym odświeżeniem tokenu) albo null, gdy trzeba się zalogować.
export function sesja(): Promise<Sesja | null> {
  const u = pool.getCurrentUser();
  if (!u) return Promise.resolve(null);
  return new Promise((wynik) => {
    u.getSession((e: Error | null, s: CognitoUserSession | null) => wynik(e || !s || !s.isValid() ? null : naSesje(s)));
  });
}

export function wyloguj(): void {
  const u = pool.getCurrentUser();
  if (u) u.signOut();
  wToku = null;
}
