// All D1 access lives here. Every query that touches a user's data is scoped by
// `owner`, which the Worker derives server-side and never takes from the client.

const COLUMNS = "id, text, quantity, done";

function toItem(row) {
  return { id: row.id, text: row.text, quantity: row.quantity, done: Boolean(row.done) };
}

export async function list(db, owner) {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM items WHERE owner = ? ORDER BY id`)
    .bind(owner)
    .all();
  return results.map(toItem);
}

export function count(db, owner) {
  return db.prepare("SELECT COUNT(*) AS n FROM items WHERE owner = ?").bind(owner).first("n");
}

export async function create(db, owner, { text, quantity }) {
  const row = await db
    .prepare(`INSERT INTO items (owner, text, quantity) VALUES (?, ?, ?) RETURNING ${COLUMNS}`)
    .bind(owner, text, quantity)
    .first();
  return toItem(row);
}

// Returns the updated item, or null if it doesn't exist for this owner.
export async function setDone(db, owner, id, done) {
  const row = await db
    .prepare(`UPDATE items SET done = ? WHERE id = ? AND owner = ? RETURNING ${COLUMNS}`)
    .bind(done ? 1 : 0, id, owner)
    .first();
  return row ? toItem(row) : null;
}

// Returns true if an item was deleted.
export async function remove(db, owner, id) {
  const result = await db
    .prepare("DELETE FROM items WHERE id = ? AND owner = ?")
    .bind(id, owner)
    .run();
  return result.meta.changes > 0;
}

export function seed(db, owner, names) {
  return db.batch(
    names.map((text) =>
      db.prepare("INSERT INTO items (owner, text) VALUES (?, ?)").bind(owner, text)
    )
  );
}

// Deletes demo rows older than a day (called from the cron trigger).
export function purgeExpired(db, ownerPrefix) {
  return db
    .prepare("DELETE FROM items WHERE owner LIKE ? AND created_at < datetime('now', '-1 day')")
    .bind(`${ownerPrefix}%`)
    .run();
}
