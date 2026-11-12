# FuelWise - Smart Fuel Intelligence (version 1.1: with login)

Track. Calculate. Compare. Save. A full-stack app to track petrol and electric vehicle running costs,
calculate fuel/electricity needs, compare EV vs petrol cost, keep trip history, see (demo) charging
stations and ask an AI assistant. Version 1.1 adds **sign up, login, Google sign-in, password reset,
guest access and an admin area**.

**Stack:** React + Vite + Tailwind + Recharts + Leaflet (frontend) · FastAPI + SQLAlchemy + SQLite (backend)
· Argon2 password hashing · scikit-learn · Gemini API (optional).

```
FuelWise/
├── frontend/            React app (src/components, pages, services, charts, App.jsx)
├── backend/             FastAPI app (main.py, routes, calculations, ai_engine, database, models)
├── database/fuelwise.db SQLite file (created/upgraded automatically)
├── requirements.txt
└── README.md
```

## 1. Run it on Windows (two terminals)

You need **Python 3.10+** and **Node.js 18+**.

**Terminal 1 - backend** (run from the `FuelWise` folder):

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy backend\.env.example backend\.env
uvicorn backend.main:app --reload
```

**Terminal 2 - frontend:**

```
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open **http://localhost:5173** (type `localhost`, not `127.0.0.1`, so the login cookie is sent to the API).
API docs: http://localhost:8000/docs

### Upgrading from version 1.0
1. Copy your existing `database\fuelwise.db` somewhere safe first.
2. Replace the project files with this version, **but keep your own `database\fuelwise.db`** (the one in this ZIP is empty).
3. Run the backend as above. The database is upgraded automatically: new columns and tables are added, nothing is deleted.
4. Trips and vehicles you saved in 1.0 belong to a hidden "local" account. After you create your own account, move them to it:
   `python -m backend.database.manage adopt-legacy --email you@example.com`

## 2. Using the login system

- **Sign up:** http://localhost:5173/signup - full name, email, password (8+ characters with a letter and a number),
  confirmation, optional phone, and the terms checkbox. After signing up you are taken to the vehicle setup tab.
- **Sign in:** http://localhost:5173/login. "Remember me" keeps you signed in for 30 days; otherwise the session ends
  when you close the browser (or after 24 hours).
- **Sign out:** profile menu (top right) → Sign out.
- **Forgot password:** link on the login page (see section 4).
- **Continue as Guest:** explore without an account (see section 5).

## 3. Google sign-in (optional)

Email/password login works without any of this. Google buttons show a clear "not set up" message until you configure it.
FuelWise does **not** fake Google logins: it uses the real OAuth 2.0 flow on the backend, and the client secret never
reaches the browser.

