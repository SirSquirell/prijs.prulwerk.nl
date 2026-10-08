// Pagina lezen en alleen bewaren wat we nodig hebben.
// Bewust een tekstscan en geen HTMLRewriter: het gratis plan geeft 10 ms CPU per aanroep. Gemeten op een
// echte Coolblue-pagina van 1,6 MB: HTMLRewriter 12-16 ms, response.text() plus deze scan 6-9 ms.
// Streamen met vroeg stoppen was trager door de vele kleine stukjes. Zie test/page.test.js voor de fixtures.
import { productFromJsonLd } from "./jsonld.js";

const LD_RE = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

export async function extractPage(response, shop) {
  return extractFromHtml(await response.text(), shop);
}

// Puur: tekst in, gevonden stukken uit.
export function extractFromHtml(text, shop) {
  const page = { jsonld: [], meta: {}, amazon: { availability: "" }, captcha: false, title: "" };

  for (const m of text.matchAll(LD_RE)) page.jsonld.push(m[1]);

  page.title = decodeEntities(text.match(/<title[^>]*>([^<]{0,300})/i)?.[1] ?? "").trim();
  // Met een prijs in de JSON-LD is de rest niet nodig: dat scheelt CPU op grote pagina's.
  if (productFromJsonLd(page.jsonld)?.priceCents) return page;

  page.meta.price = metaContent(text, ["product:price:amount", "og:price:amount"], "price");
  page.meta.currency = metaContent(text, ["product:price:currency", "og:price:currency"], "priceCurrency");
  page.captcha = text.includes("validateCaptcha") || text.includes('id="captcha-container"');

  if (shop === "amazon") Object.assign(page.amazon, amazonParts(text));
  return page;
}

// Alleen het prijsblok bovenaan (de buybox), niet de lijst met andere verkopers.
function amazonParts(text) {
  const parts = { label: "", whole: "", fraction: "", legacy: "", availability: "" };
  const coreAt = text.indexOf('id="corePriceDisplay_desktop_feature_div"');
  if (coreAt >= 0) {
    const core = text.slice(coreAt, coreAt + 20_000);
    parts.label = innerText(core.match(/id="apex-pricetopay-accessibility-label"[^>]*>([^<]*)</)?.[1]);
    const toPay = core.match(/class="[^"]*\bpriceToPay\b[^"]*"[\s\S]{0,1500}/)?.[0] ?? "";
    parts.whole = innerText(toPay.match(/class="a-price-whole">([^<]*)/)?.[1]);
    parts.fraction = innerText(toPay.match(/class="a-price-fraction">([^<]*)/)?.[1]);
  }
  const legacyAt = text.indexOf('id="corePrice_feature_div"');
  if (legacyAt >= 0) {
    parts.legacy = innerText(text.slice(legacyAt, legacyAt + 5_000).match(/class="a-offscreen">([^<]*)/)?.[1]);
  }
  const availAt = text.indexOf('id="availability"');
  if (availAt >= 0) {
    const block = text.slice(availAt, availAt + 2_000).split(/<\/div>/i)[0];
    parts.availability = innerText([...block.matchAll(/<span[^>]*>([^<]*)/g)].map((m) => m[1]).join(" "));
  }
  return parts;
}

function metaContent(text, properties, itemprop) {
  for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
    const prop = attr(tag, "property") ?? attr(tag, "name");
    if ((prop && properties.includes(prop)) || attr(tag, "itemprop") === itemprop) {
      const content = attr(tag, "content");
      if (content) return decodeEntities(content);
    }
  }
  return undefined;
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((x) => x != null);
}

function innerText(s) {
  return decodeEntities(s ?? "").replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
