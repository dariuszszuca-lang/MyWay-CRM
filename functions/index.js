const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// =======================================================================
// RESEND - powiadomienia o sesjach/rezerwacjach (MyWayPoint)
// =======================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmailWithResend(to, subject, html, text) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MyWay Point <rezerwacje@osrodek-myway.pl>",
      to: [to],
      subject: subject,
      html: html,
      text: text,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${error}`);
  }
  return await response.json();
}

function formatDatePL(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

// =======================================================================
// GETRESPONSE - dodawanie pacjentów do list mailingowych + maile
// =======================================================================

const GETRESPONSE_API_KEY = process.env.GETRESPONSE_API_KEY;

const CAMPAIGN_IDS = {
  "1": "iccz2",  // PAKIET 1
  "2": "fzbxf",  // PAKIET 2
  "3": "ij5Ot",  // PAKIET 3
  "interwencyjna": "fuJ9s",  // TERAPIA INTERWENCYJNA
  "vip": "fuJwg",  // GRUPA VIP
};

const ALL_CONTACTS_CAMPAIGN_ID = "Lik0s";  // WSZYSTKIE KONTAKTY
const FROM_FIELD_ID = "zajt2";  // Ośrodek My Way <kontakt@osrodek-myway.pl>

// =======================================================================
// HELPERS
// =======================================================================

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

async function addContactToGetResponse(email, name, campaignId, packageType, phone) {
  const response = await fetch("https://api.getresponse.com/v3/contacts", {
    method: "POST",
    headers: {
      "X-Auth-Token": `api-key ${GETRESPONSE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      name: name,
      campaign: { campaignId: campaignId },
      dayOfCycle: 0,
      customFieldValues: [
        { customFieldId: "naIkxY", value: [packageType || "1"] },
        ...(phone ? [{ customFieldId: "naIF5S", value: [phone] }] : []),
      ],
    }),
  });
  return response;
}

async function findContactByEmail(email) {
  const response = await fetch(
    `https://api.getresponse.com/v3/contacts?query[email]=${encodeURIComponent(email)}`,
    { headers: { "X-Auth-Token": `api-key ${GETRESPONSE_API_KEY}` } }
  );
  if (!response.ok) return null;
  const contacts = await response.json();
  return contacts.length > 0 ? contacts[0].contactId : null;
}

function formatSendDate() {
  const d = new Date(Date.now() + 2 * 60000); // 2 min od teraz
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0000`;
}

async function sendNewsletterToContact(contactId, campaignId, subject, htmlContent, plainContent) {
  const response = await fetch("https://api.getresponse.com/v3/newsletters", {
    method: "POST",
    headers: {
      "X-Auth-Token": `api-key ${GETRESPONSE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      name: `auto-${Date.now()}`,
      campaign: { campaignId },
      fromField: { fromFieldId: FROM_FIELD_ID },
      sendOn: formatSendDate(),
      content: { html: htmlContent, plain: plainContent },
      sendSettings: {
        selectedContacts: [contactId],
        timeTravel: "false",
        perfectTiming: "false",
      },
    }),
  });
  return response;
}

// =======================================================================
// HTML EMAIL TEMPLATES
// =======================================================================

