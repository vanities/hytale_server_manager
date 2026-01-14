# Hytale Server Manager

A web-based management dashboard for Hytale game servers. Built with React, TypeScript, and Node.js.

## Features

- **Server Management** - Control multiple servers with real-time metrics and live console
- **Mod Manager** - Browse and install mods from Modtale with dependency resolution
- **Modpack System** - One-click installation of pre-configured mod collections
- **Backup Management** - Automated scheduling with restore capabilities
- **Role-Based Access** - Fine-grained permissions for admin, moderator, and viewer roles

## Project Structure

```
├── frontend/    # React frontend application
├── server/      # Node.js backend API
├── website/     # Documentation website (Astro)
└── scripts/     # Installation and deployment scripts
```

## Tech Stack

**Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, Vite
**Backend:** Node.js, Express, Prisma, SQLite, Socket.IO

## Quick Start

```bash
# Clone the repository
git clone https://github.com/nebula-codes/hytale_server_manager.git
cd hytale_server_manager

# Setup frontend
cd frontend
cp .env.example .env
npm install

# Setup backend
cd ../server
cp .env.example .env
# Edit .env with required values (JWT_SECRET, JWT_REFRESH_SECRET, SETTINGS_ENCRYPTION_KEY)
npm install
npx prisma migrate dev

# Run development servers (from respective directories)
# Terminal 1 - Frontend (port 5173)
cd frontend && npm run dev

# Terminal 2 - Backend (port 3001)
cd server && npm run dev
```

## Docker

**Build locally:**
```bash
docker build -t hytale-server-manager .
```

**Run:**
```bash
docker run -d \
  -p 3001:3001 \
  -v hytale-data:/app/data \
  --name hytale-server-manager \
  hytale-server-manager
```

**From GitHub Container Registry:**
```bash
docker run -d \
  -p 3001:3001 \
  -v hytale-data:/app/data \
  --name hytale-server-manager \
  ghcr.io/vanities/hytale_server_manager:latest
```

**Access:** https://localhost:3001

**First run:** Check logs for admin password:
```bash
docker logs hytale-server-manager | grep Password
```

**Unraid:** Use the template at `unraid/hytale-server-manager.xml`

### Docker Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Web UI port |
| `JWT_SECRET` | auto-generated | Auth secret (set for persistent sessions) |
| `JWT_REFRESH_SECRET` | auto-generated | Refresh token secret |
| `SETTINGS_ENCRYPTION_KEY` | auto-generated | Encryption key |
| `LOG_LEVEL` | info | debug/info/warn/error |
| `RATE_LIMIT_MAX` | 10000 | Max API requests per 15 min |

## Configuration

The server requires these environment variables in `server/.env`:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for JWT tokens (required) |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens (required) |
| `SETTINGS_ENCRYPTION_KEY` | 32-character key for encrypting sensitive settings (required) |
| `DATABASE_URL` | SQLite database path (default: `file:./data/hytalepanel.db`) |

See `frontend/.env.example` and `server/.env.example` for all available options.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

This is an unofficial fan project and is not affiliated with Hytale or Hypixel Studios.
