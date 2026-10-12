// Grocery list API.
//   /api/items       -> real users, identity comes from Cloudflare Access
//   /api/demo/items  -> public sandbox, identity comes from a random cookie
// Both share the same handlers; only the `owner` value differs.

const MAX_TEXT_LENGTH = 100;
const MAX_ITEMS_PER_DEMO = 50;
const MAX_ITEMS_PER_USER = 500;
const DEMO_COOKIE = "demo_sid";
const DEMO_TTL_SECONDS = 60 * 60 * 24;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEMO_SEED = ["Milk", "Eggs", "Bread"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname.match(/^\/api\/(demo\/)?items(?:\/(\d+))?$/);
    if (!route) return json({ error: "Not found" }, 404);

    const isDemo = Boolean(route[1]);
    const itemId = route[2] ? Number(route[2]) : null;

    // Mutating requests must come from our own origin (CSRF defence).
    if (request.method !== "GET" && !sameOrigin(request, url)) {
      return json({ error: "Forbidden" }, 403);
    }

    // The owner is ALWAYS derived server-side, never taken from the client.
    let owner;
    let setCookie = null;
    let seed = false;

    if (isDemo) {
      const session = getDemoSession(request);
      owner = `demo:${session.sid}`;
      seed = session.isNew;
      if (session.isNew) setCookie = demoCookie(session.sid);
    } else {
      const email = await getAccessUser(request, env);
      if (!email) return json({ error: "Unauthorized" }, 401);
      owner = email;
    }

    const ctx = {
      db: env.DB,
      owner,
      itemId,
      limit: isDemo ? MAX_ITEMS_PER_DEMO : MAX_ITEMS_PER_USER,
      seed,
    };

    let response;
    try {
      response = await handle(request, ctx);
    } catch (err) {
      console.error(err);
      response = json({ error: "Server error" }, 500);
    }

    if (setCookie) response.headers.append("Set-Cookie", setCookie);
    return response;
  },

  // Cron trigger: remove demo data older than the session lifetime.
  async scheduled(_event, env) {
    await env.DB.prepare(
      "DELETE FROM items WHERE owner LIKE 'demo:%' AND created_at < datetime('now', '-1 day')"
    ).run();
  },
};

// ---------- Shared handlers ----------

async function handle(request, { db, owner, itemId, limit, seed }) {
  const method = request.method;

  // GET /items
  if (method === "GET" && itemId === null) {
    if (seed) {
      await db.batch(
        DEMO_SEED.map((t) =>
          db.prepare("INSERT INTO items (owner, text) VALUES (?, ?)").bind(owner, t)
        )
      );
    }
    const { results } = await db
      .prepare("SELECT id, text, done FROM items WHERE owner = ? ORDER BY id")
      .bind(owner)
      .all();
    return json(results.map(toItem));
  }

  // POST /items  { text }
  if (method === "POST" && itemId === null) {
    const body = await readJson(request);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return json({ error: "Text is required" }, 400);
    if (text.length > MAX_TEXT_LENGTH) {
      return json({ error: `Text must be ${MAX_TEXT_LENGTH} characters or fewer` }, 400);
    }

    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM items WHERE owner = ?")
      .bind(owner)
      .first("n");
    if (count >= limit) return json({ error: "List is full" }, 409);

    const row = await db
      .prepare("INSERT INTO items (owner, text) VALUES (?, ?) RETURNING id, text, done")
      .bind(owner, text)
      .first();
    return json(toItem(row), 201);
  }

  // PATCH /items/:id  { done }
  if (method === "PATCH" && itemId !== null) {
    const body = await readJson(request);
    if (typeof body?.done !== "boolean") return json({ error: "done must be a boolean" }, 400);

    const row = await db
      .prepare("UPDATE items SET done = ? WHERE id = ? AND owner = ? RETURNING id, text, done")
      .bind(body.done ? 1 : 0, itemId, owner)
      .first();
    return row ? json(toItem(row)) : json({ error: "Not found" }, 404);
  }

  // DELETE /items/:id
  if (method === "DELETE" && itemId !== null) {
    const result = await db
      .prepare("DELETE FROM items WHERE id = ? AND owner = ?")
      .bind(itemId, owner)
      .run();
    return result.meta.changes > 0 ? json({ ok: true }) : json({ error: "Not found" }, 404);
  }

  return json({ error: "Method not allowed" }, 405);
}

// ---------- Auth: Cloudflare Access ----------

// Verifies the signed JWT Access attaches to every request and returns the
// user's email, or null. In `wrangler dev` (no Access) DEV_USER is used.
async function getAccessUser(request, env) {
  if (env.DEV_USER) return env.DEV_USER;

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;

  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;

    const header = JSON.parse(b64urlToString(h));
    const payload = JSON.parse(b64urlToString(p));
    if (header.alg !== "RS256") return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    if (payload.iss !== env.TEAM_DOMAIN) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.POLICY_AUD)) return null;

    const certs = await fetch(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    }).then((r) => r.json());
    const jwk = certs.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    return valid && payload.email ? payload.email : null;
  } catch {
    return null;
  }
}

// ---------- Demo sessions ----------

function getDemoSession(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=([^;]+)`));
  if (match && UUID_RE.test(match[1])) return { sid: match[1], isNew: false };
  return { sid: crypto.randomUUID(), isNew: true };
}

function demoCookie(sid) {
  return `${DEMO_COOKIE}=${sid}; Path=/; Max-Age=${DEMO_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

// ---------- Helpers ----------

function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function toItem(row) {
  return { id: row.id, text: row.text, done: Boolean(row.done) };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlToString(str) {
  return new TextDecoder().decode(b64urlToBytes(str));
}
