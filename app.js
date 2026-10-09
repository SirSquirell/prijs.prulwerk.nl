// prijswacht: een paar schermen, een hash-router, geen framework.
import { api, ApiError, getToken, setToken } from "./api.js";
import { priceChart } from "./chart.js";
import { h, icon, ICONS } from "./dom.js";
import { blackFriday, deltaText, euro, offerMeta, when } from "./format.js";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "./vendor/simplewebauthn-browser-14.0.0.js";

const app = document.getElementById("app");
const INVITE_KEY = "prijswacht.uitnodiging";
let me = null;

// ---------- omgeving ----------

const ua = navigator.userAgent;
const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// Browsers in apps (whatsapp, instagram, ...) kunnen meestal geen passkey maken.
const inAppBrowser =
  /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|; wv\)/.test(ua) ||
  (isIos && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) && !isStandalone);

// ---------- router ----------

function readInviteFromHash() {
  const m = location.hash.match(/^#uitnodiging=([A-Za-z0-9_-]{20,100})$/);
  if (!m) return;
  try {
    sessionStorage.setItem(INVITE_KEY, m[1]);
  } catch {
    // zonder sessionStorage onthouden we hem alleen in deze variabele
  }
  pendingInvite = m[1];
  // Token direct uit de adresbalk halen: niet in geschiedenis, niet per ongeluk gedeeld.
  history.replaceState(null, "", location.pathname + "#/uitnodiging");
}
let pendingInvite = null;
function currentInvite() {
  if (pendingInvite) return pendingInvite;
  try {
    return sessionStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}
function clearInvite() {
  pendingInvite = null;
  try {
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    /* niets */
  }
}

// Elke render krijgt een nummer. Komt een oud antwoord te laat binnen (traag 4g, snel terugtikken), dan
// tekent hij niet over het scherm dat er inmiddels staat.
let renderId = 0;

async function render() {
  const id = ++renderId;
  const show = (node) => {
    if (id === renderId) paint(node);
  };
  readInviteFromHash();
  const route = location.hash.replace(/^#/, "") || "/";

  if (route === "/uitnodiging" && currentInvite()) return show(await inviteScreen(currentInvite()));
  if (route === "/klaar") return show(doneScreen());

  if (!getToken()) return show(loginScreen());
  if (!me) {
    try {
      me = await api("/api/ik");
    } catch (err) {
      if (err.status === 401) return show(loginScreen());
      return show(errorScreen(err));
    }
  }

  try {
    const item = route.match(/^\/item\/(\d+)$/);
    if (item) return show(await itemScreen(Number(item[1])));
    if (route === "/account") return show(await accountScreen());
    return show(await listScreen());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      me = null;
      return show(loginScreen());
    }
    return show(errorScreen(err));
  }
}

function paint(node) {
  app.replaceChildren(node);
  window.scrollTo(0, 0);
  const heading = app.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

addEventListener("hashchange", render);
render();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// ---------- onderdelen ----------

function brand() {
  return h(
    "div",
    { class: "brand" },
    h("img", { src: "/favicon.svg", alt: "", width: 36, height: 36 }),
    h("span", { class: "name" }, "prijswacht"),
    h("a", { class: "wordmark", href: "https://prulwerk.nl/" }, "prulwerk", h("span", {}, ".nl")),
  );
}

function tabs(active) {
  const tab = (href, label, paths, key) =>
    h("a", { href, "aria-current": active === key ? "page" : null }, icon(paths), label);
  return h("nav", { class: "tabs", "aria-label": "hoofdmenu" }, tab("#/", "lijst", ICONS.list, "lijst"), tab("#/account", "account", ICONS.user, "account"));
}

function busy(button, text) {
  const old = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(text);
  return () => {
    button.disabled = false;
    button.replaceChildren(...old);
  };
}

function errorLine() {
  return h("p", { class: "error", role: "alert" });
}

function errorScreen(err) {
  return h(
    "section",
    { class: "screen" },
    brand(),
    h("h1", { class: "title" }, "dat ging mis."),
    h("p", { class: "muted" }, err.message ?? "er ging iets mis"),
    h("button", { class: "btn quiet", type: "button", onclick: render }, "nog een keer"),
  );
}

function inAppWarning() {
  const copy = h("button", { class: "btn", type: "button" }, "link kopiëren");
  copy.addEventListener("click", async () => {
    // De link opnieuw opbouwen; het token staat niet meer in de adresbalk.
    const invite = currentInvite();
    const link = invite ? `${location.origin}/#uitnodiging=${invite}` : location.origin;
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = "gekopieerd";
    } catch {
      copy.replaceWith(h("p", { class: "copy" }, link));
    }
  });
  return h(
    "div",
    { class: "card" },
    h("span", { class: "label" }, "andere browser nodig"),
    h("h2", { class: "title" }, isIos ? "open deze link in safari." : "open deze link in chrome."),
    h("p", { class: "muted" }, `in deze app werkt inloggen niet. tik op ··· of het deelicoon en kies 'open in ${isIos ? "safari" : "browser"}', of kopieer de link.`),
    copy,
  );
}

// ---------- inloggen ----------

function loginScreen() {
  const err = errorLine();
  const btn = h("button", { class: "btn", type: "button" }, icon(ICONS.key, 20), "inloggen met passkey");
  btn.addEventListener("click", async () => {
    err.textContent = "";
    const done = busy(btn, "even wachten…");
    try {
      const { options, challengeToken } = await api("/api/inloggen/opties", { body: {} });
      const response = await startAuthentication({ optionsJSON: options });
      const res = await api("/api/inloggen", { body: { challengeToken, response } });
      setToken(res.token);
      me = res.user;
      location.hash = "#/";
      render();
    } catch (e) {
      done();
      err.textContent =
        e?.name === "NotAllowedError" ? "inloggen afgebroken." : e instanceof ApiError ? e.message : "inloggen is niet gelukt. probeer het nog een keer, of vraag mathijs om een nieuwe link.";
    }
  });

  return h(
    "section",
    { class: "screen" },
    brand(),
    h(
      "div",
      { class: "stack", style: { marginTop: "40px", gap: "14px" } },
      h("h1", { class: "hero" }, "zeg wat je wilt hebben. wij letten op de prijs."),
      h("p", { class: "muted" }, "we volgen het bij nederlandse winkels en melden het als het zakt. rond black friday zeggen we ook of de korting echt is."),
    ),
    inAppBrowser || !browserSupportsWebAuthn() ? inAppWarning() : h("div", { class: "stack" }, btn, err),
    h("p", { class: "label push-down small" }, "geen wachtwoord. op je beginscherm blijf je 30 dagen ingelogd. alleen op uitnodiging."),
  );
}

// ---------- uitnodiging ----------

async function inviteScreen(invite) {
  let info;
  try {
    info = await api("/api/uitnodiging", { body: { invite } });
  } catch (e) {
    clearInvite();
    return h(
      "section",
      { class: "screen" },
      brand(),
      h("h1", { class: "title" }, "deze link werkt niet meer."),
      h("p", { class: "muted" }, e.status === 410 ? "hij is al gebruikt of verlopen. vraag mathijs om een nieuwe." : e.message),
      h("a", { class: "btn quiet", href: "#/" }, "naar inloggen"),
    );
  }

  const err = errorLine();
  const nameInput = h("input", { id: "naam", type: "text", autocomplete: "given-name", maxlength: 40, value: info.name ?? "", required: true });
  const btn = h("button", { class: "btn", type: "button" }, icon(ICONS.key, 20), "maak passkey");
  btn.addEventListener("click", async () => {
    err.textContent = "";
    const name = nameInput.value.trim();
    if (!info.existing && !name) {
      err.textContent = "vul je naam in.";
      nameInput.focus();
      return;
    }
    const done = busy(btn, "even wachten…");
    try {
      const { options, challengeToken } = await api("/api/registreren/opties", { body: { invite, name } });
      const response = await startRegistration({ optionsJSON: options });
      const res = await api("/api/registreren", { body: { invite, challengeToken, response } });
      clearInvite();
      setToken(res.token);
      me = res.user;
      location.hash = "#/klaar";
    } catch (e) {
      done();
      err.textContent =
        e?.name === "NotAllowedError"
          ? "afgebroken. tik nog een keer op de knop."
          : e?.name === "InvalidStateError"
            ? "dit apparaat heeft al een passkey voor dit account. log gewoon in."
            : e instanceof ApiError
              ? e.message
              : "dat lukte niet. probeer het nog een keer, of vraag mathijs om een nieuwe link.";
    }
  });

  const greeting = info.existing ? `nieuwe passkey voor ${info.name}.` : info.name ? `hoi ${info.name.toLowerCase()}.` : "je bent uitgenodigd.";
  return h(
    "section",
    { class: "screen" },
    brand(),
    h(
      "div",
      { class: "stack", style: { marginTop: "40px", gap: "14px" } },
      h("h1", { class: "hero" }, greeting),
      h("p", { class: "muted" }, "je bent uitgenodigd voor prijswacht. maak een passkey, dan log je voortaan in met face id of je vingerafdruk."),
    ),
    inAppBrowser || !browserSupportsWebAuthn()
      ? inAppWarning()
      : h(
          "div",
          { class: "stack" },
          info.existing ? null : h("div", { class: "field" }, h("label", { for: "naam" }, "je naam"), nameInput),
          btn,
          err,
        ),
    h("p", { class: "label push-down small" }, "geen wachtwoord, geen e-mail. de passkey staat in je wachtwoordbeheer."),
  );
}

function doneScreen() {
  const homescreen = isStandalone
    ? null
    : h(
        "div",
        { class: "card" },
        h("span", { class: "label" }, "zet hem op je beginscherm"),
        isIos
          ? h(
              "ol",
              { class: "steps" },
              h("li", {}, "tik onderin op het deelicoon (vierkantje met pijl)."),
              h("li", {}, "kies 'zet op beginscherm'."),
              h("li", {}, "open prijswacht vanaf je beginscherm en tik op inloggen met passkey."),
            )
          : h(
              "ol",
              { class: "steps" },
              h("li", {}, "open het menu van je browser (⋮)."),
              h("li", {}, "kies 'app installeren' of 'toevoegen aan startscherm'."),
            ),
      );
  return h(
    "section",
    { class: "screen" },
    brand(),
    h("h1", { class: "hero", style: { marginTop: "40px" } }, "klaar."),
    h("p", { class: "muted" }, "je passkey staat erin. hiermee log je voortaan in."),
    homescreen,
    h("a", { class: "btn", href: "#/" }, "naar je lijst"),
  );
}

// ---------- je lijst ----------

async function listScreen() {
  const data = await api("/api/items");
  const bf = blackFriday();

  const items = data.items.map((it) => {
    const d = deltaText(it.delta);
    const sub =
      it.price == null
        ? `${it.shops} ${it.shops === 1 ? "winkel" : "winkels"} · nog geen prijs`
        : `laagst bij ${it.shop} · ${it.shops} ${it.shops === 1 ? "winkel" : "winkels"}`;
    return h(
      "a",
      { class: "item", href: `#/item/${it.id}` },
      h("div", { class: "between" }, h("span", { class: "name" }, it.name), h("span", { class: `price${it.price == null ? " unknown" : ""}` }, euro(it.price))),
      h("div", { class: "between small" }, h("span", { class: "muted" }, sub), d ? h("span", { class: `mono ${d.cls}` }, d.text) : null),
    );
  });

  return h(
    "div",
    { class: "screen-wrap", style: { display: "contents" } },
    h(
      "section",
      { class: "screen" },
      h("div", { class: "between", style: { alignItems: "center" } }, h("h1", { class: "title" }, "je lijst"), h("a", { class: "avatar", href: "#/account", "aria-label": "account" }, (me?.name ?? "?").slice(0, 1).toUpperCase())),
      bf.left >= 0
        ? h(
            "div",
            { class: "card" },
            h("div", { class: "between label" }, h("span", {}, "black friday · 27 nov"), h("span", { class: "down" }, bf.left === 0 ? "vandaag" : `nog ${bf.left} ${bf.left === 1 ? "dag" : "dagen"}`)),
            h("div", { class: "bar" }, h("div", { style: { width: `${Math.round(bf.progress * 100)}%` } })),
            h("p", { class: "muted small" }, "we verzamelen nu prijzen. hoe langer de geschiedenis, hoe beter we straks een nep-korting herkennen."),
          )
        : null,
      h(
        "div",
        { class: "between label" },
        h("span", {}, `${data.items.length} ${data.items.length === 1 ? "item" : "items"} · ${data.shops} ${data.shops === 1 ? "winkel" : "winkels"}`),
        data.last_check ? h("span", {}, `laatste check ${when(data.last_check)}`) : null,
      ),
      items.length
        ? h("div", { class: "stack" }, items)
        : h("p", { class: "muted" }, me?.isAdmin ? "je volgt nog niets." : "je volgt nog niets. toevoegen komt binnenkort; vraag het zolang aan mathijs."),
    ),
    tabs("lijst"),
  );
}

// ---------- item ----------

async function itemScreen(id) {
  const it = await api(`/api/items/${id}`);
  const shops = it.offers.length;

  const chartCard =
    it.series.length >= 2
      ? h(
          "div",
          { class: "card" },
          h("div", { class: "between label" }, h("span", {}, "laagste prijs per dag"), h("span", {}, `${it.stats.days} ${it.stats.days === 1 ? "dag" : "dagen"}`)),
          priceChart(it.series),
          h(
            "div",
            { class: "stats" },
            h("div", {}, h("span", { class: "label" }, "90d laag"), h("span", {}, euro(it.stats.low))),
            h("div", {}, h("span", { class: "label" }, "mediaan"), h("span", {}, euro(it.stats.median))),
            h("div", {}, h("span", { class: "label" }, "90d hoog"), h("span", {}, euro(it.stats.high))),
          ),
        )
      : h(
          "div",
          { class: "card" },
          h("span", { class: "label" }, "prijsverloop"),
          h("p", { class: "muted" }, "nog te weinig geschiedenis voor een grafiek. vanaf morgen staat hier de lijn."),
        );

  return h(
    "div",
    { style: { display: "contents" } },
    h(
      "section",
      { class: "screen" },
      h("a", { class: "back", href: "#/" }, "← je lijst"),
      h(
        "div",
        { class: "stack", style: { gap: "6px" } },
        h("span", { class: "label" }, `${shops} ${shops === 1 ? "winkel" : "winkels"}${it.ean ? ` · ean ${it.ean}` : ""}`),
        h("h1", { class: "title" }, it.name),
        h(
          "div",
          { class: "row", style: { alignItems: "baseline", marginTop: "6px", flexWrap: "wrap" } },
          h("span", { class: `price big${it.price == null ? " unknown" : ""}` }, euro(it.price)),
          h("span", { class: "muted small" }, it.price == null ? "geen winkel gaf nu een prijs" : `laagst nu, bij ${it.shop}`),
        ),
      ),
      chartCard,
      h(
        "div",
        { class: "stack", style: { gap: "8px" } },
        h("span", { class: "label" }, "per winkel"),
        it.offers.map((o) =>
          h(
            "div",
            { class: "offer" },
            h("span", { class: "what" }, h("span", { class: "shop" }, o.shop), h("span", { class: "meta" }, offerMeta(o))),
            h("span", { class: `price${o.price == null ? " unknown" : ""}` }, o.price == null ? "?" : euro(o.price)),
            h("a", { class: "icon-link", href: o.url, target: "_blank", rel: "noopener noreferrer", "aria-label": `open ${o.shop}` }, icon(ICONS.out, 18)),
          ),
        ),
      ),
      h("p", { class: "label small" }, "een prijs die we niet konden ophalen blijft leeg. we raden niet."),
    ),
    tabs("lijst"),
  );
}

// ---------- account ----------

async function accountScreen() {
  const logout = h("button", { class: "linkbtn warn", type: "button" }, "uitloggen op dit apparaat");
  logout.addEventListener("click", async () => {
    try {
      await api("/api/uitloggen", { body: {} });
    } catch {
      /* token is lokaal toch weg */
    }
    setToken(null);
    me = null;
    location.hash = "#/";
    render();
  });

  return h(
    "div",
    { style: { display: "contents" } },
    h(
      "section",
      { class: "screen" },
      h("h1", { class: "title" }, "account"),
      h("div", { class: "card" }, h("span", { class: "label" }, "ingelogd als"), h("span", { style: { fontWeight: 600 } }, me.name), me.isAdmin ? h("span", { class: "label" }, "beheerder") : null),
      me.isAdmin ? await adminPanel() : null,
      h("p", { class: "muted small" }, "meldingen komen in een volgende versie."),
      logout,
    ),
    tabs("account"),
  );
}

async function adminPanel() {
  const [{ invites }, { users }] = await Promise.all([api("/api/beheer/uitnodigingen"), api("/api/beheer/gebruikers")]);
  const err = errorLine();
  const result = h("div", { class: "stack" });
  const nameInput = h("input", { id: "uitnodigen", type: "text", maxlength: 40, autocomplete: "off", placeholder: "sanne" });
  const make = h("button", { class: "btn", type: "button" }, "maak uitnodiging");
  make.addEventListener("click", async () => {
    err.textContent = "";
    const done = busy(make, "even wachten…");
    try {
      const { link, expires_at } = await api("/api/beheer/uitnodigingen", { body: { name: nameInput.value.trim() || null } });
      result.replaceChildren(...inviteResult(link, expires_at));
    } catch (e) {
      err.textContent = e.message;
    }
    done();
  });

  const userRows = users.map((u) => {
    const row = h(
      "div",
      { class: "offer" },
      h("span", { class: "what" }, h("span", { class: "shop" }, u.name), h("span", { class: "meta" }, `${u.passkeys} ${u.passkeys === 1 ? "passkey" : "passkeys"}${u.last_seen_at ? ` · gezien ${when(u.last_seen_at)}` : ""}`)),
    );
    if (u.id !== me.id) {
      const again = h("button", { class: "linkbtn", type: "button" }, "nieuwe link");
      again.addEventListener("click", async () => {
        err.textContent = "";
        try {
          const { link, expires_at } = await api("/api/beheer/uitnodigingen", { body: { userId: u.id } });
          result.replaceChildren(...inviteResult(link, expires_at, u.name));
          result.scrollIntoView({ block: "nearest" });
        } catch (e) {
          err.textContent = e.message;
        }
      });
      const revoke = h("button", { class: "linkbtn warn", type: "button" }, "intrekken");
      revoke.addEventListener("click", async () => {
        if (!confirm(`${u.name} uitloggen op alle apparaten en passkeys verwijderen?`)) return;
        try {
          await api(`/api/beheer/gebruikers/${u.id}/intrekken`, { body: {} });
          render();
        } catch (e) {
          err.textContent = `intrekken niet gelukt: ${e.message}`;
          err.scrollIntoView({ block: "nearest" });
        }
      });
      row.append(h("span", { class: "stack", style: { gap: 0 } }, again, revoke));
    }
    return row;
  });

  return h(
    "div",
    { class: "stack", style: { gap: "20px" } },
    h(
      "div",
      { class: "card" },
      h("span", { class: "label" }, "iemand uitnodigen"),
      h("div", { class: "field" }, h("label", { for: "uitnodigen" }, "naam (mag leeg)"), nameInput),
      make,
      err,
      result,
    ),
    h("div", { class: "stack", style: { gap: "8px" } }, h("span", { class: "label" }, "mensen"), userRows),
    invites.length
      ? h(
          "div",
          { class: "stack", style: { gap: "8px" } },
          h("span", { class: "label" }, "uitnodigingen"),
          invites.slice(0, 10).map((i) => h("div", { class: "between small" }, h("span", {}, i.name || "zonder naam"), h("span", { class: `mono ${i.status === "open" ? "down" : "flat"}` }, i.status))),
        )
      : null,
  );
}

function inviteResult(link, expiresAt, forName) {
  const out = [h("p", { class: "muted small" }, `${forName ? `nieuwe passkey voor ${forName}. ` : ""}werkt één keer, tot ${when(expiresAt)}. stuur hem zelf door.`), h("p", { class: "copy" }, link)];
  if (navigator.share) {
    out.push(h("button", { class: "btn quiet", type: "button", onclick: () => navigator.share({ text: "je uitnodiging voor prijswacht. open hem in safari of chrome:", url: link }).catch(() => {}) }, icon(ICONS.share, 20), "delen"));
  } else {
    const b = h("button", { class: "btn quiet", type: "button" }, "kopiëren");
    b.addEventListener("click", async () => {
      await navigator.clipboard.writeText(link).catch(() => {});
      b.textContent = "gekopieerd";
    });
    out.push(b);
  }
  return out;
}
