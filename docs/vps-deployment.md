# Deploying Chikbo to a VPS (chikbo.com)

One server runs everything on one domain:

| Address | What |
|---|---|
| `https://chikbo.com` | Storefront (each page served with its own title, description and share image) |
| `https://chikbo.com/admin` | Admin console |
| `https://chikbo.com/api/v1/…` | API |
| `https://chikbo.com/uploads/…` | Photos and videos (from Cloudflare R2) |

The database (Neon Postgres) and media storage (Cloudflare R2) stay in the
cloud; the VPS holds only code, so it can be rebuilt at any time.

Nginx terminates HTTPS and serves static files; a single Node process managed
by PM2 handles the API and renders storefront pages. Files live in `deploy/`.

## What you need

- An Ubuntu 22.04 or 24.04 VPS — 1 vCPU / 2 GB RAM is enough to start.
- DNS at your registrar, both pointing to the server's IP:
  - `A  chikbo.com      → <server-ip>`
  - `A  www.chikbo.com  → <server-ip>`

## First-time setup

```bash
# on the server
curl -fsSL https://raw.githubusercontent.com/adbhargav/chikbo/main/deploy/setup-server.sh -o setup-server.sh
bash setup-server.sh
```

That installs Node 20, Nginx, Certbot and PM2, opens only SSH and web ports,
and clones the repo to `/var/www/chikbo`. (For a private repo, clone it
yourself to `/var/www/chikbo` first.)

Then:

```bash
cp /var/www/chikbo/deploy/env.production.example /var/www/chikbo/apps/api/.env
nano /var/www/chikbo/apps/api/.env          # fill in every blank
bash /var/www/chikbo/deploy/deploy.sh       # install, build, start
```

```bash
sudo cp /var/www/chikbo/deploy/nginx-chikbo.com.conf /etc/nginx/sites-available/chikbo.com
sudo ln -sf /etc/nginx/sites-available/chikbo.com /etc/nginx/sites-enabled/chikbo.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d chikbo.com -d www.chikbo.com    # free HTTPS, auto-renewing
pm2 save && pm2 startup                                  # run the command it prints
```

Open `https://chikbo.com` and `https://chikbo.com/admin/login`.

## Updating later

```bash
bash /var/www/chikbo/deploy/deploy.sh
```

It pulls `main`, rebuilds, reloads the process and checks `/health`.

## After the site is live

1. Change the seeded admin password.
2. Razorpay dashboard → Webhooks → `https://chikbo.com/api/v1/webhooks/razorpay`
   (events `payment.captured`, `payment.failed`, `refund.processed`); put the
   secret in `.env` as `RAZORPAY_WEBHOOK_SECRET`, then `pm2 reload chikbo --update-env`.
3. Shiprocket → Settings → API → Webhooks → `https://chikbo.com/api/v1/webhooks/courier`;
   put the token in `.env` as `SHIPROCKET_WEBHOOK_TOKEN`.
4. Google sign-in: add `https://chikbo.com` to the OAuth client's authorised origins.

## Useful commands

```bash
pm2 status                 # is it running?
pm2 logs chikbo            # live logs
pm2 reload chikbo --update-env   # after editing .env
sudo nginx -t              # check Nginx config
sudo certbot renew --dry-run
```

## Schema changes

The database has no migration history; schema changes are applied with
`npx prisma db push` from `apps/api` (additive changes only). `deploy.sh` does
not run it automatically, so a deploy can never alter the database by surprise.
