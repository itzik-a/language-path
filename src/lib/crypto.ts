/* Encryption for the gist and backups (the finance-path scheme, plus gzip: the text is compressed before it's
   encrypted, which shrinks card logs and annotated texts several times).
   Encryption for the gist: AES-GCM (256-bit) with a key from the passphrase (PBKDF2-SHA256).
   The gist holds an Envelope: the salt and round count (so every device derives the same key), a fresh
   random IV per write, and the ciphertext. The passphrase is never stored or sent; each device keeps the
   derived key (localStorage, next to the GitHub token). Wrong passphrase = decrypt fails (GCM's tag check). */

export const ITERATIONS = 600_000;
const AAD = new TextEncoder().encode("language-path:v1");

export interface Envelope {
  app: "language-path";
  v: 1;
  enc: "AES-256-GCM";
  kdf: "PBKDF2-SHA256";
  iter: number;
  /** base64 */
  salt: string;
  iv: string;
  data: string;
  /** the plaintext was gzip-compressed before encrypting */
  z?: "gzip";
}

export const cryptoReady = () => typeof crypto !== "undefined" && !!crypto.subtle;

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

/** The key for a passphrase and salt, plus its raw bytes (base64) to keep on this device. */
export async function deriveKey(passphrase: string, salt: string, iter = ITERATIONS): Promise<{ key: CryptoKey; raw: string }> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: iter },
    base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"],
  );
  return { key, raw: b64(await crypto.subtle.exportKey("raw", key)) };
}

export const importKey = (raw: string) => crypto.subtle.importKey("raw", unb64(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(t as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const canZip = () => typeof CompressionStream !== "undefined";

export async function encrypt(key: CryptoKey, salt: string, iter: number, text: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(text);
  const zip = canZip();
  const body = zip ? await pipe(plain, new CompressionStream("gzip")) : plain;
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, body as BufferSource);
  return { app: "language-path", v: 1, enc: "AES-256-GCM", kdf: "PBKDF2-SHA256", iter, salt, iv: b64(iv), data: b64(data), ...(zip ? { z: "gzip" as const } : {}) };
}

export class WrongKey extends Error { constructor() { super("This passphrase doesn't open the data."); } }

export async function decrypt(key: CryptoKey, env: Envelope): Promise<string> {
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv), additionalData: AAD }, key, unb64(env.data)));
    return new TextDecoder().decode(env.z === "gzip" ? await pipe(plain, new DecompressionStream("gzip")) : plain);
  } catch (e) { if (e instanceof TypeError) throw e; throw new WrongKey(); }
}

/** An Envelope from the gist file's text, or null if it isn't one. */
export function readEnvelope(text: string): Envelope | null {
  try {
    const x = JSON.parse(text) as Partial<Envelope>;
    return x && x.app === "language-path" && typeof x.salt === "string" && typeof x.iv === "string" && typeof x.data === "string" && typeof x.iter === "number" ? (x as Envelope) : null;
  } catch { return null; }
}
