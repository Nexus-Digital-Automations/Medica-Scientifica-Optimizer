# Port Configuration

## Development Servers

### Frontend (Vite)
- **Port**: `3000`
- **URL**: http://localhost:3000
- **Config**: `vite.config.ts`

### Backend (Express API)
- **Port**: `3001`
- **URL**: http://localhost:3001
- **Config**: `src/server/server.ts`

## Starting Services

```bash
# Start both servers (recommended - run in separate terminals):
npm run dev        # Backend API on port 3001
npm run dev:client # Frontend on port 3000

# Or use the combined command:
npm run dev:all    # Starts both servers
```

## API Proxy Configuration

The frontend uses Vite's proxy to route API requests:
- Frontend requests to `/api/*` → Proxied to `http://localhost:3001/api/*`
- Configured in `vite.config.ts`

## Accessing the Application

1. **Frontend UI**: http://localhost:3000
2. **Backend API**: http://localhost:3001/api
3. **API Health Check**: http://localhost:3001/api/health

## Port History

- ❌ Old ports: Frontend 5173, Backend 3000
- ✅ Current ports: Frontend 3000, Backend 3001
- Changed on: 2025-10-04
