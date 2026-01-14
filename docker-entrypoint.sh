#!/bin/sh
set -e

# Color output
log() { echo "[entrypoint] $1"; }
log_info() { echo "[entrypoint] INFO: $1"; }
log_warn() { echo "[entrypoint] WARN: $1"; }

log_info "Starting Hytale Server Manager..."

# Create data directories if they don't exist
log_info "Ensuring data directories exist..."
mkdir -p /app/data/db
mkdir -p /app/data/logs
mkdir -p /app/data/servers
mkdir -p /app/data/backups
mkdir -p /app/data/certs

# Generate secrets if not provided
generate_secret() {
    # Generate a 64-character hex string using Node.js
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

generate_short_secret() {
    # Generate a 32-character hex string (16 bytes)
    node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
}

# Set default environment variables
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3001}"
export HOST="${HOST:-0.0.0.0}"
export DATABASE_URL="${DATABASE_URL:-file:/app/data/db/hytalepanel.db}"
export SERVERS_BASE_PATH="${SERVERS_BASE_PATH:-/app/data/servers}"
export BACKUPS_BASE_PATH="${BACKUPS_BASE_PATH:-/app/data/backups}"
export LOGS_PATH="${LOGS_PATH:-/app/data/logs}"
export CERTS_PATH="${CERTS_PATH:-/app/data/certs}"
export HSM_BASE_PATH="/app"

# Generate JWT secrets if not provided
if [ -z "$JWT_SECRET" ]; then
    log_warn "JWT_SECRET not set, generating random secret..."
    log_warn "For persistent sessions across restarts, set JWT_SECRET environment variable"
    export JWT_SECRET=$(generate_secret)
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
    log_warn "JWT_REFRESH_SECRET not set, generating random secret..."
    export JWT_REFRESH_SECRET=$(generate_secret)
fi

if [ -z "$SETTINGS_ENCRYPTION_KEY" ]; then
    log_warn "SETTINGS_ENCRYPTION_KEY not set, generating random key..."
    export SETTINGS_ENCRYPTION_KEY=$(generate_short_secret)
fi

# Sync database schema (using db push for SQLite)
log_info "Syncing database schema..."
cd /app
npx prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss

log_info "Database ready!"

# Start the application
log_info "Starting server on port $PORT..."
exec node /app/dist/index.js
