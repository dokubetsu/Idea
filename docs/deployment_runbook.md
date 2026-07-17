# LeAd Platform Production Deployment Runbook

Operational runbook for deploying the **LeAd** platform to production.

---

## 1. Architecture Overview

| Layer | Technology | Hosting |
|-------|------------|---------|
| Database & Auth | Supabase PostgreSQL + Auth + Storage | Supabase Cloud |
| Backend API | FastAPI (Python 3.12) | Render (Docker) |
| Background worker | Outbox / notification worker (`run_worker.py`) | Render background worker (recommended) |
| Frontend | Next.js 15 App Router | Vercel |
| Cache / rate limits | Redis | Upstash / Render Redis / managed Redis |

---

## 2. Database & Migrations

### Apply migrations

Migrations live in `supabase/migrations/` (**001 → 062+**). Always apply in order:

```bash
supabase link --project-ref <your-project-reference>
supabase db push
```

Do **not** run `seed.sql` / `seed_docket.sql` against production (demo users and fixed passwords).

### New environments

```bash
supabase db reset   # local only — applies all migrations + seeds
```

### Verify RLS after deploy

```bash
# Against staging with seed data, or a disposable project:
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
npx tsx scripts/verify-rls.ts
```

Covers docket isolation, privilege-column guards, cross-tenant matters, intake, payments, consultations, and notification RPC lockdown.

---

## 3. Backend (Render)

### Web service

- **Root**: `apps/api`
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health**: `/livez` (liveness), `/readyz` (DB + Redis)
- **Dockerfile HEALTHCHECK**: `/livez`

### Background worker (recommended)

- **Start**: `python run_worker.py` (or process that runs the outbox consumer)
- Same env as API; set `START_OUTBOX_WORKER=false` on the web process if the worker is separate

### Required environment variables

| Variable | Notes |
|----------|--------|
| `APP_ENV` | Must be `production` |
| `SUPABASE_URL` | Production project URL |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | Server only — never expose to browser |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Optional for server-side anon client |
| `SUPABASE_JWT_SECRET` | JWT verification (HS256) |
| `CRON_SECRET` | Strong random (`openssl rand -hex 32`); header `X-Cron-Secret` |
| `PAYMENT_WEBHOOK_SECRET` | Razorpay webhook secret (not a placeholder) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Required in production for payments |
| `REDIS_URL` | Real Redis URL (not `memory://`) |
| `CORS_ORIGINS` | JSON list of frontend origins |
| `APP_URL` | Non-localhost production frontend URL |
| `START_OUTBOX_WORKER` | `true` if worker runs in-process; `false` if separate process |
| `EXPOSE_METRICS` | Leave unset/false unless scraping on a private network |
| `FEATURE_*` | `FEATURE_CONSULTATIONS`, `FEATURE_BILLING`, `FEATURE_HEARINGS`, etc. |
| `SBI_MCLR_RATE` / `SBI_MCLR_AS_OF` | Optional monthly MCLR override for RERA calc |
| `SBI_MCLR_FETCH_URL` | Optional JSON feed `{"rate":9.0,"as_of":"YYYY-MM-DD"}` |
| `GST_SUPPLIER_STATE` / `GST_SUPPLIER_GSTIN` | Platform firm state for IGST/CGST split |
| `EINVOICE_PROVIDER` | `mock` (default) or `nic` |
| `EINVOICE_NIC_*` | Base URL, username, password, GSTIN for NIC IRP |
| `COURT_HOLIDAY_FEED_URL` | Optional JSON holiday feed for state calendars |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Optional AI providers |
| `RESEND_*` / `TWILIO_*` | Notification channels |
| `SENTRY_DSN` | Optional error tracking |

**Important:** In production, process environment variables override any baked-in `.env` file.

### Cron jobs (POST + `X-Cron-Secret`)

| Endpoint | Suggested schedule |
|----------|-------------------|
| `/api/v1/system/cron/hearing-reminders` | Every 15–60 min |
| `/api/v1/system/cron/cleanup-sessions` | Every 6 hours |
| `/api/v1/system/cron/retry-stale-deliveries` | Every 5–15 min |
| `/api/v1/system/cron/weekly-summaries` | Weekly (if `FEATURE_AI_SUMMARIES`) |
| `/api/v1/system/cron/mark-invoices-overdue` | Daily (e.g. `0 1 * * *`) |

---

## 4. Frontend (Vercel)

- **Root**: `apps/web`
- **Framework**: Next.js

### Required env

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon key |
| `NEXT_PUBLIC_API_URL` | **HTTPS** API URL — **required** in production; localhost/`http://` rejected at build/runtime |

Optional: `NEXT_PUBLIC_SENTRY_DSN`

---

## 5. Pre-launch checklist

- [ ] All migrations applied (`supabase db push`); no seed data on prod
- [ ] Email confirmation enabled in Supabase Auth
- [ ] `scripts/verify-rls.ts` green on staging with docket seed
- [ ] CI green: backend (unit + integration + RLS), frontend build, Playwright e2e
- [ ] `APP_ENV=production`, Redis set, webhook skip disabled
- [ ] `/metrics` not public (unless private scrape + `EXPOSE_METRICS=true`)
- [ ] Cron secrets rotated and jobs scheduled
- [ ] Payment keys + webhook secret configured; paid consultation path smoke-tested
- [ ] Outbox worker running (in-process or dedicated)
- [ ] No service role key in frontend env or client bundles

---

## 6. CI overview

GitHub Actions (`.github/workflows/ci.yml`):

1. **backend-test** — black, ruff, mypy, bandit, pip-audit → `supabase start` + **`db reset`** → `verify-rls.ts` → pytest unit + integration  
2. **frontend-build** — npm audit, type-check, lint, production build  
3. **e2e** — full local stack + Playwright (seed users: `client@lead.ai` / `Password123!`)  
4. **deploy** — Render deploy hook on `main` push after all jobs pass  

---

## 7. Incident notes

- **Suspended / DSR users**: profiles `is_active=false` or `dsr_erased_at` set; middleware and API reject access  
- **Payment mismatches**: audited in `audit_logs`; webhooks require valid HMAC  
- **Rate limits**: SlowAPI default 100/min; AI daily limits per user (Redis-backed when configured)  
