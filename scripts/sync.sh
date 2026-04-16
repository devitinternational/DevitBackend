#!/bin/bash
set -e

BACKEND_PATH="/home/venkataramana/Desktop/DevIt/devit-backend"
DASHBOARD_PATH="/home/venkataramana/Desktop/DevIt/devit-dashboard/prisma/generated/prisma"

echo "🔄 Generating Prisma client..."
cd "$BACKEND_PATH"
pnpm prisma generate

echo "📦 Syncing to dashboard..."
mkdir -p "$DASHBOARD_PATH"
rsync -av --delete ./prisma/generated/prisma/ "$DASHBOARD_PATH/"

echo "✅ Sync complete."