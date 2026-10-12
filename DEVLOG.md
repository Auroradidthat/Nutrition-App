# Dev Log

A running record of what changed, why, and what's next. Newest entries go at the top of **Upcoming** and the bottom of **History**.

**How to use this file**
- After each work session, add an entry under **History** with the date and a short list of changes.
- Record *why* for any non-obvious decision, so it doesn't get re-litigated later.
- Move finished items out of **Upcoming** and into a History entry.

## Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/). The version lives in `package.json` and each release is an annotated git tag (`vX.Y.Z`).

While the major version is `0`, the app is in initial development and anything may change:

- **`0.Y.0`**: new feature or user-visible change
- **`0.y.Z`**: bug fix, rename, docs or internal change with no new capability
- **`1.0.0`**: first stable release (deployed, API considered stable)
- After `1.0.0`: **MAJOR** for breaking API/data changes, **MINOR** for backwards-compatible features, **PATCH** for fixes

Release steps: update `DEVLOG.md`, run `npm version <patch|minor> --no-git-tag-version`, commit, `git tag -a vX.Y.Z -m "..."`, then `git push --follow-tags`.

---

## Upcoming

- [ ] Connect `public/script.js` to the API (load, add, remove through `fetch`)
- [ ] Demo mode in the front end: detect `/demo`, switch API base, show banner
- [ ] Quantity `−` / `+` buttons (replaces the tiny native spinner)
- [ ] Check-off (done) toggle in the UI
- [ ] Deploy Worker + D1, configure Cloudflare Access and the `/demo` bypass
- [ ] Rate limiting rule on `/api/demo/*`
- [ ] Decide: one private list per user, or shared household lists
- [ ] Reword placeholder text and labels from "grocery" to nutrition theme

## Known issues

- Front end and Worker are not connected; refreshing the page loses the list.
- Desktop layout: `#add-form input { flex: 1 }` also stretches the quantity input.
- `npm` reports v9.6.1 under Node 24, suggesting a stale global npm on PATH. Not blocking.

## Decisions

| Decision | Reason |
|---|---|
| Cloudflare Workers + D1 for the back end | Needs cross-device storage; no separate server to host; generous free tier |
| Cloudflare Access for login | No password handling or auth code to maintain |
| Public `/demo` with per-visitor cookie sandbox | Interviewers can try the app with no account, without touching real data |
| Allowlist (not blocklist) for item names | Safer and simpler than enumerating bad characters |
| Apostrophe allowed in names | Real items need it ("Reese's"); safe because queries use bound parameters |
| `"` not allowed in names | Closes off attribute/injection edge cases; users can write "inch" |
| Same allowlist enforced in browser and Worker | Browser check is only for UX; the Worker is the real enforcement |
| Quantity capped at 1–99, integers only | Simple, realistic range; rejects `0`, negatives, decimals, strings |
| Relative asset paths in `index.html` | Absolute `/script.js` broke when opened via `file://` or Live Server |

---

## History

### v0.1.0 — 2026-10-11 — Project start, front end, backend scaffold

**Planning**
- Started from a plain HTML/JS grocery list idea (type items, display them).
- Chose Cloudflare Workers + D1 + Access after deciding the app must work across devices and be mobile-first.
- Added a public demo mode requirement for interviewers.

**Front end**
- Restructured into `public/` with `index.html`, `script.js`, `styles.css`.
- Fixed the original script: mismatched element IDs (`ItemInput`, `addBtn`) and an `ariaValueMax` typo.
- Built the item display: an array rendered into a `<ul>`, each row with a Remove button and a unique ID.
- Added quantity input (`type="number"`, 1–99) and showed `×N` on each row.
- Added the name allowlist and error messages in a `#status` paragraph.
- Mobile-first CSS with 44px tap targets; fixed number input styling and long-name overflow.
- Removed dead CSS (checkbox/done, demo banner) and an unused root `script.js`.

**Bugs found and fixed**
- Two scripts pasted into one file caused `Identifier 'form' has already been declared`, so nothing ran.
- Absolute `/script.js` and `/styles.css` paths meant the script never loaded locally.
- Quantity code placed outside `render()` threw `item is not defined` and halted the script.
- Duplicate `id="status"` after moving the status paragraph.
- A stale cached `script.js` made the allowlist look broken; a hard refresh fixed it.

**Back end**
- Scaffolded `src/index.js` (Worker), `wrangler.toml`, `migrations/0001_init.sql`, `package.json`, `.dev.vars`, `.gitignore`.
- API routes: list, add, toggle done, delete; Access JWT verification; demo sessions; daily cleanup cron.
- Upgraded Node 16 → 24 to satisfy Wrangler, then verified the Worker locally with curl.

**Repository**
- Initialized git and pushed to `Auroradidthat/Nutrition-App` (`a65d9d7`), tagged `v0.1.0`.

### v0.1.1 — 2026-10-11 — Rename

- Renamed the app to **Nutrition App** across title, heading, package, Worker and D1 names (`44628d7`).
- Patch bump: no new capability.

### v0.2.0 — 2026-10-11 — Worker: quantity, allowlist, docs, versioning

- Added `migrations/0002_add_quantity.sql` (`quantity INTEGER NOT NULL DEFAULT 1`).
- Worker now returns and accepts `quantity` (optional on POST, defaults to 1).
- Worker enforces the same name allowlist as the front end.
- Verified locally: valid adds succeed; quantity `0`, `100`, `2.5` and `"3"` are rejected; `<script>`, SQL-style text and symbol strings are rejected; demo seeds include quantity.
- Added `README.md` and this `DEVLOG.md`.
- Began semantic versioning: `package.json` set to `0.2.0`; past commits tagged `v0.1.0` and `v0.1.1`.
- Minor bump: new backwards-compatible capability (quantity) plus a schema migration.
