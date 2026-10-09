// DOM bouwen zonder innerHTML. Alle tekst gaat via textContent: productnamen komen van winkelpagina's.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}

const SVG = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(paths, size = 22) {
  return s(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
    paths.map((d) => s("path", { d })),
  );
}

export const ICONS = {
  list: ["M4 6h16M4 12h16M4 18h10"],
  plus: ["M12 5v14M5 12h14"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"],
  key: ["M8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M2 21c0-3.3 2.7-6 6-6s6 2.7 6 6", "M15 11h7M19 11v4M22 11v2"],
  out: ["M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"],
  share: ["M12 3v12M7 8l5-5 5 5", "M5 13v7h14v-7"],
};