function getWelcomeEmailHtml(firstName, packageType, startDate, endDate) {
  const packageNames = {
    "1": "Pakiet 1 — Podstawowy (28 dni)",
    "2": "Pakiet 2 — Rozszerzony",
    "3": "Pakiet 3 — Stacjonarny (4+1 tygodni)",
    "interwencyjna": "Terapia interwencyjna",
    "vip": "Grupa VIP",
  };
  const packageName = packageNames[packageType] || `Pakiet ${packageType}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <div style="background:linear-gradient(135deg,#0d9488,#14b8a6);padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;">🏡 Ośrodek My Way</h1>
    <p style="color:#ccfbf1;margin:8px 0 0;font-size:14px;">Twój termin został potwierdzony ✓</p>
  </div>

  <div style="padding:32px 24px;">
    <p style="font-size:18px;color:#333;margin:0 0 16px;">Cześć <strong>${firstName}</strong>! 👋</p>

    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
      Potwierdzamy Twój termin w Ośrodku My Way. Cieszymy się, że podejmujesz ten ważny krok. Jesteśmy tu dla Ciebie i będziemy Cię wspierać na każdym etapie.
    </p>

    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 12px;color:#0d9488;font-size:16px;">📋 Szczegóły rezerwacji</h3>
      <table style="width:100%;font-size:14px;color:#555;">
        <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Wariant terapii:</td><td>${packageName}</td></tr>
        ${startDate ? `<tr><td style="padding:6px 0;font-weight:bold;">Data przyjazdu:</td><td><strong style="color:#333;">${startDate}</strong></td></tr>` : ""}
        ${endDate ? `<tr><td style="padding:6px 0;font-weight:bold;">Planowany koniec:</td><td>${endDate}</td></tr>` : ""}
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <p style="font-size:15px;color:#555;margin:0 0 12px;">🎬 Przed przyjazdem poznaj nas lepiej:</p>
      <a href="https://www.youtube.com/watch?v=Q04DVNhJ8gw" style="display:inline-block;background:#0d9488;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Obejrzyj podcast Krystiana →</a>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 12px;color:#92400e;font-size:16px;">🎒 Co spakować?</h3>
      <table style="font-size:14px;color:#555;line-height:1.8;">
        <tr><td>✅ Środki higieny osobistej (szampon, żel, pasta)</td></tr>
        <tr><td>✅ Ręcznik</td></tr>
        <tr><td>✅ Ubrania i bielizna na min. 7 dni (wygodne!)</td></tr>
        <tr><td>✅ Strój sportowy (jeśli lubisz aktywność)</td></tr>
        <tr><td>✅ Obuwie + klapki po ośrodku</td></tr>
        <tr><td>✅ Kurtka dostosowana do pogody</td></tr>
        <tr><td>✅ Laptop i telefon (jeśli jesteś aktywny/a zawodowo)</td></tr>
        <tr><td>✅ Dowód osobisty (potrzebny przy przyjęciu)</td></tr>
        <tr><td>✅ Ulubione lub aktualnie czytane książki</td></tr>
        <tr><td>✅ Leki i suplementy — jeśli przyjmujesz na stałe, zabierz zapas wraz z dawkowaniem i dokumentacją medyczną. <strong>Wszystkie leki przekaż terapeucie w gabinecie lekarskim.</strong></td></tr>
        <tr><td>✅ Papierosy (dostęp do sklepu jest ograniczony regulaminem ośrodka)</td></tr>
      </table>
    </div>

    ${packageType === "3" ? `
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 12px;color:#7c3aed;font-size:16px;">🎁 Bonus w Twoim pakiecie</h3>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">
        Twój pakiet to <strong>4+1 tygodni</strong> — 4 tygodnie terapii stacjonarnej + <strong>dodatkowy tydzień pobytu</strong> do wykorzystania w ciągu <strong>6 miesięcy</strong> od zakończenia terapii. Dodatkowo masz <strong>20 konsultacji indywidualnych</strong> (online lub na miejscu) — <a href="https://mywaypoint.pl" style="color:#7c3aed;font-weight:bold;">umów się przez mywaypoint.pl</a>. Możesz z nich korzystać, kiedy poczujesz taką potrzebę — wystarczy, że do nas zadzwonisz.
      </p>
    </div>
    ` : ""}

    <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:15px;color:#555;margin:0 0 8px;">Masz pytania? Dzwoń śmiało:</p>
      <p style="margin:0;"><a href="tel:+48731395295" style="font-size:20px;color:#0d9488;font-weight:bold;text-decoration:none;">📞 731 395 295</a></p>
      <p style="margin:8px 0 0;"><a href="tel:+48536598821" style="font-size:16px;color:#0d9488;text-decoration:none;">📞 536 598 821</a></p>
    </div>

    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 16px;color:#0d9488;font-size:16px;text-align:center;">🌐 Zostań z nami w kontakcie</h3>
      <table style="width:100%;font-size:14px;color:#555;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;text-align:center;width:50%;vertical-align:top;">
            <a href="https://osrodek-myway.pl" style="color:#0d9488;text-decoration:none;font-weight:bold;">🏡 Nasz ośrodek</a><br>
            <span style="font-size:12px;color:#94a3b8;">osrodek-myway.pl</span>
          </td>
          <td style="padding:8px 0;text-align:center;width:50%;vertical-align:top;">
            <a href="https://mywaypoint.pl" style="color:#0d9488;text-decoration:none;font-weight:bold;">📅 Rezerwacje online</a><br>
            <span style="font-size:12px;color:#94a3b8;">mywaypoint.pl</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;text-align:center;vertical-align:top;">
            <a href="https://edu-myway.pl" style="color:#0d9488;text-decoration:none;font-weight:bold;">🎓 Platforma edukacyjna</a><br>
            <span style="font-size:12px;color:#94a3b8;">edu-myway.pl</span>
          </td>
          <td style="padding:8px 0;text-align:center;vertical-align:top;">
            <a href="https://wygrajtrzezwezycie.pl" style="color:#7c3aed;text-decoration:none;font-weight:bold;">📖 Nasza książka</a><br>
            <span style="font-size:12px;color:#94a3b8;">wygrajtrzezwezycie.pl</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:8px 0;text-align:center;">
            <a href="https://myway-links.lovable.app" style="color:#0d9488;text-decoration:none;font-weight:bold;">📱 Nasze social media</a>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size:15px;color:#555;line-height:1.6;">Do zobaczenia wkrótce! 🙌</p>
    <p style="font-size:15px;color:#333;margin:0;"><strong>Ekipa My Way</strong></p>
  </div>

  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">ul. Wichrowe Wzgórza 21, Kąpino 84-200</p>
  </div>
</div>
</body></html>`;
}

