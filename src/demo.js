// Public demo sandbox: each visitor gets a random session id in a cookie and an
// isolated list stored under the owner "demo:<session-id>".

export const DEMO_PREFIX = "demo:";
export const DEMO_SEED = ["Milk", "Eggs", "Bread"];
export const MAX_ITEMS_PER_DEMO = 15;
// New visitors are turned away once this many sessions exist, which bounds D1 writes and storage.
export const MAX_DEMO_SESSIONS = 200;

const COOKIE_NAME = "demo_sid";
const TTL_SECONDS = 60 * 60 * 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function demoOwner(sid) {
  return `${DEMO_PREFIX}${sid}`;
}

const COOKIE_RE = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([0-9a-f-]{36})\\.([0-9a-f]{64})(?:;|$)`);
const encoder = new TextEncoder();

function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/../g), (byte) => parseInt(byte, 16));
}

function hmacKey(secret, usages) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function sign(sid, secret) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), encoder.encode(sid));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Reads the session from the cookie, or creates a new one. The cookie is signed
// ("<sid>.<hmac>"), so a client can't invent a session id the Worker never issued.
export async function getDemoSession(request, secret) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(COOKIE_RE);
  if (match && UUID_RE.test(match[1])) {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      hexToBytes(match[2]),
      encoder.encode(match[1])
    );
    if (valid) return { sid: match[1], isNew: false };
  }
  return { sid: crypto.randomUUID(), isNew: true };
}

// Rate-limit key. The client IP is used instead of the cookie, because anyone can
// forge a new session id for every request but can't cheaply change their IP.
export function rateLimitKey(request) {
  return `ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`;
}

export async function demoCookie(sid, secret) {
  return `${COOKIE_NAME}=${sid}.${await sign(sid, secret)}; Path=/; Max-Age=${TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
