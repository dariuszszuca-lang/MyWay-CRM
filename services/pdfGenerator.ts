import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, getAmountDue, formatCurrency } from '../types';

// URLs for fonts that support Polish characters (Roboto)
const FONT_URL_REGULAR = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
const FONT_URL_BOLD = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';

// Helper function to convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to load fonts
const loadFonts = async (doc: jsPDF) => {
  try {
    const regularResponse = await fetch(FONT_URL_REGULAR);
    const regularBlob = await regularResponse.arrayBuffer();
    doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regularBlob));
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    const boldResponse = await fetch(FONT_URL_BOLD);
    const boldBlob = await boldResponse.arrayBuffer();
    doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(boldBlob));
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    doc.setFont('Roboto');
    return true;
  } catch (error) {
    console.error("Error loading fonts", error);
    return false;
  }
};

// Helper to add footer with page number
const addPageNumbers = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(`${i}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
};

// Helper to add standard header
const addLogo = (doc: jsPDF) => {
  doc.setFontSize(18);
  doc.setTextColor(13, 148, 136); // Teal-600
  doc.setFont("Roboto", "bold");
  doc.text("MyWay", 170, 15, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("OŚRODEK LECZENIA UZALEŻNIEŃ", 170, 20, { align: 'right' });
  doc.setTextColor(0);
};

export const generatePatientCard = async (patient: Patient) => {
  const doc = new jsPDF();
  await loadFonts(doc);
  
  const marginLeft = 15;

  // Header
  addLogo(doc);
  
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("KARTA UCZESTNIKA TERAPII", 105, 30, { align: 'center' });

  // Section 1: Personal Data
  doc.setFontSize(12);
  doc.text("1. Dane personalne:", marginLeft, 45);

  autoTable(doc, {
    startY: 50,
    theme: 'grid',
    head: [],
    body: [
      ['Imię i nazwisko', `${patient.firstName} ${patient.lastName}`],
      ['Data urodzenia', `${patient.birthDate}             PESEL: ${patient.pesel}`],
      ['Dokument tożsamości', patient.idSeries],
      ['Miejsce zamieszkania', `${patient.address}, ${patient.voivodeship}`],
      ['Telefon', `${patient.phone}             E-mail: ${patient.email}`]
    ],
    styles: { font: 'Roboto', fontSize: 11, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
  });

  // Section 2: Medical Info (Empty as requested)
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.text("2. Informacje dotyczące leczenia:", marginLeft, finalY);

  autoTable(doc, {
    startY: finalY + 5,
    theme: 'grid',
    body: [
      ['Zażywane środki psychoaktywne', '\n\n'],
      ['Dotychczasowe próby leczenia', '\n\n'],
      ['Ważne informacje o stanie zdrowia', '\n\n'],
      ['Uczulenia', '\n'],
      ['Stosowane leki (aktualnie wraz z dawkowaniem)', '\n\n\n']
    ],
    styles: { font: 'Roboto', fontSize: 11, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
  });

  // Page 2
  doc.addPage();
  doc.setFontSize(12);
  doc.text("3. Przekazywanie informacji o uczestniku terapii:", marginLeft, 20);
  
  doc.setFont("Roboto", "bold");
  doc.text("Oświadczenie:", 105, 30, { align: 'center' });
  doc.setFont("Roboto", "normal");

  doc.setFontSize(10);
  doc.text("a) Upoważniam Ośrodek My Way do udzielania informacji o mnie poniższym osobom:", marginLeft, 40);
  doc.text("(dane kontaktowe – imię, nazwisko, rodzaj relacji, nr tel. kontaktowego )", marginLeft, 45);
  
  doc.text("...............................................................................................................................................................", marginLeft, 55);
  doc.text("...............................................................................................................................................................", marginLeft, 65);
  doc.text("...............................................................................................................................................................", marginLeft, 75);

  doc.text("b) Informacje mogą dotyczyć:", marginLeft, 90);
  const checkX = marginLeft + 5;
  doc.rect(checkX, 95, 3, 3); doc.text("Pobytu / opuszczenia ośrodka", checkX + 6, 98);
  doc.rect(checkX, 102, 3, 3); doc.text("Stanu fizycznego / psychicznego w trakcie leczenia", checkX + 6, 105);
  doc.rect(checkX, 109, 3, 3); doc.text("Obserwacji i spostrzeżeń dotyczących funkcjonowania i zaangażowania w proces", checkX + 6, 112);
  doc.text("terapeutycznego, postępów i zmian zachodzących w trakcie trwania terapii,", checkX + 6, 117);
  doc.rect(checkX, 122, 3, 3); doc.text("Zaleceń terapeutycznych dotyczących dalszego kierunku leczenia", checkX + 6, 125);

  const bottomY = 240;
  doc.text(`Kąpino, dnia ${patient.applicationDate}`, marginLeft, bottomY);
  doc.text("Podpis osoby przyjmującej ....................................", marginLeft, bottomY + 20);
  doc.text("Podpis uczestnika terapii ....................................", marginLeft, bottomY + 35);

  addPageNumbers(doc);
  doc.save(`Karta_Pacjenta_${patient.lastName}_${patient.firstName}.pdf`);
};

// 4-Page Contract Generation
export const generateContract = async (patient: Patient) => {
  const doc = new jsPDF();
  await loadFonts(doc);

  const marginLeft = 20;
  const contentWidth = 170;
  const lineHeight = 5;
  let cursorY = 20;

  const writeLine = (text: string, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left', fontSize: number = 10) => {
    doc.setFont("Roboto", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const splitText = doc.splitTextToSize(text, contentWidth);
    doc.text(splitText, align === 'center' ? 105 : (align === 'right' ? 190 : marginLeft), cursorY, { align: align, maxWidth: contentWidth });
    cursorY += (splitText.length * lineHeight);
  };

  const addSpace = (lines: number = 1) => { cursorY += (lines * lineHeight); };

  // --- PAGE 1 ---
  
  // Title
  writeLine("UMOWA O PODJĘCIE TERAPII", true, "center", 14);
  addSpace(2);

  writeLine(`zawarta w dniu ${patient.applicationDate}`, false, "left", 10);
  addSpace();

  writeLine("pomiędzy firmą: Bella Vita 3City Sp. z o.o., NIP: 588-242-22-71, ul. Wichrowe Wzgórza 21, 84-200 Kąpino, zwaną dalej \"Ośrodkiem\"");
  writeLine("a");
  addSpace();

  writeLine(`Panem/Panią: ${patient.firstName} ${patient.lastName}`, true);
  writeLine(`zamieszkały/a: ${patient.address}, ${patient.voivodeship}`, true);
  writeLine(`Dowód osobisty seria i nr: ${patient.idSeries}`, true);
  writeLine(`PESEL: ${patient.pesel}`, true);
  writeLine(`Data urodzenia: ${patient.birthDate}`, true);
  writeLine(`Numer telefonu: ${patient.phone}`, true);
  writeLine(`Adres mailowy: ${patient.email}`, true);
  
  addSpace();
  writeLine("zwaną dalej \"Zlecającym\"");
  addSpace();

  writeLine(`Data rozpoczęcia: ${patient.treatmentStartDate}`, true);
  writeLine(`Data zakończenia: ${patient.treatmentEndDate}`, true);
  addSpace();

  const amountDue = getAmountDue(patient);
  writeLine(`Całościowa kwota terapii: ${formatCurrency(patient.totalAmount)} za pakiet ${patient.package}`);
  writeLine(`Wpłacono zadatek w kwocie: ${formatCurrency(patient.amountPaid)} gotówką / przelewem na konto Ośrodka.`);
  writeLine(`Pozostałą kwotę w wysokości: ${formatCurrency(amountDue)} za terapię`);
  writeLine(`gotówką/ przelewem na konto Ośrodka, wpłacona zostanie do dnia ${patient.paymentDeadline}`, true);

  doc.setFontSize(10);
  doc.text("1", 105, 285, { align: 'center' });

  // --- PAGE 2 ---
  doc.addPage();
  cursorY = 20;
  
  const page2Content = [
    {
      title: "§ 1.",
      text: [
        "1. Zlecający zleca, a Ośrodek zobowiązuje się do udzielania świadczeń terapeutycznych przez okres wskazany w niniejszej umowie.",
        "2. Ośrodek oświadcza, że personel Ośrodka posiada kwalifikacje i uprawnienia niezbędne do udzielania świadczeń terapeutycznych objętych niniejszą umową oraz zobowiązuje się do udzielania tych świadczeń z zachowaniem należytej staranności, zgodnie z zasadami etyki zawodowej oraz zgodnie z posiadaną wiedzą."
      ]
    },
    {
      title: "§ 2.",
      text: [
        "1. Zlecający zobowiązany jest do:",
        "a) przekazania wszystkich znanych mu informacji o swoim stanie zdrowia personelowi Ośrodka w trakcie wstępnego wywiadu przyjęcia na terapię,",
        "b) nie zatajania lub celowego ujawniania jakichkolwiek informacji o swoim stanie zdrowia,",
        "c) korzystania z obiektów Ośrodka wyłącznie w zakresie uzgodnionym z Ośrodkiem oraz zgodnie z Regulaminem ustalonym przez Ośrodek,",
        "d) zapoznania się z Regulaminem Ośrodka i do jego przestrzegania."
      ]
    },
    {
      title: "§ 3.",
      text: [
        "1. Strony ustalają, że warunkiem bezwzględnym do przyjęcia Zlecającego na odbycie świadczenia terapeutycznego jest ujawnienie personelowi Ośrodka wszystkich informacji związanych ze stanem zdrowia Zlecającego.",
        "2. Personel Ośrodka, po konsultacji z lekarzem psychiatrą ma prawo podjęcia decyzji o przerwie w świadczeniu terapeutycznym, jeżeli podczas wstępnego wywiadu przyjęcia lub informacji uzyskanych później dokonana diagnoza stwierdza, że stan zdrowia Zlecającego wymaga zastosowania środków, które powinny być zastosowane w kierunkowo wyspecjalizowanym zakładzie leczniczym lub ośrodku medycznym. W przypadku decyzji o przerwie w przeprowadzeniu zabiegu, okres trwania umowy zostanie przedłużony o czas trwania przerwy a świadczenie terapeutyczne będzie udzielone po zakończeniu ww. przerwy na zasadach określonych w umowie.",
        "3. Ujawnienie w trakcie pobierania świadczenia terapeutycznego celowo zatajonych przez Zlecającego informacji o stanie zdrowia Zlecającego może stanowić, według uznania Ośrodka, podstawę do natychmiastowego rozwiązania umowy w zakresie obowiązków Ośrodka, a wpłacone wynagrodzenie nie podlega zwrotowi.",
        "4. Rażące naruszenie Regulaminu Ośrodka (w szczególności spożywanie alkoholu, zażywanie narkotyków i innych środków psychoaktywnych oraz leków niewydanych z przepisu lekarza) przez Zlecającego w trakcie pobierania świadczenia terapeutycznego może stanowić, według uznania Ośrodka, podstawę do natychmiastowego rozwiązania umowy w zakresie obowiązków Ośrodka, bez prawa zwrotu wynagrodzenia Zlecającemu."
      ]
    },
    {
      title: "§ 4",
      text: [
        "1. Ośrodek jest odpowiedzialny za wykonanie niniejszej umowy na zasadach w niej określonych. 2. Ośrodek nie ponosi odpowiedzialności z tytułu niewykonania lub nienależytego wykonania umowy, jeżeli będzie to wynikiem wyłącznej winy Zlecającego, w szczególności w przypadku samowolnego przerwania procesu terapeutycznego i opuszczenia Ośrodka przez Zlecającego, zatajenia przez Zlecającego informacji na temat jego stanu zdrowia lub rażącego nieprzestrzegania Regulaminu Ośrodka przez Zlecającego.",
        "3. Rezygnacja przez Zlecającego ze świadczenia terapeutycznego nie może stanowić podstawy do zwrotu wynagrodzenia z tytułu realizacji Umowy. W przypadku niemożliwości brania udziału w świadczeniu terapeutycznym przez Zlecającego z przyczyn medycznych, Zlecający ma prawo do odebrania w innym terminie niedostarczonych świadczeń wynikających z umowy po ustaniu tej przeszkody.",
        "4. Ośrodek zapewni Zlecającemu jednorazową konsultację psychiatryczną, koszt każdej następnej konsultacji psychiatrycznej ponosi Zlecający, według aktualnie obowiązującego cennika.",
        "5. Zlecający jest odpowiedzialny względem Ośrodka za wszelkie szkody powstałe swoim zawinionym działaniem w toku realizacji Umowy."
      ]
    }
  ];

  page2Content.forEach(section => {
    writeLine(section.title, true, "center");
    section.text.forEach(t => {
      writeLine(t);
      addSpace(0.5);
    });
  });

  doc.text("2", 105, 285, { align: 'center' });

  // --- PAGE 3 ---
  doc.addPage();
  cursorY = 20;

  const page3Content = [
    {
      title: "§ 5",
      text: [
        "1. W ramach wykonania umowy Pakiet 1 lub Pakiet 2, Zlecającemu przysługuje prawo do:",
        "a) korzystania ze świadczenia terapeutycznego,",
        "b) odbycia jednorazowej konsultacji psychiatrycznej,",
        "c) otrzymania materiałów Terapeutycznych w trakcie pobytu w ośrodku",
        "2. W ramach wykonania umowy Pakiet 3, Zlecającemu przysługuje prawo do:",
        "a) korzystania ze świadczenia terapeutycznego,",
        "b) odbycia jednorazowej konsultacji psychiatrycznej,",
        "c) otrzymania materiałów Terapeutycznych w trakcie pobytu w ośrodku",
        "d) odbycia 20 indywidualnych konsultacji z terapeutą leczenia uzależnień w formie video lub tele-konsultacji,",
        "3. Prawo do świadczeń, o których mowa w ustępie 2 niniejszego paragrafu przysługuje Zlecającemu przez okres 6 miesięcy, licząc od dnia ukończenia terapii."
      ]
    },
    {
      title: "§ 6",
      text: [
        "1. Ośrodek oświadcza, że będzie przetwarzał dane osobowe Zlecającego w sposób zgodny z postanowieniami powszechnie obowiązujących przepisów prawa, w szczególności rozporządzeniem Parlamentu Europejskiego i Rady/EU/2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (Dz. urz. UE L2016, Nr 119, s.1) (zwanym dalej RODO).",
        "2. Zlecający oświadcza, że zapoznał się z klauzulą informacyjną dotyczącą przetwarzania danych osobowych przez Ośrodek, otrzymał ją i wyraża zgodę na jej treść.",
        "3. Zlecający wyraża zgodę na przetwarzanie swoich danych osobowych, w tym adresu e-mail, przez Ośrodek w celu wysyłania wiadomości edukacyjnych, informacyjnych oraz sprzedażowych związanych z działalnością Ośrodka. Zlecający ma prawo do wycofania tej zgody w dowolnym momencie, co nie wpływa na zgodność z prawem przetwarzania, które miało miejsce przed jej wycofaniem. W celu wycofania zgody Zlecający może skontaktować się z Ośrodkiem za pośrednictwem wskazanych kanałów komunikacji."
      ]
    },
    {
      title: "§ 7",
      text: [
        "1. Wszelkie zmiany niniejszej Umowy wymagają formy pisemnej pod rygorem nieważności.",
        "2. Strony oświadczają, że z chwilą zawarcia niniejszej Umowy tracą ważność wszelkie postanowienia ustne lub zawarte w innych umowach sprzeczne z niniejszą umową. Strony nie będą mogły powoływać się na istnienie tychże postanowień w trakcie realizacji niniejszej Umowy.",
        "3. W przypadku uznania przez Sąd któregokolwiek postanowienia niniejszej Umowy za nieważne lub bezskuteczne, pozostałe postanowienia pozostają w mocy, chyba że nieważność lub bezskuteczność danego postanowienia uniemożliwia wykonanie obowiązków przez wszystkie Strony Umowy.",
        "4. Wszelkie spory mogące powstać na podstawie albo w związku z wykonywaniem niniejszej Umowy będą rozpatrywane przez Sąd właściwy ze względu na siedzibę Ośrodka.",
        "5. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednej dla każdej ze Stron."
      ]
    }
  ];

  page3Content.forEach(section => {
    writeLine(section.title, true, "center");
    section.text.forEach(t => {
      writeLine(t);
      addSpace(0.5);
    });
  });

  addSpace();
  writeLine("KLAUZULA INFORMACYJNA DLA OSÓB (PACJENTÓW) KORZYSTAJĄCYCH Z USŁUG OŚRODKA LECZENIA UZALEŻNIEŃ MY WAY", true, "center");
  addSpace();
  
  writeLine("prowadzonego przez Bella Vita 3City Spółkę z ograniczoną odpowiedzialnością z siedzibą w Kąpinie przy ulicy Wichrowe Wzgórza 21, wpisaną do Krajowego Rejestru Sądowego – Rejestru Przedsiębiorców przez Sąd Rejonowy Gdańsk Północ w Gdańsku, VII Wydział Gospodarczy Krajowego Rejestru Sądowego pod numerem KRS: 0000644953.");

  doc.text("3", 105, 285, { align: 'center' });

  // --- PAGE 4 ---
  doc.addPage();
  cursorY = 20;

  const page4Content = [
    "1. Na podstawie art. 13 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych oraz uchylenia dyrektywy 95/46/WE (RODO), informujemy o przetwarzaniu danych oraz prawach związanych z przetwarzaniem tych danych.",
    "2. Administratorem Pani/Pana danych osobowych jest Bella Vita 3City Spółka z ograniczoną odpowiedzialnością z siedzibą w Kąpinie przy ulicy Wichrowe Wzgórza 21, wpisana do Krajowego Rejestru Sądowego – Rejestru Przedsiębiorców przez Sąd Rejonowy Gdańsk Północ w Gdańsku, VII Wydział Gospodarczy Krajowego Rejestru Sądowego pod numerem KRS: 0000644953. W każdej sprawie dotyczącej przetwarzania danych osobowych należy kontaktować się z administratorem poprzez e-mail: kontakt@osrodekleczeniauzaleznien.com.",
    "3. Podstawa i cel przetwarzania danych. Dane osobowe są przetwarzane:",
    "a) na podstawie zgody, w celu udzielania świadczeń dla osób (pacjentów) korzystających z usług Ośrodka Leczenia Uzależnień My Way (zwanego też dalej Ośrodkiem), a także w celu zarządzania usługami opieki zdrowotnej, na podstawie art. 9 ust. 2 lit a. RODO",
    "b) za pośrednictwem systemu monitoringu wizyjnego (wizerunek) w celu ochrony mienia i zwiększenia bezpieczeństwa na terenie Ośrodka Leczenia Uzależnień, na podstawie art. 6 ust. 1 lit f. RODO – prawnie uzasadnionym interesem realizowanym przez administratora jest zapewnienie bezpieczeństwa mienia jak i bezpieczeństwa osób przebywających na terenie ośrodka. Podanie danych w celu określonym w lit a. jest obowiązkowe w celu podjęcia terapii (korzystania z usług) Ośrodka. Dane osobowe nie będą podlegać zautomatyzowanemu podejmowaniu decyzji lub profilowaniu.",
    "4. Przekazywanie danych. Dane mogą być udostępniane podmiotom lub organom upoważnionym na podstawie przepisów prawa, a także na podstawie umów powierzenia, w szczególności osobom świadczącym usługi zdrowotne lub terapeutyczne w Ośrodku, a także dostawcom systemów informatycznych i usług IT w zakresie niezbędnym dla obsługi administracyjno-księgowym, podmiotom świadczącym usługi prawnicze bądź księgowe i podmiotom świadczącym usługi archiwizacji dokumentacji.",
    "5. Czas przechowywania danych. Okres przez jaki będą przechowywane dane jest uzależniony od ich charakteru. Dane zawarte w dokumentach obejmujących umowy, rachunki i wszelkie dane stanowiące podstawę rozliczeń podatkowych przechowywane będą przez okres lat sześciu. Pozostałe dane będą przechowywane przez okres nie dłuższy niżeli trzy lata.",
    "6. Prawa związane z przetwarzaniem danych. Posiada Pani/Pan prawo do dostępu do treści swoich danych/ danych małoletniego, ich sprostowania, a także usunięcia lub ograniczenia przetwarzania, na zasadach określonych w przepisach prawa, w tym RODO, a w przypadku danych przetwarzanych na podstawie zgody – prawo do cofnięcia zgody w dowolnym momencie przy czym cofnięcie zgody nie ma wpływu na zgodność przetwarzania, którego dokonano na jej podstawie przed cofnięciem zgody. Ponadto posiada Pani/Pan również prawo do wniesienia sprzeciwu wobec przetwarzania w sytuacjach przewidzianych przepisami prawa, w tym RODO. Posiada Pani/Pan prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, jeżeli uzna, że przetwarzanie Pani/Pana danych osobowych narusza przepisy."
  ];

  page4Content.forEach(t => {
    writeLine(t);
    addSpace(0.5);
  });

  addSpace(4);
  doc.text("OŚRODEK", marginLeft + 20, cursorY);
  doc.text("ZLECAJĄCY", 130, cursorY);
  
  doc.text(".............................................", marginLeft, cursorY + 20);
  doc.text(".............................................", 120, cursorY + 20);
  
  doc.save(`Umowa_${patient.lastName}_${patient.firstName}.pdf`);
};

export const generateRegulations = async () => {
    const doc = new jsPDF();
    await loadFonts(doc);
    
    const marginLeft = 20;
    const contentWidth = 170;
    const lineHeight = 5;
    let cursorY = 20;

    // Helper similar to generateContract
    const writeLine = (text: string, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left', fontSize: number = 10) => {
        doc.setFont("Roboto", isBold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        const splitText = doc.splitTextToSize(text, contentWidth);
        doc.text(splitText, align === 'center' ? 105 : (align === 'right' ? 190 : marginLeft), cursorY, { align: align, maxWidth: contentWidth });
        cursorY += (splitText.length * lineHeight);
    };
    
    const addSpace = (lines: number = 1) => { cursorY += (lines * lineHeight); };

    addLogo(doc);
    
    cursorY = 40;
    writeLine("REGULAMIN POBYTU", true, "center", 14);
    writeLine("W PRYWATNYM OŚRODKU LECZENIA UZALEŻNIEŃ MY WAY", true, "center", 14);
    addSpace();

    doc.setFontSize(10);

    // Section I
    writeLine("I. Klient w czasie pobytu w Ośrodku zobowiązany jest do:", true);
    const section1 = [
        "1. Utrzymywania całkowitej abstynencji od środków zmieniających nastrój, które nie zostały przepisane przez lekarza.",
        "2. Uczestniczenia we wszystkich zajęciach przewidzianych planem dnia.",
        "3. Punktualnego zgłaszania się na wszystkie zajęcia przewidziane planem dnia.",
        "4. Utrzymywania higieny osobistej i dbania o czystość i ład pomieszczeń na terenie Ośrodka.",
        "5. Należytego dbania o sprzęt, z którego korzysta podczas pobytu w Ośrodku.",
        "6. Przestrzegania ciszy nocnej w godzinach 23.00 – 07.00. W tym czasie pensjonariusze zobowiązani są do przebywania w swoich pokojach.",
        "7. Poddania się badaniu alkomatem. Klient akceptuje w/w urządzenie oraz wyniki jego badań.",
        "8. Poddania się badaniu na wykrywalność substancji psychoaktywnych, które są przeprowadzane przez Specjalistyczne Laboratoria. Klient akceptuje w/w rodzaj badania (w formie testu na mocz) oraz wynik wykonanych badań.",
        "9. Poinformowania terapeuty o chorobach przewlekłych oraz o posiadanych i przyjmowanych lekach.",
        "10. Zachowania w tajemnicy treści poruszanych na zajęciach.",
        "11. Wykonywania poleceń wydawanych przez personel Ośrodka."
    ];
    section1.forEach(line => writeLine(line));
    addSpace(0.5);

    // Section II
    writeLine("II. Klient w czasie pobytu w Ośrodku ma prawo do:", true);
    const section2 = [
        "1. Poinformowania personelu Ośrodka o łamaniu abstynencji lub podejrzenia łamania abstynencji przez inne osoby przebywające w Ośrodku. Personel Ośrodka zapewnia anonimowość osób, które takie informacje przekażą.",
        "2. Zgłaszania personelowi Ośrodka aktualnych problemów.",
        "3. Prowadzenia korespondencji z innymi osobami i instytucjami.",
        "4. Kontaktów telefonicznych w czasie wolnym od zajęć.",
        "5. Oddania do depozytu rzeczy wartościowych.",
        "6. Wymiany pościeli raz na 2 tygodnie.",
        "7. Opuszczać teren Ośrodka co najmniej z dwoma innymi osobami przebywającym w Ośrodku po wcześniejszym ustaleniu z osobą dyżurującą w Ośrodku, bądź wyjścia w towarzystwie osoby dyżurującej.",
        "8. Korzystania z przepustek po wcześniejszym ustaleniu z właścicielami ośrodka."
    ];
    section2.forEach(line => writeLine(line));
    addSpace(0.5);

    // Section III (Part 1)
    writeLine("III. Klientowi w czasie pobytu w Ośrodku nie wolno:", true);
    const section3_part1 = [
        "1. Opuszczać terenu Ośrodka samemu oraz bez wpisu do „książki wyjść”.",
        "2. Przebywać poza Ośrodkiem po godz. 20.00.",
        "3. Przebywać w pokojach innych pensjonariuszy.",
        "4. Posiadać napojów zawierających alkohol.",
        "5. Posiadać środków zmieniających nastrój, które nie zostały przepisane przez lekarza.",
        "6. Grać w gry hazardowe (w tym toto-lotek), spożywać napojów energetyzujących typu „Red Bull”",
        "7. Stosować przemocy fizycznej oraz psychicznej oraz używać wulgaryzmów",
        "8. Utrzymywać kontaktów seksualnych z innymi osobami przebywającymi w Ośrodku.",
        "9. Wchodzić w relacje partnerskie z innymi osobami przebywającymi w Ośrodku.",
        "10. Wychodzić z zajęć bez zgody prowadzącego zajęcia.",
        "11. Negować zasad terapii oraz rozmawiać o nałogowej przeszłości (ile wypiłem, ile ćpałem itp.)",
        "12. Przyjmować wizyty bez wiedzy personelu Ośrodka.",
        "13. Przyjmować i wprowadzać gości bez uzgodnienia tego z personelem Ośrodka.",
        "14. Palić papierosów w całym budynku oraz wprowadzać i dokarmiać zwierzęta na terenie Ośrodka. W przypadku złamania zakazu osoba łamiąca zakaz zostanie obciążona kosztami w kwocie 500 zł."
    ];
    section3_part1.forEach(line => writeLine(line));

    // Page Break
    doc.text("1", 105, 285, { align: 'center' });
    doc.addPage();
    cursorY = 20;

    // Section III (Part 2)
    const section3_part2 = [
        "15. Posiadać przy sobie urządzeń elektronicznych w czasie zajęć.",
        "16. Przynosić na zajęcia jedzenia oraz napojów za wyjątkiem wody.",
        "17. Używać otwartego ognia w pokojach (np. świece, kadzidełka itp.)",
        "18. Ubierać się w wyzywający sposób (np. krótkie spódniczki, dekolty itp.)"
    ];
    section3_part2.forEach(line => writeLine(line));
    addSpace(0.5);

    // Paragraphs
    writeLine("Od decyzji Zespołu Klient może odwołać się do właściciela Ośrodka, który po rozpatrzeniu sprawy podejmuje ostateczną decyzję. O podjętej decyzji powiadamia się Społeczność Ośrodka.");
    addSpace(0.5);
    writeLine("W przypadku usunięcia klienta z powodu naruszania powyższego regulaminu bądź przerwania pobytu w Ośrodku z innych powodów Klientowi nie przysługuje zwrot poniesionych kosztów.");
    addSpace();

    // Postanowienia końcowe
    writeLine("Postanowienia końcowe:", true);
    const footerPoints = [
        "• Personel Ośrodka ma prawo do dokonania rewizji bagażu oraz pomieszczenia mieszkalnego w obecności Klienta.",
        "• W wyjątkowych sytuacjach np. braku możliwości skontaktowania się z pensjonariuszem przebywającym w pokoju, personel Ośrodka ma prawo wejść do pokoju w trosce o bezpieczeństwo Klienta.",
        "• W wyjątkowych przypadkach za zgodą personelu lub właściciela Ośrodka można odstąpić od niektórych punktów regulaminu.",
        "• Jeżeli Klient dokonał zniszczenia powierzonego mu sprzętu lub przez niedbalstwo i lekceważenie dopuścił do jego zniszczenia, ponosi za to odpowiedzialność materialną, co znaczy, że musi naprawić wyrządzoną szkodę na własny koszt, poprzez remont lub zakup nowego sprzętu.",
        "• Ośrodek nie ponosi odpowiedzialności za pieniądze i przedmioty nie oddane przez Klienta do depozytu."
    ];
    footerPoints.forEach(line => writeLine(line));
    addSpace();

    // Statements
    writeLine("Wyrażam zgodę na przetwarzanie moich danych osobowych w zakresie badań na wykrycie substancji psychoaktywnych.");
    addSpace(0.5);
    writeLine("Zapoznałem się z regulaminem Prywatnego Ośrodka Leczenia Uzależnień „My Way” akceptuję wszystkie jego warunki.");
    addSpace(2);

    // Signature
    writeLine("..................................................................");
    
    doc.text("2", 105, 285, { align: 'center' });

    doc.save("Regulamin_MyWay.pdf");
};