function getWelcomeEmailPlain(firstName, packageType, startDate) {
  const packageNames = {
    "1": "Pakiet 1 — Podstawowy (28 dni)",
    "2": "Pakiet 2 — Rozszerzony",
    "3": "Pakiet 3 — Stacjonarny (4+1 tygodni)",
    "interwencyjna": "Terapia interwencyjna",
    "vip": "Grupa VIP",
  };
  const packageName = packageNames[packageType] || `Pakiet ${packageType}`;
  return `Cześć ${firstName}!\n\nPotwierdzamy Twój termin w Ośrodku My Way.\n\nWariant terapii: ${packageName}\n${startDate ? `Data przyjazdu: ${startDate}\n` : ""}\nCo spakować:\n- Środki higieny osobistej\n- Ręcznik\n- Ubrania na min. 7 dni\n- Strój sportowy\n- Obuwie + klapki\n- Kurtka\n- Laptop i telefon\n- Dowód osobisty\n- Ulubione lub aktualnie czytane książki\n- Leki i suplementy (zapas + dawkowanie, przekaż terapeucie)\n- Papierosy (dostęp do sklepu ograniczony regulaminem)\n${packageType === "3" ? `\nBonus w Twoim pakiecie:\nTwój pakiet to 4+1 tygodni (4 tygodnie stacjonarnie + dodatkowy tydzień do wykorzystania w ciągu 6 miesięcy). Dodatkowo masz 20 konsultacji indywidualnych (online lub na miejscu).\n` : ""}\nMasz pytania? Dzwoń: 731 395 295\n\nDo zobaczenia!\nEkipa My Way\nosrodek-myway.pl`;
}

