# Deployment Guide

This document explains how to deploy the frontend to Vercel and the backend to a production host (Render, Railway, or Docker). It includes required environment variables and quick commands.

**Frontend — Vercel**

- Ensure your repository is pushed to GitHub (or Git provider).
- In Vercel, click **New Project** → Import your repo.
- Set the project root to `frontend` (so Vercel uses `frontend/package.json`).
- Build command: `npm run build` (auto-detected from `package.json`).
- Output directory: `dist` (Vite's default).
- Add environment variable `VITE_API_URL` with your backend URL, e.g. `https://api.example.com`.
  - If you want the frontend to call API paths like `/api/...`, set `VITE_API_URL` to `https://api.example.com` (no trailing `/api` needed unless you prefer).
- Deploy (`Deploy` button). After deployment, Vercel will publish a frontend URL.

Local development:

Create `frontend/.env` with:

```
VITE_API_URL=http://localhost:5000
```

Then run in `frontend`:

```bash
npm install
npm run dev
```

**Backend — Render / Railway (recommended)**

General requirements:
- Use a persistent MongoDB (MongoDB Atlas). Set `MONGO_URI` to the connection string.
- Ensure the host supports WebSockets for Socket.IO (Render and Railway do).

Render setup (example):

1. Create a new Web Service and connect your Git repo.
2. Root directory: project root (the service should run `server/index.js`).
3. Build & Start command: `node server/index.js` (no build step needed for Node app).
4. Environment variables:
   - `MONGO_URI` = `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority`
   - `PORT` = `5000` (optional)
   - `NODE_ENV` = `production`
5. Deploy — Render will build and run the server.

Railway setup (example):

1. Create a new project and connect GitHub repository.
2. Add a service with the Dockerfile or use the Node template and point to `server/index.js` as the start command.
3. Add environment variables as above.

**Backend — Docker (optional)**

If you prefer to deploy with Docker (DigitalOcean App Platform, AWS ECS, or your own server), a simple Dockerfile is provided in `server/Dockerfile`.

Build and run locally:

```bash
docker build -t smart-campus-server -f server/Dockerfile .
docker run -e MONGO_URI="<your_mongo_uri>" -p 5000:5000 smart-campus-server
```

**Socket.IO notes**
- The frontend connects to the server via Socket.IO. Ensure the backend public URL supports WebSocket upgrades.
- If your backend is behind a proxy, forward WebSocket connections.

**Environment variables summary**
- `VITE_API_URL` (Vercel frontend) — example: `https://api.example.com`
- `MONGO_URI` (backend) — MongoDB Atlas connection string
- `PORT` (optional) — default `5000`

If you want, I can:
- Provide a Render or Railway specific `service.yaml` example.
- Walk through a live Vercel deployment from this machine (I can run `vercel` commands if you want).
