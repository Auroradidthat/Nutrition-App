# Nutrition App

A mobile-first web app for keeping a list of food items with quantities, built with plain HTML/CSS/JS on the front end and a Cloudflare Worker + D1 database on the back end.

> **Status: in development (v0.3.2).** The front end is connected to the Worker API and works end to end locally. It has not been deployed yet. See [DEVLOG.md](DEVLOG.md) for what's planned and the full change history.

## Features

**Front end**
- Add items with a name and a quantity (1–99), saved on the server
- Remove items individually
- List persists across refreshes and devices
- Character allowlist on item names (letters, numbers, spaces and `' ’ & , . - % ( ) /`)
- Inline error messages (validation, server errors, lost connection, signed out)
- `/demo` automatically uses the public sandbox API
- Mobile-first layout with 44px tap targets and no iOS zoom on inputs

**Back end**
- REST API on a Cloudflare Worker, storage in D1 (SQLite)
- Authentication via Cloudflare Access, verified server-side from the signed JWT
- Public `/demo` sandbox for visitors who don't have an account
- Server-side validation that mirrors the front end

## Project structure

```
.
├── public/                  # Static front end (served as-is)
│   ├── index.html
│   ├── script.js            # UI: talks to the API, renders the list
│   ├── rules.js             # Validation rules, shared by browser and Worker
│   └── styles.css
├── src/                     # Cloudflare Worker
│   ├── index.js             # Routing and request handlers
│   ├── auth.js              # Cloudflare Access JWT verification
│   ├── demo.js              # Demo session cookie and seed data
│   ├── store.js             # All D1 queries
│   └── http.js              # json / readJson / sameOrigin helpers
├── migrations/              # D1 schema migrations (applied in order)
│   ├── 0001_init.sql
│   └── 0002_add_quantity.sql
├── wrangler.toml            # Cloudflare config
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
└── DEVLOG.md                # Running log of changes and decisions
```

## Getting started

**Requirements:** Node.js 22 or newer (Wrangler requirement) and a Cloudflare account (only needed to deploy).

The front end needs the Worker API, so opening `public/index.html` directly (or via a static server such as Live Server) will load the page but can't save or load items. Run the full stack instead:

```bash
npm install
npm run db:migrate:local   # creates/updates the local D1 database
npm run dev                # http://localhost:8787  (and /demo for the sandbox)
```

### With Docker

```bash
docker compose up -d --build   # build and start in the background
docker compose logs -f         # watch the logs
docker compose down            # stop (data is kept in a Docker volume)
```

Then open http://localhost:8787.

- The container runs `wrangler dev` with a local D1 database stored in the `wrangler_state` Docker volume, so items survive restarts. `docker compose down -v` deletes that data.
- Migrations are applied automatically on start.
- The project folder is mounted into the container, so edits to `public/` and `src/` show up without rebuilding (hard refresh the browser for front-end changes).
- It still needs `.dev.vars` (see above). The port is bound to `127.0.0.1` only.
- **This is not a production deployment.** There is no real authentication in this mode: `DEV_USER` stands in for a signed-in user, so anyone who can reach the port is that user. Don't expose it to a network or the internet. For real multi-device use, deploy to Cloudflare (see [Deploying](#deploying)).

The first start can take 30+ seconds. After changing `script.js` or `styles.css`, hard refresh (Ctrl+Shift+R) to bypass the browser cache.

Locally there is no Cloudflare Access in front of the Worker, so `.dev.vars` supplies a fake signed-in user:

```
DEV_USER=dev@example.com
```

`DEV_USER` is only honoured when the request host is `localhost`, `127.0.0.1`, `0.0.0.0` or `[::1]`; on any other host it is ignored and Access authentication is required. `.dev.vars` is gitignored and must never be set in production.

## API

All routes return JSON. `owner` is always derived server-side and is never accepted from the client.

| Method | Route | Body | Description |
|---|---|---|---|
| `GET` | `/api/items` | | List the signed-in user's items |
| `POST` | `/api/items` | `{ "text": "Milk", "quantity": 2 }` | Add an item (`quantity` optional, default 1) |
| `PATCH` | `/api/items/:id` | `{ "done": true }` | Mark an item done or not done |
| `DELETE` | `/api/items/:id` | | Remove an item |

The same four routes exist under `/api/demo/items` for the public demo, identified by a random cookie instead of a login.

**Validation rules** (defined once in `public/rules.js` and used by both the browser and the Worker)
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

Planned work and known issues are tracked in [DEVLOG.md](DEVLOG.md) under **Upcoming** and **Known issues**.

## Versioning

This project uses [Semantic Versioning](https://semver.org/). The current version is in `package.json`, and each release is a git tag (`v0.2.0`, ...). It is in initial development (`0.y.z`), so the API and data model may still change. See [DEVLOG.md](DEVLOG.md) for the full release history and the bump rules.

## Security notes

- Item names are rendered with `textContent`, never `innerHTML`, so input can't be interpreted as HTML.
- All SQL uses bound parameters. The allowlist is an extra layer, not the primary defence.
- Mutating requests must come from the app's own origin.
- Keep API tokens and secrets out of the repository.
