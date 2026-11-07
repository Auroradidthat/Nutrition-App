// Small HTTP helpers shared by the Worker modules.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Request bodies are tiny ({ text, quantity }), so anything bigger is refused
// before it is parsed. Returns null for oversized or invalid JSON.
const MAX_BODY_CHARS = 1024;

export async function readJson(request) {
  const declared = Number(request.headers.get("Content-Length"));
  if (declared > MAX_BODY_CHARS) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Mutating requests must come from our own origin (CSRF defence).
export function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}
