# LeAd Platform Production Deployment Runbook

This document serves as the standard operational runbook for deploying the **LeAd** platform to production environments.

---

## 1. Architecture Overview
The platform consists of three main hosting environments:
1. **Database & Auth (Supabase)**: Relational PostgreSQL database, auth endpoints, file storage, and real-time event sockets.
2. **Backend API (FastAPI / Python)**: FastAPI endpoints hosted in Docker/Linux containers on **Render**.
3. **Frontend App (Next.js / TypeScript)**: Server-side rendered (SSR) App Router application hosted on **Vercel**.

---

## 2. Supabase Database & Migrations Setup
Before deploying backend or frontend services, set up your production database.

### Step A: Initialize the Database
1. Provision a new project on the **Supabase Dashboard**.
2. Retrieve your project connection parameters under **Project Settings -> Database**.

### Step B: Apply Migrations
Locally, authenticate your Supabase CLI and apply all migrations (001 through 021):
```bash
# Link local repository to the remote production project
supabase link --project-ref <your-project-reference>

# Push all migrations to remote production database
supabase db push
```

---

## 3. Backend Deployment (Render)
FastAPI runs inside an active Linux container on Render to handle persistent background processing and SSE stream ticket lifecycles.

### Step A: Configure a Web Service
- **Runtime**: `Python 3`
- **Root Directory**: `apps/api`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Step B: Required Environment Variables
Configure these under the **Environment** tab on Render:
- `SUPABASE_URL`: Production Supabase API URL (`https://<ref>.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Production service role key (enables secure, server-side system processes)
- `SUPABASE_JWT_SECRET`: Production JWT secret for verifying incoming user tokens
- `CRON_SECRET`: Cryptographically strong random token (e.g., generated with `openssl rand -hex 32`) to secure system cron endpoints
- `APP_ENV`: Set to `production`
- `CORS_ORIGINS`: JSON array representing your Vercel domains, e.g., `["https://lead.ai", "https://lead-web.vercel.app"]`
- `APP_URL`: Your production frontend URL (e.g., `https://lead.ai` or your custom domain)
- `GEMINI_API_KEY`: API key for Google Gemini model processing
- `ANTHROPIC_API_KEY`: (Optional) API key for Anthropic models
- `RESEND_API_KEY`: Production API key for Resend email delivery
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`: Twilio parameters for SMS notifications

---

## 4. Frontend Deployment (Vercel)
Next.js hosts server-rendered pages and assets on Vercel.

### Step A: Configure Project Settings
- **Framework Preset**: `Next.js`
- **Root Directory**: `apps/web`

### Step B: Required Environment Variables
Configure in Vercel settings:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key
- `NEXT_PUBLIC_API_URL`: Your live Render API URL (e.g., `https://lead-api.onrender.com`)

---

## 5. Persistent Background Cron Setup
To trigger hearing reminders and other automated system checks, set up a secure cron job:
- **Target URL**: `https://<your-render-backend-url>/api/v1/system/cron/hearing-reminders`
- **Schedule**: Run every 15 minutes (`*/15 * * * *`) or once daily depending on business needs.
- **HTTP Method**: `POST`
- **Required Header**: `X-Cron-Secret: <your-configured-CRON_SECRET>`

This cron can be provisioned using Render Cron Jobs, GitHub Actions schedules, or standard Uptime Robot / EasyCron triggers.

---

## 6. Pre-Launch Security & Verification Checklist
- [ ] Enforce email confirmation for signups under **Supabase -> Authentication -> Provider Settings -> Email**.
- [ ] Confirm RLS is enabled on all critical tables (`profiles`, `matters`, `documents`, `consultations`).
- [ ] Verify that storage bucket policies strictly scope write operations in `matter_documents` to authorized users only.
- [ ] Verify that no API credentials, secrets, or JWT signing keys are committed in source code.
