import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Activity, AlertTriangle, KeyRound, LogIn, ShieldCheck, Smartphone } from 'lucide-react';
import { KrokLogowania, podajKod, potwierdzUstawienieKodu, Sesja, ustawNoweHaslo, zaloguj } from '../services/aws/auth';

interface LoginProps {
  permissionError?: string | null;
  onZalogowano: (sesja: Sesja) => void;
}

type Ekran = 'haslo' | 'nowe-haslo' | 'ustaw-kod' | 'podaj-kod';

const pole = 'w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600';
const przycisk = 'w-full min-h-[48px] flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600';

const Login: React.FC<LoginProps> = ({ permissionError, onZalogowano }) => {
  const [ekran, setEkran] = useState<Ekran>('haslo');
  const [email, setEmail] = useState('');
  const [haslo, setHaslo] = useState('');
  const [noweHaslo, setNoweHaslo] = useState('');
  const [noweHaslo2, setNoweHaslo2] = useState('');
  const [kod, setKod] = useState('');
  const [sekret, setSekret] = useState('');
  const [qr, setQr] = useState('');
  const [blad, setBlad] = useState<string | null>(null);
  const [czekam, setCzekam] = useState(false);

  useEffect(() => { if (permissionError) setBlad(permissionError); }, [permissionError]);

  const dalej = async (k: KrokLogowania) => {
    setKod('');
    if (k.krok === 'gotowe') return onZalogowano(k.sesja);
    if (k.krok === 'ustaw-kod') {
      setSekret(k.sekret);
      setQr(await QRCode.toDataURL(k.otpauth, { margin: 1, width: 220 }));
    }
    setEkran(k.krok);
  };

  const wykonaj = async (e: React.FormEvent, akcja: () => Promise<KrokLogowania>) => {
    e.preventDefault();
    if (czekam) return;
    setBlad(null);
    setCzekam(true);
    try {
      await dalej(await akcja());
    } catch (err) {
      setBlad((err as Error).message);
    } finally {
      setCzekam(false);
    }
  };

  const wyslijNoweHaslo = (e: React.FormEvent) => {
    if (noweHaslo !== noweHaslo2) {
      e.preventDefault();
      return setBlad('Hasła nie są takie same.');
    }
    return wykonaj(e, () => ustawNoweHaslo(email, noweHaslo));
  };

  const odPoczatku = () => { setEkran('haslo'); setHaslo(''); setNoweHaslo(''); setNoweHaslo2(''); setKod(''); setBlad(null); };

  const naglowek: Record<Ekran, { tytul: string; opis: string }> = {
    'haslo': { tytul: 'Witaj ponownie', opis: 'Zaloguj się, aby uzyskać dostęp do bazy' },
    'nowe-haslo': { tytul: 'Ustaw własne hasło', opis: 'Pierwsze logowanie: zamień hasło tymczasowe na swoje' },
    'ustaw-kod': { tytul: 'Dodaj kod w telefonie', opis: 'Jednorazowa konfiguracja dodatkowego zabezpieczenia konta.' },
    'podaj-kod': { tytul: 'Kod z telefonu', opis: 'Wpisz 6 cyfr z aplikacji z kodami (wpis „MyWay CRM”)' },
  };

  const poleKodu = (
    <input
      id="kod" name="kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
      value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ''))}
      className={`${pole} text-center text-2xl tracking-[0.4em] font-mono`} placeholder="000000" aria-describedby="kod-opis"
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="bg-teal-600 p-8 text-center">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MyWay CRM</h1>
          <p className="text-teal-100 text-sm">Panel zarządzania pacjentami</p>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">{naglowek[ekran].tytul}</h2>
            <p className="text-gray-500 text-sm mt-1">{naglowek[ekran].opis}</p>
          </div>

          {blad && (
            <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{blad}</span>
            </div>
          )}

          {ekran === 'haslo' && (
            <form onSubmit={(e) => wykonaj(e, () => zaloguj(email, haslo))} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input id="email" name="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={pole} />
              </div>
              <div>
                <label htmlFor="haslo" className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
                <input id="haslo" name="haslo" type="password" autoComplete="current-password" required value={haslo} onChange={(e) => setHaslo(e.target.value)} className={pole} />
              </div>
              <button type="submit" disabled={czekam} className={przycisk}>
                <LogIn className="w-5 h-5" aria-hidden="true" />{czekam ? 'Sprawdzam…' : 'Zaloguj się'}
              </button>
            </form>
          )}

          {ekran === 'nowe-haslo' && (
            <form onSubmit={wyslijNoweHaslo} className="space-y-4">
              <div>
                <label htmlFor="nowe" className="block text-sm font-medium text-gray-700 mb-1">Nowe hasło</label>
                <input id="nowe" name="nowe" type="password" autoComplete="new-password" required minLength={12} autoFocus value={noweHaslo} onChange={(e) => setNoweHaslo(e.target.value)} className={pole} aria-describedby="haslo-opis" />
                <p id="haslo-opis" className="text-xs text-gray-500 mt-1">Co najmniej 12 znaków: wielka i mała litera, cyfra i znak specjalny.</p>
              </div>
              <div>
                <label htmlFor="nowe2" className="block text-sm font-medium text-gray-700 mb-1">Powtórz nowe hasło</label>
                <input id="nowe2" name="nowe2" type="password" autoComplete="new-password" required minLength={12} value={noweHaslo2} onChange={(e) => setNoweHaslo2(e.target.value)} className={pole} />
              </div>
              <button type="submit" disabled={czekam} className={przycisk}>
                <KeyRound className="w-5 h-5" aria-hidden="true" />{czekam ? 'Zapisuję…' : 'Ustaw hasło'}
              </button>
            </form>
          )}

          {ekran === 'ustaw-kod' && (
            <form onSubmit={(e) => wykonaj(e, () => potwierdzUstawienieKodu(kod))} className="space-y-4">
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Otwórz w telefonie aplikację Google Authenticator albo Microsoft Authenticator.</li>
                <li>Dodaj nowy wpis i zeskanuj ten kod:</li>
              </ol>
              {qr && <img src={qr} alt="Kod QR do dodania wpisu MyWay CRM w aplikacji z kodami" className="mx-auto rounded-lg border border-gray-200" width={220} height={220} />}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Nie mogę zeskanować, wpiszę klucz ręcznie</summary>
                <p className="mt-2 font-mono break-all bg-gray-50 p-2 rounded border border-gray-200 select-all">{sekret}</p>
              </details>
              <div>
                <label htmlFor="kod" className="block text-sm font-medium text-gray-700 mb-1">3. Wpisz 6 cyfr, które pokazała aplikacja</label>
                {poleKodu}
                <p id="kod-opis" className="sr-only">Sześciocyfrowy kod z aplikacji w telefonie</p>
              </div>
              <button type="submit" disabled={czekam || kod.length !== 6} className={przycisk}>
                <Smartphone className="w-5 h-5" aria-hidden="true" />{czekam ? 'Sprawdzam…' : 'Potwierdź i wejdź'}
              </button>
            </form>
          )}

          {ekran === 'podaj-kod' && (
            <form onSubmit={(e) => wykonaj(e, () => podajKod(email, kod))} className="space-y-4">
              <div>
                <label htmlFor="kod" className="block text-sm font-medium text-gray-700 mb-1">Kod z aplikacji</label>
                {poleKodu}
                <p id="kod-opis" className="text-xs text-gray-500 mt-1">Kod zmienia się co 30 sekund.</p>
              </div>
              <button type="submit" disabled={czekam || kod.length !== 6} className={przycisk}>
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />{czekam ? 'Sprawdzam…' : 'Wejdź'}
              </button>
            </form>
          )}

          {ekran !== 'haslo' && (
            <button type="button" onClick={odPoczatku} className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 underline">Wróć do logowania</button>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            <span>Bezpieczne logowanie. Dane w Unii Europejskiej (Frankfurt).</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
