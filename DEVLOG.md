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

- [ ] Quantity `−` / `+` buttons (replaces the tiny native spinner)
- [ ] Check-off (done) toggle in the UI
- [ ] Check the deployed apps on a phone (the desktop login is confirmed)
- [ ] Verify the deployed apps in a real browser (desktop and phone)
- [ ] Decide: one private list per user, or shared household lists
- [ ] Automated tests for `public/rules.js` and `src/store.js`
- [ ] Reword placeholder text and labels from "grocery" to nutrition theme

## Known issues

- The front end can no longer be opened as a plain file or via Live Server; it needs `npm run dev`.
- `npm` reports v9.6.1 under Node 24, suggesting a stale global npm on PATH. Not blocking.

## Decisions

| Decision | Reason |
|---|---|
| Cloudflare Workers + D1 for the back end | Needs cross-device storage; no separate server to host; generous free tier |
| Cloudflare Access for login | No password handling or auth code to maintain |
| Allowlist (not blocklist) for item names | Safer and simpler than enumerating bad characters |
| Apostrophe allowed in names | Real items need it ("Reese's"); safe because queries use bound parameters |
| `"` not allowed in names | Closes off attribute/injection edge cases; users can write "inch" |
| Same allowlist enforced in browser and Worker | Browser check is only for UX; the Worker is the real enforcement |
| Quantity capped at 1–99, integers only | Simple, realistic range; rejects `0`, negatives, decimals, strings |
| Absolute asset paths in `index.html` (`/script.js`) | The app is always served by the Worker, so absolute paths work from any URL. (Earlier, relative paths were used so the page worked via `file://`.) |
| Save to the server before updating the UI | The server assigns IDs and is the source of truth; failures show a message instead of a list that silently diverges |
| Disable the Add button while saving | Prevents duplicate items from double taps |
| Validation rules live in one file, `public/rules.js`, imported by both the Worker and the browser | The same regex and limits were duplicated in three places and kept in sync by a comment |
| `DEV_USER` honoured only on localhost hostnames | A stray production variable can no longer silently bypass authentication; fails closed |
| Worker split into `auth`, `store`, `http` modules | `index.js` is routing and handlers only; SQL and auth are isolated and easier to test |
| One delegated click listener for Remove buttons | One listener instead of one closure per row |
| Verify the Access JWT header in the Worker instead of using `ctx.access` | Workers with static assets run behind an internal router that doesn't pass `ctx.access`; the signed `Cf-Access-Jwt-Assertion` header is still available |
| Hostname-based Access application for `nutrition-app.rodesignedthat.workers.dev` instead of the Worker's own Access tab | The Worker-level application returned Blocked for the owner's email despite a matching Allow policy, and its policy evaluation couldn't be inspected. The hostname-based application worked immediately. |
| Docker runs `wrangler dev`, bound to `127.0.0.1` | Convenient local/self-hosted run, but it has no real auth (fake `DEV_USER`), so it is not reachable from other machines. Real multi-device use needs the Cloudflare deployment. |

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

### v0.3.0 — 2026-10-11 — Front end connected to the API

- `public/script.js` now loads, adds and removes items through the Worker API instead of an in-memory array.
- Items persist across refreshes and are shared across devices for the same signed-in user.
- `/demo` is detected from the URL and uses `/api/demo/items` (public sandbox).
- Friendly status messages for server errors, lost connection and expired sign-in (401).
- Add button is disabled while a save is in flight.
- `index.html` asset paths changed back to absolute (`/script.js`, `/styles.css`).
- Verified by running the real `script.js` against the local Worker with a stubbed DOM: load, add, validation errors, remove, reload persistence, demo seeding and cookie session, and the server-down message.
- Not yet verified in a real browser.
- Minor bump: new user-visible capability (persistence).

### v0.3.1 — 2026-10-11 — Docker setup

- Added `Dockerfile`, `docker-compose.yml` and `.dockerignore` to run the app with `docker compose up -d --build`.
- The container runs `wrangler dev` on `0.0.0.0:8787` and applies D1 migrations on start.
- Local D1 data persists in the `wrangler_state` Docker volume; `node_modules` is kept in its own volume so Linux and Windows dependencies don't clash.
- Port is published on `127.0.0.1` only. This mode has no real authentication (`DEV_USER` stands in for a signed-in user), so it must not be exposed to a network.
- Verified: image builds, `/`, `/demo` and the API respond, validation works, and data survives a container restart.
- README gained a "With Docker" section.
- Patch bump: tooling only, no change to app behaviour.

### v0.3.2 — 2026-10-11 — Refactor (no behaviour change)

