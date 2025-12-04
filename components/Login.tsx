import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { LogIn, ShieldCheck, Activity, AlertTriangle } from 'lucide-react';

interface LoginProps {
  permissionError?: string | null;
}

const Login: React.FC<LoginProps> = ({ permissionError }) => {
  const [internalError, setInternalError] = useState<string | null>(null);

  // Jeśli pojawi się błąd uprawnień z App.tsx, pokaż go
  useEffect(() => {
    if (permissionError) {
      setInternalError(permissionError);
    }
  }, [permissionError]);

  const handleLogin = async () => {
    try {
      setInternalError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setInternalError("Okno logowania zostało zamknięte.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignoruj podwójne kliknięcia
      } else if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
        setInternalError("Błąd konfiguracji: Niepoprawny klucz API w pliku firebaseConfig.ts");
      } else {
        setInternalError("Błąd logowania. Sprawdź konsolę lub ustawienia domeny w Firebase.");
      }
    }
  };

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
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-800">Witaj ponownie</h2>
            <p className="text-gray-500 text-sm mt-1">Zaloguj się, aby uzyskać dostęp do bazy</p>
          </div>

          {internalError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center border border-red-100 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 font-bold">
                 <AlertTriangle className="w-4 h-4" /> Błąd
              </div>
              {internalError}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow group"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className="w-5 h-5"
            />
            <span className="group-hover:text-gray-900">Zaloguj przez Google</span>
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Połączenie szyfrowane i bezpieczne</span>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-gray-400 text-xs text-center">
        © 2024 MyWay Ośrodek Leczenia Uzależnień
      </p>
    </div>
  );
};

export default Login;