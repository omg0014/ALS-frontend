# ACLS website: Automatic Classroom Lighting System

The website for switching classroom lights and fans, setting up ESP32 / NodeMCU relay boards and uploading their firmware.
React 19 + Vite. The server is in [ALS-backend](https://github.com/omg0014/ALS-backend).

## Deploy to Vercel

1. **Add New → Project** → import this repo. The framework (Vite), build command and `dist` folder come from `vercel.json`.
2. In **`vercel.json`**, set the `/api` rewrite to your backend's address:
   ```json
   { "source": "/api/:path*", "destination": "https://YOUR-BACKEND.onrender.com/api/:path*" }
   ```
   Vercel forwards every `/api` call to the backend. The login cookie then belongs to the website's own address and works in every browser, Safari included.
3. **Settings → Environment Variables:** add `VITE_BACKEND_URL` = `https://YOUR-BACKEND.onrender.com`.
   Live updates connect straight to the backend with a short-lived token. Redeploy after changing it.
4. On the backend (Render), set `CORS_ORIGIN` to this website's address, e.g. `https://als-frontend.vercel.app`.

Log in with `admin` and the `ADMIN_PASSWORD` set on the backend, then create accounts for others under **Users**.
Anyone with an account can use the site from anywhere.

**USB upload from the browser** works in Chrome or Edge on any PC, because the site is served over HTTPS.
It needs a backend that can build firmware; on Render's free plan use **Download for Arduino IDE** instead.

## Run it locally

```
npm install
npm run dev      # http://localhost:5173, talks to the backend on :4000
npm run build    # production files in dist/
npm run lint
```

## Folders

```
src/
  pages/        one folder per section (dashboard, control, rooms, devices, firmware wizard, code editor, help, admin)
  components/   shared UI (ui/), layout, firmware upload (USB / code preview), wiring diagram
  context/      login and live data (Socket.IO)
  lib/          USB flasher (esptool-js), labels, formatting
  styles/       design tokens and CSS
```