- **Shared rules:** new `public/rules.js` holds the name allowlist, length and quantity limits and a pure `validateItem()`. Both `script.js` and the Worker use it; the input `min`/`max`/`maxlength` are set from it in JS instead of hardcoded in the HTML.
- **Worker split:** `src/index.js` is now routing plus four small handlers (`listItems`, `createItem`, `updateItem`, `deleteItem`) looked up from a table. SQL moved to `src/store.js` (column list defined once), auth to `src/auth.js`, demo sessions to `src/demo.js`, helpers to `src/http.js`. `DEMO_PREFIX` replaces the duplicated `'demo:'` strings.
- **Security hardening:** `DEV_USER` is ignored unless the request host is local, so a misconfigured production variable cannot bypass authentication.
- **script.js:** `setStatus`, `run` (try/catch wrapper), `createRow`, and one delegated Remove listener; now an ES module. Demo detection matches `/demo` and `/demo/...` only.
- **CSS:** custom properties for tap size, gap, radius, border and danger colour; the quantity field no longer stretches on desktop (fixes a known issue); list styled by `#item-list`.
- **HTML:** removed empty wrappers and stale comments; list id is now `item-list`.
- **Docker/npm:** new `dev:container` script is the single source for the migrate-then-serve command; the Dockerfile runs it.
- **Docs:** README structure updated; the roadmap now lives only in DEVLOG.
- **Small visible changes:** validation messages are now identical in the browser and API (e.g. "Quantity must be a whole number from 1 to 99."); a new demo session is seeded on its first request of any method, not only GET; unsupported methods return 405 before authentication.
- Verified against the running container: 30+ API checks (validation, ownership, 401/403/404/405, host guard, demo, cron handler) and the real `script.js` module run against the live API for `/` and `/demo`. Not yet verified in a real browser.
- Patch bump: internal change, no new capability.

### v0.4.0 — 2026-10-12 — Deployed to Cloudflare; separate public demo

- Created D1 databases `nutrition-db` (real) and `nutrition-demo-db` (demo) and applied migrations 0001–0002 to both.
- Deployed `nutrition-app` at https://nutrition-app.rodesignedthat.workers.dev (returns 401 until Access is configured, so it fails closed).
- Added `[env.demo]` to `wrangler.toml` and deployed `nutrition-demo` at https://nutrition-demo.rodesignedthat.workers.dev with its own database and no login.
- Worker: `DEMO_ONLY="true"` treats every items route as the cookie-based sandbox (`src/index.js`).
- New npm scripts: `deploy:demo`, `dev:demo`, `db:migrate:demo:remote`.
- Verified live: static files, demo seeding/add/validation/origin checks, real app returns 401, and the real database holds no demo data. Removed 7 sandbox rows my own live tests had written to the real database before the split.
- Not yet done: Cloudflare Access on `nutrition-app`; real-browser verification.
- Minor bump: new capability (production deployment and separate demo).

### v0.4.1 — 2026-10-12 — Cloudflare Access enabled on the real app

- Completed Zero Trust setup (Free plan) and protected `nutrition-app` with an Access application (All traffic, allow list: owner email).
- `wrangler.toml`: set `TEAM_DOMAIN` (`https://broken-recipe-57bc.cloudflareaccess.com`) and `POLICY_AUD`; redeployed `nutrition-app`.
- The AUD tag was read from the Access login redirect (`kid` parameter and the `aud` claim of the `meta` token agreed).
- Verified from outside: `/` and `/api/items` on the real app redirect to the Access login (302); a forged `Cf-Access-Jwt-Assertion` header is still blocked (302); the demo Worker remains public (200).
- Corrected the README Access steps (the setting is the Worker's **Access** tab, not Settings → Domains & Routes).
- Not yet confirmed by an interactive login in a real browser; tracked under Upcoming.
- Patch bump: configuration of an existing capability, no code change.

### v0.4.2 — 2026-10-12 — Access login working

- The Worker-level Access application (`nutrition-app - Cloudflare Workers`) blocked the owner's email on every attempt (4+ blocked logins) even after resetting its policy to a single Allow rule. The cause was not identified; the access logs did not expose a reason and the API token created to inspect it lacked the required permission.
- Replaced it with a standard hostname-based self-hosted Access application for `nutrition-app.rodesignedthat.workers.dev` (Allow, owner email, all login methods).
- The new application has a different AUD tag; read it from the login redirect (`kid` equals the `aud` claim), set `POLICY_AUD`, and redeployed.
- Verified: unauthenticated `/` and `/api/items` redirect to login (302), a forged `Cf-Access-Jwt-Assertion` header is blocked, the demo remains public (200), and **the owner confirmed an interactive login and working app**.
- Documented the correct Access setup and the AUD-changes-on-recreate gotcha in the README.
- Housekeeping: the temporary read-only API token and its file were to be deleted and revoked after diagnosis.
- Patch bump: configuration change, no code change.

### Unreleased — 2026-10-19 — Removed the public demo

- The app is a single private deployment, so the separate demo and its sandbox storage were dropped.
- Worker: removed `src/demo.js`, the `/api/demo/items` route, `DEMO_ONLY`, per-session item limits, `store.seed`, `store.purgeExpired` and the `scheduled` cron handler (it only cleaned up demo data).
- Front end: `public/script.js` always uses `/api/items`.
- Config: removed `[env.demo]` and the cron trigger from `wrangler.toml`, and the `deploy:demo`, `dev:demo` and `db:migrate:demo:remote` scripts from `package.json`.
- Docs: removed demo sections from the README; trimmed demo-only entries from Upcoming and Decisions. Older History entries still mention the demo because they record what was true at the time.
- Not done: the deployed `nutrition-demo` Worker and `nutrition-demo-db` database still exist on Cloudflare and need deleting separately. The next `npm run deploy` of `nutrition-app` will remove its cron trigger.
- Suggested bump: minor (`0.5.0`), since a feature was removed.
