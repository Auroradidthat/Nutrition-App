# Nutrition App

A mobile-first web app for keeping a list of food items with quantities, built with plain HTML/CSS/JS on the front end and a Cloudflare Worker + D1 database on the back end.

> **Status: deployed and working (v0.4.2).** The real app at https://nutrition-app.rodesignedthat.workers.dev is protected by Cloudflare Access (your email only). **Try the public demo (no login, 15 items per visitor): https://nutrition-demo.rodesignedthat.workers.dev**

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
│   ├── demo.js              # Demo session cookie and seed data│   ├── store.js             # All D1 queries
│   └── http.js              # json / readJson / sameOrigin helpers
├── migrations/              # D1 schema migrations (applied in order)
│   ├── 0001_init.sql
│   └── 0002_add_quantity.sql
├── wrangler.toml            # Cloudflare config (default env = real app, env.demo = public demo)
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
- List size: 500 items per user, 15 per demo session (including the 3 seeded items)

## Authentication and the demo

The app is deployed as **two Workers built from the same code**, so the public demo can never reach real data:

| Worker | URL | Access | Database |
|---|---|---|---|
| `nutrition-app` (default) | `nutrition-app.rodesignedthat.workers.dev` | Cloudflare Access, your email only | `nutrition-db` |
| `nutrition-demo` (`--env demo`) | `nutrition-demo.rodesignedthat.workers.dev` | None (public) | `nutrition-demo-db` |

- **Real users:** Cloudflare Access sits in front of the whole `nutrition-app` URL. The Worker also verifies the `Cf-Access-Jwt-Assertion` token (signature, expiry, issuer, audience) and uses the email as the owner.
- **Demo:** the demo Worker runs with `DEMO_ONLY=true`, which makes every items route the sandbox. Each visitor gets a random `demo_sid` cookie and an isolated, pre-seeded list capped at 15 items. A daily cron deletes demo data older than 24 hours. Give interviewers the demo URL.
- **Demo abuse protection:** the demo Worker has a per-IP rate limit (Workers Rate Limiting binding, 60 requests per minute, `429` over the limit) and a ceiling of 200 sessions (`503` "demo is busy" for new visitors when full). The rate limit is counted per Cloudflare location and is approximate, so it slows sustained floods but won't stop a short burst. The ceiling bounds D1 writes and storage, which matters because the Free plan's daily limits are shared across the account.

## Deploying

One-time setup:

1. `npx wrangler login`
2. `npx wrangler d1 create nutrition-db` and `npx wrangler d1 create nutrition-demo-db`, then put each printed `database_id` in `wrangler.toml`
3. Apply migrations: `npm run db:migrate:remote` and `npm run db:migrate:demo:remote`

Deploy:

```bash
npm run deploy        # real app (nutrition-app)
npm run deploy:demo   # public demo (nutrition-demo)
```

Protect the real app with Cloudflare Access (one-time):

1. Complete **Zero Trust** setup (Free plan) and note your team domain (`https://<team>.cloudflareaccess.com`). New accounts use the Cloudflare identity provider by default; add **One-time PIN** under **Integrations → Identity providers** if you want email codes.
2. **Access controls → Applications → Add an application → Self-hosted.**
   - Public hostname: `nutrition-app.rodesignedthat.workers.dev` (use the **Custom** input), no path.
   - Policy: **Allow**, **Include → Emails** = your email. No Require or Exclude rules.
   - Login methods: accept all available identity providers.
3. Put your team domain in `TEAM_DOMAIN` and the application's **AUD tag** in `POLICY_AUD` in `wrangler.toml`, then `npm run deploy`. The AUD tag is under the application's Overview, and is also the `kid` value in the login redirect URL (the `aud` claim of the `meta` token matches it). **Changing or recreating the Access application changes its AUD tag**, so repeat this step.
4. Do **not** protect `nutrition-demo`.

Use a **hostname-based application** rather than the Worker's own **Access** tab. In this account, the Worker-level application blocked the owner's email even with a correct Allow policy (see DEVLOG v0.4.2).

The Worker verifies the signed `Cf-Access-Jwt-Assertion` header itself rather than relying on `ctx.access`, because Workers with static assets don't receive `ctx.access`.

Local demo-only mode: `npm run dev:demo` (port 8788).

## Roadmap

Planned work and known issues are tracked in [DEVLOG.md](DEVLOG.md) under **Upcoming** and **Known issues**.

## Versioning

This project uses [Semantic Versioning](https://semver.org/). The current version is in `package.json`, and each release is a git tag (`v0.2.0`, ...). It is in initial development (`0.y.z`), so the API and data model may still change. See [DEVLOG.md](DEVLOG.md) for the full release history and the bump rules.

## Security notes

- Item names are rendered with `textContent`, never `innerHTML`, so input can't be interpreted as HTML.
- All SQL uses bound parameters. The allowlist is an extra layer, not the primary defence.
- Mutating requests must come from the app's own origin.
- Keep API tokens and secrets out of the repository.