function getFarewellEmailHtml(firstName, packageType) {
  const isPackage3 = packageType === "3";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;">👊 Gratulacje, ${firstName}!</h1>
    <p style="color:#e9d5ff;margin:8px 0 0;font-size:14px;">To początek Twojej nowej drogi</p>
  </div>

  <div style="padding:32px 24px;">
    <p style="font-size:18px;color:#333;margin:0 0 16px;">Cześć <strong>${firstName}</strong>! 💜</p>

    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
      Właśnie domykasz ważny rozdział. Gratuluję Ci z całego serca — wiemy, ile siły i odwagi kosztowała Cię ta praca. Jesteśmy z Ciebie naprawdę dumni!
    </p>

    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
      Pamiętaj, że wyjazd z ośrodka to nie koniec naszej znajomości. Chcemy Cię dalej wspierać w Twojej drodze.
    </p>

    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 12px;color:#7c3aed;font-size:16px;">🎯 Co mamy dla Ciebie dalej?</h3>
      <table style="font-size:14px;color:#555;line-height:2;">
        ${isPackage3 ? `<tr><td>🏡 <strong>Dodatkowy tydzień pobytu</strong> — masz go do wykorzystania w ciągu 6 miesięcy. Kiedy poczujesz potrzebę — dzwoń i umawiamy termin.</td></tr>
        <tr><td>💬 <strong>20 konsultacji indywidualnych</strong> — online lub na miejscu, <a href="https://mywaypoint.pl" style="color:#7c3aed;font-weight:bold;">umów się przez mywaypoint.pl</a></td></tr>` : ""}
        <tr><td>⭐ <strong>Grupa VIP z Krystianem Nagabą</strong> — dostęp w ramach pakietu</td></tr>
      </table>
    </div>

    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="margin:0 0 12px;color:#065f46;font-size:16px;">🤝 Zostań z nami w kontakcie!</h3>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">
        Trzeźwienie to sport zespołowy, dlatego zapraszamy Cię do naszej społeczności:
      </p>
      <table style="font-size:14px;color:#555;line-height:2;">
        <tr><td>☕ <strong>Zjazdy absolwentów</strong> — w każdą sobotę, godz. 10:00–13:00 w ośrodku. Wpadaj na kawę i rozmowę!</td></tr>
        <tr><td>📱 <strong>Grupa na WhatsApp</strong> — nasza bezpieczna przestrzeń 24/7. Jeśli nie masz dostępu, daj znać!</td></tr>
        <tr><td>🎓 <strong>Platforma edukacyjna</strong> — materiały, ćwiczenia i wsparcie online: <a href="https://edu-myway.pl" style="color:#065f46;font-weight:bold;">edu-myway.pl</a></td></tr>
        <tr><td>🔴 <strong>Live z Krystianem</strong> — transmisje na żywo na naszych social mediach. Bądź na bieżąco!</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <p style="font-size:15px;color:#555;margin:0 0 12px;">📖 Nasza książka — dla Ciebie i Twoich bliskich:</p>
      <a href="https://wygrajtrzezwezycie.pl" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Wygraj Trzeźwe Życie →</a>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:15px;color:#555;margin:0 0 4px;"><strong>Pamiętaj...</strong></p>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 12px;">
        Gdyby działo się coś trudnego albo po prostu będziesz mieć gorszy dzień — dzwoń śmiało:
      </p>
      <p style="margin:0;"><a href="tel:+48536598821" style="font-size:18px;color:#dc2626;font-weight:bold;text-decoration:none;">📞 536 598 821</a></p>
      <p style="margin:4px 0 0;"><a href="tel:+48731395295" style="font-size:18px;color:#dc2626;font-weight:bold;text-decoration:none;">📞 731 395 295</a></p>
    </div>

    <p style="font-size:15px;color:#555;line-height:1.6;">
      Trzymamy za Ciebie mocno kciuki. Powodzenia na „wolności" i do zobaczenia wkrótce! 🙌
    </p>
    <p style="font-size:15px;color:#333;margin:0;">
      Ściskamy,<br><strong>Ekipa My Way</strong> 💚
    </p>
  </div>

  <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <a href="https://osrodek-myway.pl" style="color:#0d9488;font-size:13px;text-decoration:none;">osrodek-myway.pl</a>
    <span style="color:#d1d5db;margin:0 8px;">·</span>
    <a href="https://edu-myway.pl" style="color:#0d9488;font-size:13px;text-decoration:none;">edu-myway.pl</a>
    <span style="color:#d1d5db;margin:0 8px;">·</span>
    <a href="https://wygrajtrzezwezycie.pl" style="color:#7c3aed;font-size:13px;text-decoration:none;">wygrajtrzezwezycie.pl</a>
  </div>
</div>
</body></html>`;
}

function getFarewellEmailPlain(firstName, packageType) {
  const isPackage3 = packageType === "3";
  return `Cześć ${firstName}!\n\nGratulacje — właśnie domykasz ważny rozdział!\n\nCo dalej:\n${isPackage3 ? "- 20 spotkań indywidualnych (online lub na miejscu)\n" : ""}- Grupa VIP z Krystianem Nagabą\n\nZostań z nami:\n- Zjazdy absolwentów — co sobotę 10:00-13:00 w ośrodku\n- Grupa na WhatsApp — nasza przestrzeń 24/7\n- Platforma edukacyjna: https://edu-myway.pl\n- Live z Krystianem — na naszych social mediach\n\nKsiążka: https://wygrajtrzezwezycie.pl\n\nGdyby działo się coś trudnego — dzwoń:\n536 598 821\n731 395 295\n\nŚciskamy!\nEkipa My Way\nosrodek-myway.pl`;
}

