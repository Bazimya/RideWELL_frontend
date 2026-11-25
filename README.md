# RideWELL frontend

Mobile-first web app for RideWELL (customers, partners and admins). React 19 + Vite + TypeScript, react-router, i18next.

## Run locally

Start the backend first (see `../RideWELL_Backend/README.md`), then:

```sh
npm install
npm run dev       # http://localhost:5173, /api is proxied to http://localhost:4000
```

The API is served under the same origin (`/api`), in development through the Vite proxy and in production through Caddy, so the `SameSite=Strict` refresh cookie works.

## Text and languages

All UI text is in `src/i18n/locales/en.json`. `rw.json` (Kinyarwanda) and `fr.json` (French) exist and fall back to English for any key not yet translated.

## Security notes

- The access token is kept in memory only; nothing auth-related is stored in `localStorage`.
- Refreshes are single-flight and serialised across tabs (Web Locks), because the API treats reuse of a rotated refresh token as theft.
- Route guards in the UI are for navigation only. Every permission is enforced by the API.
- The admin authenticator QR code is generated in the browser; the secret is never sent to a third-party service.

## End-to-end tests

Real Chrome against the real API and a real MongoDB replica set. Nothing is mocked.

```sh
# needs: Google Chrome, a MongoDB replica set (default mongodb://127.0.0.1:27099/?replicaSet=rs0)
E2E_MONGODB_URI='mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0' npm run test:e2e
```

The tests start their own backend on port 4100 (database `ridewell_e2e`, wiped before each run) and Vite on port 5174.
