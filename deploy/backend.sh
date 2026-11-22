#!/usr/bin/env bash
# Runs ON THE SERVER after `git pull` (called by the GitHub Actions deploy job).
#   usage: bash deploy/backend.sh <commit-before-pull>
# Does exactly what was done by hand before: composer install (only when the
# lock file changed), migrations, then OPcache clear via a one-time URL.
set -euo pipefail

OLD_SHA="${1:-}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR/backend"

if [ -z "$OLD_SHA" ] || ! git diff --quiet "$OLD_SHA" HEAD -- composer.lock; then
  echo "==> composer.lock changed: composer install"
  composer install --no-dev --optimize-autoloader --no-interaction
else
  echo "==> composer.lock unchanged: skip composer install"
fi

echo "==> migrations"
php artisan migrate --force

echo "==> OPcache clear"
# CLI opcache_reset() does not touch the web server's PHP, so hit a one-time
# random URL and delete it straight after.
TOKEN="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
FILE="public/opcache-${TOKEN}.php"
printf '<?php opcache_reset(); echo "OPcache cleared";\n' > "$FILE"
trap 'rm -f "$FILE"' EXIT
curl -fsS "${API_URL:-https://api.tinkumobile.in}/opcache-${TOKEN}.php" || echo "(warning: OPcache URL failed — clear it by hand)"
echo
echo "==> backend deploy done"
