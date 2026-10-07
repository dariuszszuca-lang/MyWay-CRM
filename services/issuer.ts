// Wydawca DOKUMENTÓW WYPISOWYCH (dyplom, zaświadczenia): nowa spółka, dane od Darka 21.08.2026.
// 🔴 Umowa, karta uczestnika i regulamin (pdfGenerator.ts) celowo zostają na dotychczasowej spółce
// (Bella Vita 3City) do osobnej decyzji Darka. Nie podpinaj tego pliku tam bez jego zgody.
// KRS nowej spółki: 0001226258, REGON 544354679 (potwierdzone w rejestrze 07.10.2026).
export const ISSUER = {
  name: 'My Way Ośrodek Sp. z o.o.', // nazwa rejestrowa wg KRS 0001226258 (wcześniej błędnie „Ośrodek MyWay Sp. z o.o.”)
  nip: '588-254-52-17',
  brand: 'Ośrodek Leczenia Uzależnień MyWay',
  address: 'ul. Wichrowe Wzgórza 21, 84-200 Kąpino',
  contact: 'osrodek-myway.pl  ·  tel. 731 395 295',
} as const;

// Spółki, które mogą wystawić UMOWĘ (wybór w oknie przed wydrukiem, decyzja Darka 06.10.2026).
// Bella Vita 3City: dotychczasowa treść umowy bez zmian. Ośrodek MyWay Sp. z o.o.: nowa spółka,
// KRS 0001226258 potwierdzony w rejestrze 07.10.2026 (sąd rejestrowy nie jest podany w odpisie z systemu S24, więc go nie wpisujemy).
export type ContractIssuerKey = 'bella' | 'myway';
export const CONTRACT_ISSUERS: Record<ContractIssuerKey, { label: string; party: string; fullName: string; registry: string }> = {
  bella: {
    label: 'Bella Vita 3City Sp. z o.o.',
    party: 'Bella Vita 3City Sp. z o.o., NIP: 588-242-22-71, ul. Wichrowe Wzgórza 21, 84-200 Kąpino',
    fullName: 'Bella Vita 3City',
    registry: 'wpisaną do Krajowego Rejestru Sądowego – Rejestru Przedsiębiorców przez Sąd Rejonowy Gdańsk Północ w Gdańsku, VII Wydział Gospodarczy Krajowego Rejestru Sądowego pod numerem KRS: 0000644953',
  },
  myway: {
    // Dane z KRS (odpis aktualny, stan na 29.08.2026): nazwa rejestrowa to „My Way Ośrodek”, nie „Ośrodek MyWay”.
    label: 'My Way Ośrodek Sp. z o.o.',
    party: 'My Way Ośrodek Sp. z o.o., KRS: 0001226258, NIP: 588-254-52-17, REGON: 544354679, ul. Wichrowe Wzgórza 21, 84-200 Kąpino',
    fullName: 'My Way Ośrodek',
    registry: 'wpisaną do Krajowego Rejestru Sądowego – Rejestru Przedsiębiorców pod numerem KRS: 0001226258, NIP: 588-254-52-17, REGON: 544354679',
  },
};