// =======================================================================
// CLOUD FUNCTIONS
// =======================================================================

/**
 * Istniejąca funkcja: Dodaje pacjenta do GetResponse (lists only)
 * Wywoływana przy "Przyjmij" (admit from queue to CRM)
 */
exports.addPatientToGetResponse = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ success: false, error: "Method not allowed" }); return; }

    try {
      const { email, firstName, lastName, package: packageType, phone } = req.body;

      if (!email || !firstName || !lastName) {
        res.status(400).json({ success: false, error: "Missing required fields: email, firstName, lastName" });
        return;
      }

      const fullName = `${firstName} ${lastName}`;
      const campaignId = CAMPAIGN_IDS[packageType] || CAMPAIGN_IDS["1"];

      console.log(`📧 Dodawanie ${email} do pakietu ${packageType} (${campaignId}) i WSZYSTKIE KONTAKTY`);

      // 1. Dodaj do listy pakietu
      const packageResponse = await addContactToGetResponse(email, fullName, campaignId, packageType, phone);
      let addedToPackage = false;
      if (packageResponse.ok || packageResponse.status === 202) {
        console.log(`✅ Dodano do listy pakietu ${packageType}`);
        addedToPackage = true;
      } else {
        const errorData = await packageResponse.json();
        if (errorData.code === 1008) {
          console.log(`ℹ️ Kontakt już istnieje w liście pakietu ${packageType}`);
          addedToPackage = true;
        } else {
          console.error("❌ Błąd dodawania do listy pakietu:", errorData);
        }
      }

      // 2. Dodaj do listy WSZYSTKIE KONTAKTY
      let addedToAll = false;
      try {
        const allResponse = await addContactToGetResponse(email, fullName, ALL_CONTACTS_CAMPAIGN_ID, packageType, phone);
        if (allResponse.ok || allResponse.status === 202) {
          console.log("✅ Dodano do WSZYSTKIE KONTAKTY");
          addedToAll = true;
        } else {
          const allError = await allResponse.json();
          if (allError.code === 1008) {
            console.log("ℹ️ Kontakt już istnieje w WSZYSTKIE KONTAKTY");
            addedToAll = true;
          } else {
            console.warn("⚠️ Błąd dodawania do WSZYSTKIE KONTAKTY:", allError);
          }
        }
      } catch (allErr) {
        console.warn("⚠️ Wyjątek przy dodawaniu do WSZYSTKIE KONTAKTY:", allErr);
      }

      res.status(200).json({
        success: true,
        message: `Pacjent ${fullName} dodany do GetResponse`,
        details: {
          package: addedToPackage ? `Pakiet ${packageType}` : "błąd",
          allContacts: addedToAll ? "WSZYSTKIE KONTAKTY" : "błąd",
        },
      });

    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

/**
 * NOWA: Potwierdzenie pacjenta z kolejki
 * - Dodaje do list GetResponse (pakiet + wszystkie kontakty)
 * - Wysyła ładnego maila powitalnego
 */
exports.onPatientConfirmed = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ success: false }); return; }

    try {
      const { email, firstName, lastName, package: pkg, phone, startDate, endDate } = req.body;

      if (!email || !firstName) {
        res.status(400).json({ success: false, error: "Missing email or firstName" });
        return;
      }

      const fullName = `${firstName} ${lastName || ""}`.trim();
      const campaignId = CAMPAIGN_IDS[pkg] || CAMPAIGN_IDS["1"];

      console.log(`🟢 Potwierdzenie: ${fullName} (${email}), Pakiet ${pkg}`);

      // 1. Dodaj do listy pakietu
      const pkgRes = await addContactToGetResponse(email, fullName, campaignId, pkg, phone);
      let addedPkg = pkgRes.ok || pkgRes.status === 202;
      if (!addedPkg) {
        const err = await pkgRes.json();
        addedPkg = err.code === 1008;
        if (addedPkg) console.log(`ℹ️ Już w pakiecie ${pkg}`);
      } else {
        console.log(`✅ Dodano do pakietu ${pkg}`);
      }

      // 2. Dodaj do WSZYSTKIE KONTAKTY
      const allRes = await addContactToGetResponse(email, fullName, ALL_CONTACTS_CAMPAIGN_ID, pkg, phone);
      let addedAll = allRes.ok || allRes.status === 202;
      if (!addedAll) {
        const err = await allRes.json();
        addedAll = err.code === 1008;
        if (addedAll) console.log("ℹ️ Już w WSZYSTKIE KONTAKTY");
      } else {
        console.log("✅ Dodano do WSZYSTKIE KONTAKTY");
      }

      // 3. Poczekaj aż kontakt będzie dostępny
      await new Promise((r) => setTimeout(r, 3000));

      // 4. Znajdź contact ID
      const contactId = await findContactByEmail(email);

      if (!contactId) {
        console.error("❌ Nie znaleziono kontaktu po dodaniu");
        res.status(200).json({
          success: true,
          addedToLists: addedPkg && addedAll,
          emailSent: false,
          message: "Dodano do list, ale nie udało się wysłać maila (kontakt nie znaleziony)",
        });
        return;
      }

      // 5. Wyślij maila powitalnego
      const subject = `Cześć ${firstName}! Potwierdzamy Twój termin w My Way 🏡`;
      const html = getWelcomeEmailHtml(firstName, pkg, startDate, endDate);
      const plain = getWelcomeEmailPlain(firstName, pkg, startDate);

      const nlRes = await sendNewsletterToContact(contactId, ALL_CONTACTS_CAMPAIGN_ID, subject, html, plain);
      let emailSent = false;

      if (nlRes.ok || nlRes.status === 201) {
        console.log("✅ Mail powitalny wysłany");
        emailSent = true;
      } else {
        const nlErr = await nlRes.json();
        console.error("❌ Błąd newslettera:", JSON.stringify(nlErr));
      }

      res.status(200).json({
        success: true,
        addedToLists: addedPkg && addedAll,
        emailSent,
        contactId,
        message: `${fullName} — potwierdzony${emailSent ? ", mail wysłany" : ", mail NIEWYSLANY"}`,
      });

    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

/**
 * NOWA: Wypisanie pacjenta — mail pożegnalny
 */
exports.onPatientDischarged = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ success: false }); return; }

    try {
      const { email, firstName, package: pkg } = req.body;

      if (!email || !firstName) {
        res.status(400).json({ success: false, error: "Missing email or firstName" });
        return;
      }

      console.log(`🔵 Wypisanie: ${firstName} (${email}), Pakiet ${pkg || "?"}`);

      // Znajdź kontakt
      const contactId = await findContactByEmail(email);

      if (!contactId) {
        console.warn("⚠️ Kontakt nie znaleziony w GetResponse");
        res.status(200).json({ success: true, emailSent: false, message: "Kontakt nie znaleziony w GetResponse" });
        return;
      }

      // Wyślij maila pożegnalnego (treść zależy od pakietu)
      const subject = `Gratulacje ${firstName}! To początek Twojej nowej drogi 👊`;
      const html = getFarewellEmailHtml(firstName, pkg);
      const plain = getFarewellEmailPlain(firstName, pkg);

      const nlRes = await sendNewsletterToContact(contactId, ALL_CONTACTS_CAMPAIGN_ID, subject, html, plain);
      let emailSent = false;

      if (nlRes.ok || nlRes.status === 201) {
        console.log("✅ Mail pożegnalny wysłany");
        emailSent = true;
      } else {
        const nlErr = await nlRes.json();
        console.error("❌ Błąd newslettera:", JSON.stringify(nlErr));
      }

      res.status(200).json({
        success: true,
        emailSent,
        message: `Mail pożegnalny dla ${firstName}${emailSent ? " wysłany" : " NIEWYSLANY"}`,
      });

    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

// =======================================================================
// MYWAYPOINT - Rezerwacje (istniejące funkcje)
// =======================================================================

/**
 * Trigger: gdy tworzona jest nowa sesja/rezerwacja (Firestore trigger)
 */
exports.onSessionCreated = functions
  .region("europe-west1")
  .firestore.document("sessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();
    const sessionId = context.params.sessionId;
    console.log("Nowa rezerwacja:", sessionId, session);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Nowa rezerwacja w systemie MyWay Point</h1>
        </div>
        <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 140px;">Usługa:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">Konsultacja Terapeutyczna (${session.therapistName})</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Terapeuta:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.therapistName}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Data:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${formatDatePL(session.date)}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Godzina:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.startTime} - ${session.endTime}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Pacjent:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${session.patientName}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">ID rezerwacji:</td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-family: monospace;">${sessionId.substring(0, 8).toUpperCase()}</td></tr>
            ${session.notes ? `<tr><td style="padding: 10px 0; color: #64748b;">Notatki:</td><td style="padding: 10px 0; color: #1e293b;">${session.notes}</td></tr>` : ""}
          </table>
        </div>
        <div style="background: #1e293b; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
          <p style="color: #94a3b8; margin: 0; font-size: 12px;">Z poważaniem,<br><strong style="color: #fbbf24;">MyWay Point</strong> - System Rezerwacji</p>
        </div>
      </div>`;

    const text = `Nowa rezerwacja w systemie MyWay Point\nUsługa: Konsultacja Terapeutyczna (${session.therapistName})\nTerapeuta: ${session.therapistName}\nData: ${formatDatePL(session.date)}\nGodzina: ${session.startTime} - ${session.endTime}\nPacjent: ${session.patientName}\nID rezerwacji: ${sessionId.substring(0, 8).toUpperCase()}\n${session.notes ? `Notatki: ${session.notes}` : ""}\nMyWay Point`;

    try {
      const result = await sendEmailWithResend("terapia@osrodek-myway.pl", `Nowa rezerwacja - ${session.patientName} u ${session.therapistName}`, html, text);
      console.log("Email wysłany pomyślnie:", result);
      return { success: true, id: result.id };
    } catch (error) {
      console.error("Błąd wysyłania emaila:", error);
      return { success: false, error: error.message };
    }
  });

/**
 * Ręczne wysłanie powiadomienia o sesji
 */
exports.sendSessionNotification = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { sessionId } = data;
    if (!sessionId) throw new functions.https.HttpsError("invalid-argument", "Brak sessionId");

    try {
      const sessionDoc = await admin.firestore().collection("sessions").doc(sessionId).get();
      if (!sessionDoc.exists) throw new functions.https.HttpsError("not-found", "Sesja nie istnieje");

      const session = sessionDoc.data();
      const text = `Przypomnienie o rezerwacji\nTerapeuta: ${session.therapistName}\nData: ${formatDatePL(session.date)}\nGodzina: ${session.startTime} - ${session.endTime}\nPacjent: ${session.patientName}\nMyWay Point`;

      const result = await sendEmailWithResend("terapia@osrodek-myway.pl", `Przypomnienie - ${session.patientName} u ${session.therapistName}`, `<pre>${text}</pre>`, text);
      return { success: true, message: "Email wysłany", id: result.id };
    } catch (error) {
      console.error("Błąd:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * Legacy: stary endpoint dla welcome email (używany przez CRM przy "Przyjmij")
 */
exports.sendWelcomeEmailToPatient = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ success: false, error: "Method not allowed" }); return; }

    try {
      const { email, firstName, lastName, package: packageType, phone } = req.body;
      if (!email || !firstName || !lastName) {
        res.status(400).json({ success: false, error: "Missing required fields" });
        return;
      }

      const fullName = `${firstName} ${lastName}`;
      const campaignId = CAMPAIGN_IDS[packageType] || CAMPAIGN_IDS["1"];

      let addedToPackage = false;
      const packageResponse = await addContactToGetResponse(email, fullName, campaignId, packageType, phone);
      if (packageResponse.ok || packageResponse.status === 202) { addedToPackage = true; }
      else { const err = await packageResponse.json(); if (err.code === 1008) addedToPackage = true; }

      let addedToAll = false;
      try {
        const allResponse = await addContactToGetResponse(email, fullName, ALL_CONTACTS_CAMPAIGN_ID, packageType, phone);
        if (allResponse.ok || allResponse.status === 202) { addedToAll = true; }
        else { const err = await allResponse.json(); if (err.code === 1008) addedToAll = true; }
      } catch (e) { console.warn("⚠️ WSZYSTKIE KONTAKTY:", e); }

      res.status(200).json({
        success: true,
        message: `Pacjent ${fullName} dodany do GetResponse`,
        details: { package: addedToPackage ? `Pakiet ${packageType}` : "błąd", allContacts: addedToAll ? "OK" : "błąd" },
      });
    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

/**
 * Tworzenie pacjenta w MyWayPoint z CRM (Pakiet 3 sync)
 */
exports.createPatientFromCRM = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ success: false, error: "Method not allowed" }); return; }

    try {
      const { firstName, lastName, email, phone, totalSessions, crmPatientId } = req.body;
      if (!firstName || !lastName || !email) {
        res.status(400).json({ success: false, error: "Missing required fields" });
        return;
      }

      const existingPatient = await admin.firestore().collection("patients").where("email", "==", email.toLowerCase()).get();

      if (!existingPatient.empty) {
        const existingDoc = existingPatient.docs[0];
        await existingDoc.ref.update({ crmPatientId: crmPatientId || null, totalSessions: totalSessions || 20, updatedAt: Date.now() });
        res.status(200).json({ success: true, patientId: existingDoc.id, message: "Patient updated" });
        return;
      }

      const patientData = {
        name: `${firstName} ${lastName}`, email: email.toLowerCase(), phone: phone || "",
        totalSessions: totalSessions || 20, usedSessions: 0, sessionsHistory: [],
        notes: "Zaimportowany z MyWay CRM", crmPatientId: crmPatientId || null, createdAt: Date.now(),
      };

      const docRef = await admin.firestore().collection("patients").add(patientData);
      res.status(201).json({ success: true, patientId: docRef.id, message: "Patient created" });
    } catch (error) {
      console.error("Error creating patient from CRM:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
