// Public demo sandbox: each visitor gets a random session id in a cookie and an
// isolated list stored under the owner "demo:<session-id>".

export const DEMO_PREFIX = "demo:";
export const DEMO_SEED = ["Milk", "Eggs", "Bread"];
export const MAX_ITEMS_PER_DEMO = 50;

const COOKIE_NAME = "demo_sid";
const TTL_SECONDS = 60 * 60 * 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function demoOwner(sid) {
  return `${DEMO_PREFIX}${sid}`;
}

// Reads the session from the cookie, or creates a new one.
export function getDemoSession(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match && UUID_RE.test(match[1])) return { sid: match[1], isNew: false };
  return { sid: crypto.randomUUID(), isNew: true };
}

export function demoCookie(sid) {
  return `${COOKIE_NAME}=${sid}; Path=/; Max-Age=${TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
