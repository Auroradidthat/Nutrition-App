# Runs the Nutrition App locally with `wrangler dev` (Worker + local D1).
# This is a development/self-hosting convenience, not a Cloudflare deployment.
FROM node:24-bookworm-slim

WORKDIR /app

# Install dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV WRANGLER_SEND_METRICS=false
EXPOSE 8787

# Apply migrations to the local D1 database, then serve on all interfaces
# (inside the container, 127.0.0.1 would not be reachable from the host).
CMD ["sh", "-c", "npx wrangler d1 migrations apply nutrition-db --local && npx wrangler dev --ip 0.0.0.0 --port 8787"]
