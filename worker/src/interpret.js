// Van HTTP-status en uitgelezen pagina naar één meetresultaat. Geen netwerk, geen database: zo is het te testen.
import { productFromJsonLd } from "./jsonld.js";
import { parsePriceToCents } from "./price.js";

// status: ok | geblokkeerd | geen_prijs | fout
export function interpretPage({ httpStatus, page, shop }) {
  const base = { httpStatus, priceCents: null, inStock: null, gtin: null, name: null, omnibusLowCents: null };

  if ([401, 403, 429, 503].includes(httpStatus) || page?.captcha) {
    return { ...base, status: "geblokkeerd", detail: page?.captcha ? "captcha" : `http ${httpStatus}` };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ...base, status: "fout", detail: `http ${httpStatus}` };
  }

  const product = productFromJsonLd(page.jsonld);
  if (product) {
    base.gtin = product.gtin;
    base.name = product.name;
  }
  if (product?.priceCents) {
    return { ...base, status: "ok", priceCents: product.priceCents, inStock: product.inStock, detail: null };
  }

  if (shop === "amazon") {
    const a = page.amazon;
    const candidates = [a.label, joinWholeFraction(a.whole, a.fraction), a.legacy].map((x) => (x ?? "").trim());
    const cents = candidates.map(parsePriceToCents).find(Boolean) ?? null;
    if (cents) {
      return { ...base, status: "ok", priceCents: cents, inStock: amazonStock(page.amazon.availability), detail: null };
    }
  }

  if (page.meta.price && (!page.meta.currency || page.meta.currency.toUpperCase() === "EUR")) {
    const cents = parsePriceToCents(normalizeMeta(page.meta.price));
    if (cents) return { ...base, status: "ok", priceCents: cents, inStock: product?.inStock ?? null, detail: "meta" };
  }

  const reason = product ? "product zonder prijs" : "geen product op pagina";
  return { ...base, status: "geen_prijs", detail: page.title ? `${reason}: ${page.title.slice(0, 80)}` : reason };
}

function normalizeMeta(raw) {
  const s = String(raw).trim();
  return /^\d+\.\d{1,2}$/.test(s) ? Number(s) : s;
}

// "298," of "298" plus "89" → "298,89". Nooit "29889".
function joinWholeFraction(whole, fraction) {
  const w = (whole ?? "").trim().replace(/[.,]$/, "");
  const f = (fraction ?? "").trim();
  if (!w) return "";
  return /^\d{2}$/.test(f) ? `${w},${f}` : w;
}

function amazonStock(text) {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return null;
  if (/op voorraad|nog maar \d+ op voorraad|in stock/.test(t)) return true;
  if (/niet (op voorraad|beschikbaar|leverbaar)|currently unavailable|momenteel niet/.test(t)) return false;
  return null;
}
