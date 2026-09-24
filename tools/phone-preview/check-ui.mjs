import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const out = "/tmp/myway-phone-review";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (
    ["127.0.0.1", "localhost", "cdn.tailwindcss.com"].includes(u.hostname) ||
    u.protocol === "data:"
  )
    return route.continue();
  // Test setup has no permission to contact live Firebase, orders APIs or analytics.
  return route.abort();
});
await page.goto("http://127.0.0.1:3107/tools/phone-preview.html");
await page.getByRole("button", { name: "Telefony", exact: true }).click();
await page.getByRole("heading", { name: "Telefony", exact: true }).waitFor();
await page
  .getByText("Kontakt demonstracyjny 1", { exact: true })
  .filter({ visible: true })
  .waitFor();
assert.equal(
  await page
    .locator("body")
    .evaluate((e) => e.scrollWidth <= window.innerWidth),
  true,
);
await page.screenshot({ path: out + "/desktop.png", fullPage: true });
await page.getByRole("button", { name: "Nowy kontakt", exact: true }).click();
await page
  .getByLabel("Nazwa / ID kontaktu *", { exact: true })
  .fill("Test zapisu z przeglądarki");
await page.getByLabel("Telefon", { exact: true }).fill("");
await page.getByLabel("Minuty", { exact: true }).fill("4");
await page.getByLabel("Sekundy", { exact: true }).fill("15");
await page.getByLabel("Wynik *", { exact: true }).selectOption("Umówiony krok");
await page
  .getByRole("region", { name: "Formularz kontaktu" })
  .getByRole("button", { name: "Zapisz rozmowę", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Rozmowa zapisana." })
  .waitFor();
await page.getByText("4:15", { exact: true }).waitFor();
await page.getByRole("tab", { name: "Kontakty", exact: true }).click();
const row = page
  .getByRole("row")
  .filter({ hasText: "Test zapisu z przeglądarki" });
await row.getByRole("button", { name: "Zapisz rozmowę", exact: true }).click();
await page.getByLabel("Wynik *", { exact: true }).selectOption("Nieodebrany");
await page
  .getByRole("region", { name: "Formularz kontaktu" })
  .getByRole("button", { name: "Zapisz rozmowę", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Rozmowa zapisana." })
  .waitFor();
await page.getByRole("tab", { name: "Analiza", exact: true }).click();
await page.getByRole("heading", { name: "Co wynika z danych" }).waitFor();
await page.screenshot({ path: out + "/analysis.png", fullPage: true });
await page.getByRole("tab", { name: "Raporty", exact: true }).click();
const downloading = page.waitForEvent("download");
await page.getByRole("button", { name: "Pobierz PDF", exact: true }).click();
const downloaded = await downloading;
await downloaded.saveAs(out + "/raport.pdf");
await page
  .getByRole("button", { name: "Zapisz raport w archiwum", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Raport zapisany w archiwum." })
  .waitFor();
await page.getByRole("tab", { name: "Dziennik", exact: true }).click();
for (const width of [768, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  assert.equal(
    await page
      .locator("body")
      .evaluate((e) => e.scrollWidth <= window.innerWidth),
    true,
    `overflow ${width}`,
  );
  await page.screenshot({ path: out + `/width-${width}.png`, fullPage: true });
}
await page.getByRole("button", { name: "Nowy kontakt", exact: true }).click();
await page.screenshot({ path: out + "/mobile-form.png", fullPage: true });
await page.getByRole("button", { name: "Anuluj", exact: true }).click();
await page.getByRole("button", { name: /Baza \(/ }).click();
await page.getByRole("heading", { name: "Lista Pacjentów" }).waitFor();
await page.getByRole("button", { name: "Kolejka", exact: true }).click();
assert.equal(errors.length, 0, errors.join("\n"));
const staff = await context.newPage();
await staff.goto("http://127.0.0.1:3107/tools/phone-preview.html?staff=1");
await staff.getByRole("button", { name: "Telefony", exact: true }).click();
await staff.getByRole("tab", { name: "Kontakty", exact: true }).waitFor();
assert.equal(
  await staff.getByRole("tab", { name: "Analiza", exact: true }).count(),
  0,
);
assert.equal(
  await staff.getByRole("tab", { name: "Raporty", exact: true }).count(),
  0,
);
console.log(
  JSON.stringify({
    passed: true,
    checks: [
      "new contact",
      "followup",
      "PDF",
      "saved report",
      "1440/768/390/320 widths",
      "patient/queue navigation",
      "staff permissions",
      "no JS errors",
    ],
    screenshots: out,
  }),
);
await browser.close();
