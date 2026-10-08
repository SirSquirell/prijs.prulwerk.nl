// Prijzen en EAN's uit tekst halen. Liever null dan een gok.

// "1.299,00", "€ 298,89", "359,-", "1,299.00", 359 → centen. Ongeldig of <= 0 → null.
export function parsePriceToCents(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  }
  if (typeof value !== "string") return null;

  let s = value.replace(/[\s  ]/g, "").replace(/^(€|EUR)/i, "").replace(/(€|EUR)$/i, "");
  s = s.replace(/[,.]-+$/, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart;
  let fracPart = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot);
    intPart = s.slice(0, dec);
    fracPart = s.slice(dec + 1);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    // Precies drie cijfers na het laatste scheidingsteken is een duizendtal: "1.299".
    if (tail.length === 3 && parts.length >= 2) {
      intPart = parts.join("");
    } else if (parts.length === 2 && tail.length <= 2) {
      intPart = parts[0];
      fracPart = tail;
    } else {
      return null;
    }
  } else {
    intPart = s;
  }

  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null;
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0") || 0);
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

// GTIN-8/12/13/14 met geldig controlecijfer → als 13 cijfers (EAN-13) waar dat kan, anders zoals het is.
export function normalizeGtin(value) {
  if (value == null) return null;
  let s = String(value).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(s.length)) return null;
  if (!validGtinCheckDigit(s)) return null;
  if (s.length === 12) s = "0" + s;
  if (s.length === 14 && s.startsWith("0")) s = s.slice(1);
  return s;
}

function validGtinCheckDigit(s) {
  const digits = s.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}
