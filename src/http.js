// Small HTTP helpers shared by the Worker modules.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Mutating requests must come from our own origin (CSRF defence).
export function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}
