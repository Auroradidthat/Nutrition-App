# Nutrition App

A mobile-first web app for keeping a list of food items with quantities, built with plain HTML/CSS/JS on the front end and a Cloudflare Worker + D1 database on the back end.

> **Status: in development.** The front end works as a standalone, in-memory list. The Worker API is built and tested locally but the front end is not connected to it yet. See [Roadmap](#roadmap) and [DEVLOG.md](DEVLOG.md).

## Features

**Front end (working now)**
- Add items with a name and a quantity (1–99)
- Remove items individually
- Character allowlist on item names (letters, numbers, spaces and `' ’ & , . - % ( ) /`)
- Inline error messages
- Mobile-first layout with 44px tap targets and no iOS zoom on inputs

**Back end (built, not yet connected)**
- REST API on a Cloudflare Worker, storage in D1 (SQLite)
- Authentication via Cloudflare Access, verified server-side from the signed JWT
- Public `/demo` sandbox for visitors who don't have an account
- Server-side validation that mirrors the front end

## Project structure

```
.
├── public/                  # Static front end
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── src/index.js             # Worker: API, auth, demo sessions, cron cleanup
├── migrations/              # D1 schema migrations (applied in order)
│   ├── 0001_init.sql
│   └── 0002_add_quantity.sql
├── wrangler.toml            # Cloudflare config
├── package.json
├── README.md
└── DEVLOG.md                # Running log of changes and decisions
```

## Getting started

**Requirements:** Node.js 22 or newer (Wrangler requirement) and a Cloudflare account (only needed to deploy).

### Front end only
Open `public/index.html` in a browser, or serve the `public/` folder with any static server (e.g. the VS Code Live Server extension). No build step.

### Full stack, locally
```bash
npm install
npm run db:migrate:local   # creates the local D1 database
npm run dev                # http://localhost:8787
```

Locally there is no Cloudflare Access in front of the Worker, so `.dev.vars` supplies a fake signed-in user:

```
DEV_USER=dev@example.com
```

`.dev.vars` is gitignored and must never be set in production.

## API

All routes return JSON. `owner` is always derived server-side and is never accepted from the client.

| Method | Route | Body | Description |
|---|---|---|---|
| `GET` | `/api/items` | | List the signed-in user's items |
| `POST` | `/api/items` | `{ "text": "Milk", "quantity": 2 }` | Add an item (`quantity` optional, default 1) |
| `PATCH` | `/api/items/:id` | `{ "done": true }` | Mark an item done or not done |
| `DELETE` | `/api/items/:id` | | Remove an item |

The same four routes exist under `/api/demo/items` for the public demo, identified by a random cookie instead of a login.

**Validation rules**
- `text`: required, up to 100 characters, must match the allowlist
- `quantity`: whole number from 1 to 99
- List size: 500 items per user, 50 per demo session

## Authentication and the demo

- **Real users:** Cloudflare Access sits in front of the app. The Worker verifies the `Cf-Access-Jwt-Assertion` token (signature, expiry, issuer, audience) and uses the email as the owner.
- **Demo:** `/demo` and `/api/demo/*` bypass Access. Each visitor gets a random `demo_sid` cookie and an isolated, pre-seeded list. A daily cron deletes demo data older than 24 hours.

## Deploying

1. `npx wrangler login`
2. `npx wrangler d1 create nutrition-db` and put the printed `database_id` in `wrangler.toml`
3. `npm run db:migrate:remote`
4. `npm run deploy`
5. In Cloudflare Zero Trust:
   - Create a self-hosted **Access** application for the app's domain and allow your email
   - Copy its **AUD tag** and your **team domain** into `POLICY_AUD` and `TEAM_DOMAIN` in `wrangler.toml`
   - Add a **Bypass** policy for `/demo*` and `/api/demo/*`
6. Add a Cloudflare **rate limiting rule** on `/api/demo/*`

## Roadmap

- [ ] Connect `public/script.js` to the API (replace the in-memory array)
- [ ] Demo mode: banner and `/demo` detection in the front end
- [ ] Per-item done/check-off in the UI (API already supports it)
- [ ] `−` / `+` buttons for quantity
- [ ] Deploy and configure Access
- [ ] Rate limiting for the demo routes
- [ ] Offline support / PWA manifest

## Versioning

This project uses [Semantic Versioning](https://semver.org/). The current version is in `package.json`, and each release is a git tag (`v0.2.0`, ...). It is in initial development (`0.y.z`), so the API and data model may still change. See [DEVLOG.md](DEVLOG.md) for the full release history and the bump rules.

## Security notes

- Item names are rendered with `textContent`, never `innerHTML`, so input can't be interpreted as HTML.
- All SQL uses bound parameters. The allowlist is an extra layer, not the primary defence.
- Mutating requests must come from the app's own origin.
- Keep API tokens and secrets out of the repository.
