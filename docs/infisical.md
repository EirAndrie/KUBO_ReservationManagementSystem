# Managing Secrets with Infisical

The team keeps shared configuration (ports, CORS origin, JWT settings, API base
path) in an Infisical project instead of passing `.env` files around. Machine-specific
values (the database connection) stay in each developer's local `backend/.env`.

## What lives where

| Source | Variables | Why |
| --- | --- | --- |
| Infisical (`dev` environment) | `PORT`, `NODE_ENV`, `API_BASE_PATH`, `FR_ORIGIN`, `PASSWORD_LENGTH`, `SERVE_FRONTEND`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `VITE_API_BASE_URL` | Same for everyone. Change once, everyone gets it. |
| `backend/.env` (local, gitignored) | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Differs per machine (each of us has our own PostgreSQL). Deliberately **not** in Infisical. |

Infisical injects its secrets as real environment variables before the app starts.
`dotenv` never overwrites a variable that is already set, so Infisical values win
if the same key also appears in `backend/.env`. Keep only the `DB_*` lines in your
local `.env` to avoid stale duplicates (for example an old `FR_ORIGIN`).

The Infisical project ID is stored in `backend/.infisical.yaml` and
`frontend/.infisical.yaml`. It is an identifier, not a secret, so both files are
committed. Each app needs its own file because `infisical run` reads the config
from the current directory.

## One-time setup

1. Ask a project admin to invite you to the **DBMS** project in Infisical
   (`app.infisical.com`).
2. Install the CLI and log in:

   ```bash
   npm install -g @infisical/cli
   infisical login
   ```

3. Create `backend/.env` with **only** your local database settings (see
   `backend/example.env` for the full list of keys):

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=<your-password>
   DB_NAME=<your-database>
   ```

4. Confirm the link works. This prints only the count, not the values:

   ```bash
   cd backend
   infisical run --env=dev -- node -e "console.log(Object.keys(process.env).includes('JWT_SECRET'))"
   ```

   You should see `Injecting 9 Infisical secrets into your application process`
   and `true`.

## Running the apps

Run each command from its own folder.

```bash
# Backend (API on PORT, default 8080)
cd backend
infisical run --env=dev -- npm run dev

# Frontend (Vite on http://localhost:3000)
cd frontend
infisical run --env=dev -- npm run dev
```

Typecheck and build do not need secrets and run as usual (`npm run typecheck`,
`npm run build`).

## Adding or changing a secret

1. Open the DBMS project in Infisical, choose the `dev` environment, and edit the
   secret there.
2. Restart the dev server. Secrets are read once at startup.
3. If you add a **new key**, also add it (with an empty or example value) to
   `backend/example.env` or `frontend/.env.example` so the key is documented, and
   tell the team.

Never paste secret values into chat, issues, PRs, or commits. Do not run
`infisical secrets` or `infisical export` in a shared terminal or log; they print
values.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Please either run infisical init to connect to a project or pass in project id` | You are in a folder without `.infisical.yaml`. Run from `backend/` or `frontend/`. |
| `Permission denied` or no output on Windows with Git Bash | The npm shim `bin/infisical` can be an empty file. Use PowerShell or CMD (`infisical.ps1` / `.cmd`), or call `infisical.exe` from `%APPDATA%\npm\node_modules\@infisical\cli\bin`. |
| `You are not logged in` / 401 | Run `infisical login` again. |
| Backend fails with a database connection error | `backend/.env` is missing or its `DB_*` values are wrong. Infisical does not provide them. |
| Browser shows a CORS error | The backend that answers on `PORT` was started without Infisical (so `FR_ORIGIN` came from an old `.env`) or is an old process still holding the port. Stop it and restart with `infisical run`. `FR_ORIGIN` must equal the frontend origin, `http://localhost:3000`. |
| `EADDRINUSE` on 8080 or 3000 | Another dev server is still running. Stop it first. |
| Frontend calls the wrong URL | `VITE_API_BASE_URL` must be `http://localhost:<PORT><API_BASE_PATH>`. Restart Vite after changing it. |
| A secret change has no effect | Restart the process; values are injected at startup only. |

## Production

Production secrets are not set up through this guide. Hosting providers (for
example Vercel for the frontend) have their own environment variable settings; use
the `prod` environment in Infisical only after agreeing on it with the team.
