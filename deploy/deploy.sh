#!/usr/bin/env bash
set -eo pipefail
DEPLOY_DIR="/opt/tradingbot"

retry() {
  local attempts="$1" delay="$2"; shift 2
  local n=1
  until "$@"; do
    [ "$n" -ge "$attempts" ] && { echo "ERROR: failed after $attempts attempts: $*"; return 1; }
    echo "Attempt $n/$attempts failed — retrying in ${delay}s..."
    sleep "$delay"; n=$((n+1))
  done
}

cd "${DEPLOY_DIR}"

echo "=== Logging in to GHCR ==="
retry 3 5 bash -c 'echo "${GH_TOKEN}" | docker login ghcr.io -u "${GH_ACTOR}" --password-stdin'

echo "=== Pulling images ==="
retry 3 5 docker pull "${BACKEND_IMAGE}:latest"
docker tag "${BACKEND_IMAGE}:latest" tradingbot-backend:latest
retry 3 5 docker pull "${FRONTEND_IMAGE}:latest"
docker tag "${FRONTEND_IMAGE}:latest" tradingbot-frontend:latest

echo "=== Ensuring DB and Redis are up ==="
docker compose -p tradingbot \
  -f docker-compose.tradingbot.yml \
  --env-file .env \
  up -d tradingbot-pg tradingbot-redis

# Synchronize and verify database credentials
echo "=== Synchronizing DB credentials ==="
for i in $(seq 1 10); do
  if docker compose -p tradingbot -f docker-compose.tradingbot.yml exec -T tradingbot-pg \
      sh -c 'psql -U "${POSTGRES_USER:-tradingbot}" -d "${POSTGRES_DB:-tradingbot}" -c "ALTER USER \"${POSTGRES_USER:-tradingbot}\" WITH PASSWORD '\''${POSTGRES_PASSWORD}'\'';"' < /dev/null >/dev/null 2>&1; then
    echo "DB credentials synchronized!"
    break
  fi
  sleep 1
done

echo "=== Verifying TCP DB authentication ==="
for i in $(seq 1 10); do
  if docker compose -p tradingbot -f docker-compose.tradingbot.yml exec -T tradingbot-pg \
      sh -c 'PGPASSWORD="${POSTGRES_PASSWORD}" psql -h 127.0.0.1 -U "${POSTGRES_USER:-tradingbot}" -d "${POSTGRES_DB:-tradingbot}" -c "SELECT 1;"' < /dev/null >/dev/null 2>&1; then
    echo "PostgreSQL TCP authentication verified!"
    break
  fi
  sleep 1
done

echo "=== Starting Full TradingBot Stack ==="
docker compose -p tradingbot \
  -f docker-compose.tradingbot.yml \
  --env-file .env \
  up -d --no-build

echo "=== Fast health check probe ==="
HEALTHY=0
for i in $(seq 1 20); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8003/api/health 2>/dev/null || echo "000")
  if [ "${HTTP_CODE}" = "200" ]; then
    echo "Backend healthy! Responded HTTP 200 in ~ $((i * 2))s!"
    HEALTHY=1; break
  fi
  sleep 2
done

if [ "${HEALTHY}" -eq 0 ]; then
  echo "ERROR: Backend health check failed. Recent logs:"
  docker logs tradingbot-backend --tail 50 2>&1
  exit 1
fi

# Optional DB migration
if [ "${RUN_DB_MIGRATION}" = "true" ]; then
  echo "=== Running DB migration ==="
  if [ ! -f scripts/db_migrate.sh ] || [ ! -f tradingbot.sql ]; then
    echo "ERROR: migration assets missing on server."
    exit 1
  fi
  FORCE_YES=1 bash scripts/db_migrate.sh
  docker restart tradingbot-backend >/dev/null 2>&1 || true
fi

echo "=== Installing Nginx config ==="
sudo cp deploy/nginx/tradingbot.conf /etc/nginx/conf.d/tradingbot.conf
if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx
  echo "Nginx reloaded!"
fi

echo "=== Deployment complete! ==="
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep -E "tradingbot|hive"

