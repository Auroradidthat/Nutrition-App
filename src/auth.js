// Identifies the signed-in user from Cloudflare Access.

// Hostnames where the DEV_USER shortcut is honoured. Anywhere else (a real
// deployed domain) the shortcut is ignored even if DEV_USER is set by mistake,
// so a misconfigured production variable can never bypass authentication.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

// Returns the user's email, or null when the request is not authenticated.
export async function getUser(request, env, url) {
  if (env.DEV_USER && LOCAL_HOSTNAMES.has(url.hostname)) return env.DEV_USER;

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  return verifyAccessJwt(token, env);
}

// Verifies the signed JWT that Access attaches to every request:
// signature (RS256 against the team's public keys), expiry, issuer, audience.
async function verifyAccessJwt(token, env) {
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

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlToString(str) {
  return new TextDecoder().decode(b64urlToBytes(str));
}
