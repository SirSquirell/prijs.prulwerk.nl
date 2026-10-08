// schema.org Product/Offer uit JSON-LD-blokken halen.
import { normalizeGtin, parsePriceToCents } from "./price.js";

const IN_STOCK = ["instock", "limitedavailability", "onlineonly", "instoreonly"];
const OUT_OF_STOCK = ["outofstock", "soldout", "discontinued", "preorder", "presale", "backorder"];

// texts: inhoud van <script type="application/ld+json">-blokken.
// Geeft { name, gtin, priceCents, inStock, currency } of null als er geen Product in staat.
export function productFromJsonLd(texts) {
  const nodes = [];
  for (const text of texts) {
    const parsed = safeParse(text);
    if (parsed !== undefined) collectNodes(parsed, nodes);
  }
  const products = nodes.filter((n) => hasType(n, "Product"));
  for (const product of products) {
    const offer = pickOffer(product.offers);
    if (!offer) continue;
    return {
      name: typeof product.name === "string" ? product.name.trim() : null,
      gtin: gtinOf(product) ?? gtinOf(offer.node),
      priceCents: offer.priceCents,
      currency: offer.currency,
      inStock: offer.inStock,
    };
  }
  if (products.length) {
    const p = products[0];
    return { name: typeof p.name === "string" ? p.name.trim() : null, gtin: gtinOf(p), priceCents: null, currency: null, inStock: null };
  }
  return null;
}

function safeParse(text) {
  const t = text.trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    // Sommige winkels zetten letterlijke regeleinden in strings.
    try {
      return JSON.parse(t.replace(/[\r\n\t]+/g, " "));
    } catch {
      return undefined;
    }
  }
}

function collectNodes(value, out) {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out);
  } else if (value && typeof value === "object") {
    out.push(value);
    if (value["@graph"]) collectNodes(value["@graph"], out);
    if (value.mainEntity) collectNodes(value.mainEntity, out);
  }
}

function hasType(node, type) {
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.replace(/^.*[/:]/, "") === type);
}

// De eerste bruikbare aanbieding in euro's. Bij een AggregateOffer de laagste prijs.
function pickOffer(offers) {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    if (hasType(o, "AggregateOffer")) {
      const inner = pickOffer(o.offers);
      if (inner) return inner;
      const cents = parsePriceToCents(o.lowPrice ?? o.price);
      const currency = o.priceCurrency ?? null;
      if (cents && isEuro(currency)) return { node: o, priceCents: cents, currency: "EUR", inStock: stock(o.availability) };
      continue;
    }
    const spec = Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification;
    const rawPrice = o.price ?? spec?.price;
    const currency = o.priceCurrency ?? spec?.priceCurrency ?? null;
    const cents = parsePriceToCents(typeof rawPrice === "number" ? rawPrice : normalizeDotDecimal(rawPrice));
    if (cents && isEuro(currency)) return { node: o, priceCents: cents, currency: "EUR", inStock: stock(o.availability) };
  }
  return null;
}

// schema.org schrijft prijzen met een punt als decimaalteken: "1299.00", "29.9". Dat is geen duizendtal.
function normalizeDotDecimal(raw) {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  return /^\d+\.\d{1,2}$/.test(s) ? Number(s) : s;
}

function isEuro(currency) {
  // Zonder valuta nemen we euro aan: het gaat om Nederlandse winkels. Andere valuta → geen prijs.
  return currency == null || String(currency).toUpperCase() === "EUR";
}

function stock(availability) {
  if (typeof availability !== "string") return null;
  const key = availability.replace(/^.*[/:]/, "").toLowerCase();
  if (IN_STOCK.includes(key)) return true;
  if (OUT_OF_STOCK.includes(key)) return false;
  return null;
}

function gtinOf(node) {
  if (!node) return null;
  for (const key of ["gtin13", "gtin", "gtin14", "gtin12", "gtin8", "ean"]) {
    const g = normalizeGtin(node[key]);
    if (g) return g;
  }
  return null;
}
