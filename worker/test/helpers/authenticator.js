// synced: zoals iCloud/Google-passkeys, die altijd teller 0 geven.
// Een nep-passkey voor tests: maakt echte ES256-registraties en -handtekeningen, zoals een telefoon dat doet.
import { encodeCBOR } from "@levischuck/tiny-cbor";
import { b64url, fromB64url } from "../../src/crypto.js";

const enc = new TextEncoder();
const sha = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

export async function createAuthenticator({ rpId = "prijs.prulwerk.nl", origin = "https://prijs.prulwerk.nl", synced = false } = {}) {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const credId = crypto.getRandomValues(new Uint8Array(16));
  const id = b64url(credId);
  let counter = 0;
  let userHandle = null;

  const clientData = (type, challenge, o = origin) => enc.encode(JSON.stringify({ type, challenge, origin: o, crossOrigin: false }));

  return {
    id,
    async register(options, { origin: o } = {}) {
      userHandle = options.user.id;
      const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
      const cose = encodeCBOR(
        new Map([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, fromB64url(jwk.x)],
          [-3, fromB64url(jwk.y)],
        ]),
      );
      const authData = concat(
        await sha(enc.encode(rpId)),
        new Uint8Array([0x45]), // UP + UV + AT
        new Uint8Array(4),
        new Uint8Array(16),
        new Uint8Array([0, credId.length]),
        credId,
        cose,
      );
      const attestationObject = encodeCBOR(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
      return {
        id,
        rawId: id,
        type: "public-key",
        response: { clientDataJSON: b64url(clientData("webauthn.create", options.challenge, o)), attestationObject: b64url(attestationObject), transports: ["internal"] },
        clientExtensionResults: {},
      };
    },
    async login(options, { origin: o } = {}) {
      const authData = concat(await sha(enc.encode(rpId)), new Uint8Array([0x05]), new Uint8Array([0, 0, 0, synced ? 0 : ++counter]));
      const cdj = clientData("webauthn.get", options.challenge, o);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, concat(authData, await sha(cdj))));
      return {
        id,
        rawId: id,
        type: "public-key",
        response: { clientDataJSON: b64url(cdj), authenticatorData: b64url(authData), signature: b64url(toDer(raw)), userHandle },
        clientExtensionResults: {},
      };
    },
  };
}

// WebCrypto geeft r||s, WebAuthn verwacht DER.
function toDer(raw) {
  const int = (b) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    b = b.slice(i);
    return b[0] & 0x80 ? concat(new Uint8Array([0]), b) : b;
  };
  const r = int(raw.slice(0, 32));
  const s = int(raw.slice(32));
  const seq = concat(new Uint8Array([2, r.length]), r, new Uint8Array([2, s.length]), s);
  return concat(new Uint8Array([0x30, seq.length]), seq);
}