1. Go to https://console.cloud.google.com/ and create a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, and add your own
   Google address under *Test users* (while the app is in "Testing" mode only listed test users can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized redirect URIs** add exactly: `http://localhost:8000/api/auth/google/callback`
5. Copy the *Client ID* and *Client secret* into `backend\.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   ```
6. Restart the backend. Check http://localhost:8000/api/health - it should show `"google_configured": true`.

Behaviour: a new Google user gets a normal "user" account. If a password account with the same email already exists,
Google sign-in is refused with a clear message (so nobody can take over an account) - sign in with your password instead.
Cancelled or failed attempts return you to the login page with an explanation.

## 4. Password-reset email

How it works: "Send Reset Link" creates a random single-use token that expires after 30 minutes (only a hash is stored),
and e-mails a link to `/reset-password?token=...`. The page always says "If an account exists..." so nobody can discover
which emails are registered, and the token is never returned by the API. Resetting a password signs the user out everywhere.

**Real e-mail** - add SMTP details to `backend\.env` (example for Gmail with an *App Password*):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SMTP_FROM=you@gmail.com
```
**No e-mail account? Development-only workflow:** set `DEV_PRINT_RESET_LINKS=true` in `backend\.env`, restart the backend,
request a reset, and copy the link printed in the **backend terminal**. Never use this setting on a public server.
With neither configured, nothing is sent (a warning is logged).

## 5. Guests, users and admins

| | Guest | User | Admin |
|---|:-:|:-:|:-:|
| Home, calculators (petrol/EV), EV vs petrol comparison | ✅ | ✅ | ✅ |
| Dashboard | demo data only | own data | own data |
| Maps (demo stations) | ✅ | ✅ | ✅ |
| Save trips / vehicles, trip history | ❌ | ✅ | ✅ |
| Settings and profile, AI assistant and its history | ❌ | ✅ | ✅ |
| Admin area (user statistics, activity, configuration) | ❌ | ❌ | ✅ |

A guest is simply someone with **no session**. The browser's "guest mode" is only a screen choice - **the backend checks
every request**: private endpoints return 401 without a valid session, admin endpoints return 403 for non-admins, and every
query is filtered by the signed-in user's id, so one user can never read or change another user's trips or vehicles.
Guests who try to save see: *"Create a free FuelWise account to save your trips and vehicle information."*

### Creating the first admin
Nobody can become admin through the website. Choose **one** way:

- **Command line (recommended):**
  `python -m backend.database.manage create-admin --email you@example.com --name "Your Name"` (asks for a password).
  To promote an existing account: `python -m backend.database.manage promote --email you@example.com`.
- **Environment bootstrap:** put `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend\.env`, start the backend once, then
  **delete `ADMIN_PASSWORD` from the file**. It only creates the account if that email does not exist yet.

Admins can see user counts and activity, disable/enable accounts (this signs the user out), and open or close public
registration. They cannot see other people's trips.

## 6. Authentication architecture (plain English)

- **Sessions:** logging in creates a random token. The browser keeps it in an **httpOnly cookie** (JavaScript cannot read
  it); the database stores only its SHA-256 hash in `auth_sessions`. Logout revokes it on the server.
- **Passwords:** hashed with **Argon2** (`argon2-cffi`). Version 1.0 accounts used PBKDF2; they still work and are upgraded
  to Argon2 at their next login. Passwords are never stored or logged in plain text.
- **Brute-force protection:** 5 wrong passwords for one email → 15 minutes lock (HTTP 429). Login timing does not reveal
  whether an email exists.
- **CORS/cookies:** only the origins in `CORS_ORIGINS` may call the API with credentials. Cookie is `HttpOnly`,
  `SameSite=Lax`, and `Secure` when `COOKIE_SECURE=true`.
- **Validation:** all input is validated with Pydantic on the server (the forms also validate for quick feedback).

### Database changes (version 1.1)
- `users` gains: `phone`, `role` (`user`/`admin`), `auth_provider` (`local`/`google`), `account_status`
  (`active`/`disabled`), `last_login_at` (added automatically to existing databases; existing rows get safe defaults).
- New tables: `auth_sessions`, `password_reset_tokens`, `oauth_accounts`, `activity_log`, `app_config`.
- Nothing is dropped or rewritten: existing trips, vehicles and settings are kept.

## 7. Environment variables (`backend\.env`, see `backend\.env.example`)

| Variable | Purpose |
|---|---|
| `FRONTEND_URL`, `CORS_ORIGINS` | Where the website runs (default `http://localhost:5173`). |
| `COOKIE_SECURE` | `true` when served over HTTPS. |
| `SESSION_TTL_HOURS`, `REMEMBER_TTL_DAYS` | Session lengths (24 h / 30 days). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Optional first-admin bootstrap. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google sign-in. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` | Password-reset e-mail. |
| `RESET_TOKEN_MINUTES`, `DEV_PRINT_RESET_LINKS` | Reset link lifetime; development-only console links. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI assistant (needs an account to use). |

Frontend (`frontend\.env`): `VITE_API_BASE_URL` (default `http://localhost:8000/api`) and optional map settings.

## 8. API endpoints

Public: `GET /api/health` · `POST /api/calculate/petrol` · `POST /api/calculate/electric` · `POST /api/compare` ·
`GET /api/maps/charging-stations` · `GET /api/demo/dashboard`

Auth: `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` ·
`POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · `GET /api/auth/google` · `GET /api/auth/google/callback`

Signed-in users: `GET /api/dashboard` · `GET/POST /api/trips` · `GET /api/trips/{id}` · `GET/POST /api/vehicles` ·
`PUT /api/vehicles/{id}` · `POST /api/ai/chat` · `POST /api/ai/predict` · `GET/PUT /api/settings`

Admins: `GET /api/admin/stats` · `GET /api/admin/users` · `PATCH /api/admin/users/{id}` · `GET /api/admin/activity` ·
`GET/PUT /api/admin/config`

Postman users: log in once and Postman keeps the session cookie automatically.

## 9. Other helpers

- Demo data for one account: `python -m backend.database.seed_demo --email you@example.com` (remove with `--clear`).
- Tests: `python -m pytest backend` and `cd frontend && npm test`.

## 10. Known limitations

- Email addresses are **not verified** at sign-up (no "confirm your email" step).
- Lockout is per email address, so someone could deliberately lock a victim out for 15 minutes.
- Calculations, charging stations (demo locations), dark theme and notifications are unchanged from 1.0 limitations:
  stations are demo data, only the light theme is styled, and notification settings are stored preferences only.
- The Terms/Privacy text on the signup page is a template - replace it with your own before public use.
- For a public server: use HTTPS, set `COOKIE_SECURE=true`, and add proper rate limiting at the web-server level.
