// Nutrition App API.
//   /api/items -> identity comes from Cloudflare Access

import { validateItem } from "../public/rules.js";
import { getUser } from "./auth.js";
import { json, readJson, sameOrigin } from "./http.js";
import * as store from "./store.js";

const MAX_ITEMS_PER_USER = 500;

// ---------- Handlers ----------
// Each receives { request, db, owner, itemId, limit } and returns a Response.

async function listItems({ db, owner }) {
  return json(await store.list(db, owner));
}

// POST /items  { text, quantity? }
async function createItem({ request, db, owner, limit }) {
  const body = await readJson(request);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const quantity = body?.quantity === undefined ? 1 : body.quantity;

  const error = validateItem(text, quantity);
  if (error) return json({ error }, 400);

  if ((await store.count(db, owner)) >= limit) return json({ error: "List is full" }, 409);

  return json(await store.create(db, owner, { text, quantity }), 201);
}

// PATCH /items/:id  { done }
async function updateItem({ request, db, owner, itemId }) {
  const body = await readJson(request);
  if (typeof body?.done !== "boolean") return json({ error: "done must be a boolean" }, 400);

  const item = await store.setDone(db, owner, itemId, body.done);
  return item ? json(item) : json({ error: "Not found" }, 404);
}

// DELETE /items/:id
async function deleteItem({ db, owner, itemId }) {
  return (await store.remove(db, owner, itemId))
    ? json({ ok: true })
    : json({ error: "Not found" }, 404);
}

// "<METHOD> <collection|item>" -> handler
const HANDLERS = {
  "GET collection": listItems,
  "POST collection": createItem,
  "PATCH item": updateItem,
  "DELETE item": deleteItem,
};

// ---------- Worker ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname.match(/^\/api\/items(?:\/(\d+))?$/);
    if (!route) return json({ error: "Not found" }, 404);

    const itemId = route[1] ? Number(route[1]) : null;

    const handler = HANDLERS[`${request.method} ${itemId === null ? "collection" : "item"}`];
    if (!handler) return json({ error: "Method not allowed" }, 405);

    if (request.method !== "GET" && !sameOrigin(request, url)) {
      return json({ error: "Forbidden" }, 403);
    }

    try {
      // The owner is ALWAYS derived server-side, never taken from the client.
      const owner = await getUser(request, env, url);
      if (!owner) return json({ error: "Unauthorized" }, 401);

      return await handler({
        request,
        db: env.DB,
        owner,
        itemId,
        limit: MAX_ITEMS_PER_USER,
      });
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  },
};
