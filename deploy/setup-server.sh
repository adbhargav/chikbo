#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 VPS. Run as a sudo-capable user:
#   bash setup-server.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/adbhargav/chikbo.git}"
APP_DIR=/var/www/chikbo

echo "==> System packages"
sudo apt-get update -y
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

echo "==> Node.js 20"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

echo "==> Firewall: SSH + web only"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "==> Code"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then git clone "$REPO_URL" "$APP_DIR"; fi

cat <<NEXT

Server is ready. Next:
  1. cp $APP_DIR/deploy/env.production.example $APP_DIR/apps/api/.env   and fill it in
  2. bash $APP_DIR/deploy/deploy.sh
  3. sudo cp $APP_DIR/deploy/nginx-chikbo.com.conf /etc/nginx/sites-available/chikbo.com
     sudo ln -sf /etc/nginx/sites-available/chikbo.com /etc/nginx/sites-enabled/chikbo.com
     sudo rm -f /etc/nginx/sites-enabled/default
     sudo nginx -t && sudo systemctl reload nginx
  4. sudo certbot --nginx -d chikbo.com -d www.chikbo.com
  5. pm2 save && pm2 startup   (run the command it prints)
NEXT
