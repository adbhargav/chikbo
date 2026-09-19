#!/usr/bin/env bash
# Pull the latest code, build everything, and restart. Run on the server:
#   bash /var/www/chikbo/deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/chikbo
cd "$APP_DIR"

if [ ! -f apps/api/.env ]; then
  echo "apps/api/.env is missing — copy deploy/env.production.example and fill it in first." >&2
  exit 1
fi

echo "==> Code"
git pull --ff-only

echo "==> Dependencies"
npm ci

echo "==> Build"
# Same-origin hosting: the storefront and admin call /api on their own domain,
# so VITE_API_URL stays unset. These two only shape links and previews.
export VITE_SITE_URL=https://chikbo.com
export VITE_WEB_URL=https://chikbo.com
npm run build --workspace packages/shared
npm run prisma:generate --workspace apps/api
npm run build --workspace apps/api
npm run build --workspace apps/web
npm run build --workspace apps/admin

echo "==> Restart"
if pm2 describe chikbo >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

echo "==> Health"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null; then echo "API is up."; exit 0; fi
  sleep 1
done
echo "API did not come up — check: pm2 logs chikbo" >&2
exit 1
