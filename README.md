# LeAd Platform

> Legal workflow platform for India. Making legal processes visible and accessible.

## Merged from
- **lead-crm** — first CRM implementation, Supabase auth, basic case management
- **lead-platform** — production architecture, Facts Engine, Events system, domain-driven design

The platform architecture wins. The CRM data migrates forward.

---

## Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 15 · TypeScript · Tailwind v4 · **TanStack Query** · **React Hook Form** · **Zod** |
| Backend | Python 3.12 · FastAPI · Pydantic v2 · domain-driven structure |
| Auth | Supabase Auth (JWT, SSR cookies) |
| Database | Supabase PostgreSQL + Row Level Security |
| AI | Claude (primary) · Gemini (alternative) · Mock (offline, zero cost) |

---

## Quick start

### Local Development Setup (Using Supabase CLI)

The project uses the Supabase CLI for database migration and local stack management.

```bash
# 1. Initialize and start local Supabase stack (requires Docker)
supabase start

# 2. Configure Environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# Fill in SUPABASE_URL, keys, JWT secret. Optionally add ANTHROPIC_API_KEY.

# 3. Apply/Reset migrations on the database
supabase db reset

# 4. Start local development servers
# Backend
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd apps/web
npm install
npm run dev
```

### Production Deploys & Migration Management
- **Create a new migration**: `supabase migration new create_some_feature`
- **Push migrations to remote database**: `supabase db push`

---

## Intake workflow (the key flow)
```
User describes situation
        ↓
POST /api/v1/intake/start
        ↓
Facts Engine → structured key/value facts extracted
        ↓
User reviews + corrects facts (PATCH /intake/:id/facts)
        ↓
POST /api/v1/intake/:id/assess
        ↓
Assessment (Claude/Gemini/Mock) runs on facts — not raw text
Returns: risk · success % · timeline · budget · statutes · immediate actions
        ↓
POST /api/v1/intake/:id/commit
        ↓
Matter created · facts persisted · assessment posted as timeline entry · events emitted
```

---

## Backend domain structure
```
apps/api/app/
├── domains/
│   ├── identity/     ← auth, profile creation
│   ├── intake/       ← 4-step intake workflow + Facts Engine
│   ├── matters/      ← matter lifecycle, facts CRUD, updates, events
│   ├── assessment/   ← pluggable AI provider (claude/gemini/mock)
│   ├── matching/     ← lawyer discovery + contact requests
│   └── admin/        ← platform stats, verify lawyers, manage users
└── shared/
    ├── events.py     ← event bus (every state change → events table)
    ├── dependencies.py ← JWT auth + role guards
    └── database.py   ← Supabase service-role client
```

## Frontend feature structure
```
apps/web/src/
├── features/
│   ├── intake/       ← IntakeWizard (5 steps: describe→facts→assess→confirm→done)
│   ├── matters/      ← matter list, FactsPanel, timeline hooks
│   └── matching/     ← lawyer discovery hooks
├── shared/
│   ├── components/
│   │   ├── ui/       ← Button, Badge, Card, Input, Spinner, EmptyState, etc.
│   │   └── layout/   ← Sidebar (role-aware)
│   └── lib/
│       ├── supabase/ ← browser + server clients
│       └── api/      ← typed fetch client
└── entities/
    └── types.ts      ← all domain types matching backend schemas
```

---

## Feature Flags

The application uses feature flags to manage stage rollouts and hide incomplete features. They can be set in `.env` or system environment variables:

| Environment Variable | Description | Default |
|---|---|---|
| `FEATURE_CONSULTATIONS` | Enable lawyer search & consultations booking | `true` |
| `FEATURE_BILLING` | Enable milestone billing functionality | `false` |
| `FEATURE_HEARINGS` | Enable court hearing scheduling | `false` |
| `FEATURE_MILESTONES` | Enable case progress milestone tracking | `false` |
| `FEATURE_AI_SUMMARIES` | Enable weekly AI client summaries | `false` |

---

## AI providers
| Key set | Provider used |
|---|---|
| `ANTHROPIC_API_KEY` | Claude claude-sonnet-4 |
| `GEMINI_API_KEY` | Gemini 2.0 Flash |
| Neither | Mock (deterministic, free, offline) |

The mock covers: cheque_bounce, consumer, rera with full template data.
The platform is fully functional without any AI API key.

---

## API reference
| Domain | Prefix | Key endpoints |
|---|---|---|
| Identity | `/api/v1/identity` | `POST /profile` · `GET /me` · `PATCH /me` |
| Intake | `/api/v1/intake` | `POST /start` · `PATCH /:id/facts` · `POST /:id/assess` · `POST /:id/commit` |
| Matters | `/api/v1/matters` | CRUD · `/facts` · `PATCH /facts/:id` (verify) · `/updates` · `/events` · `/assign` |
| Assessment | `/api/v1/assessment` | `GET /provider` · `POST /run` |
| Matching | `/api/v1/matching` | `GET /lawyers` · `POST /lawyers/:id/contact` · `GET /requests/incoming` · `PATCH /requests/:id` |
| Admin | `/api/v1/admin` | `GET /stats` · `/lawyers/pending` · verify/suspend |

API docs (dev only): http://localhost:8000/docs

---

## Authorization & Security Architecture

The platform uses a two-tier authorization scheme:

1. **FastAPI Application Layer (Primary/Authoritative)**:
   - **DB-Authoritative Roles**: User authorization is determined by the `role` column in the database `profiles` table. The JWT token is treated **only as identity proof**.
   - Immediate role updates: When an administrator changes a user's role in the DB, it takes effect immediately on the next API call (via the `get_current_user` dependency retrieving the fresh database profile), avoiding stale JWT permissions.
   - **Service Role Bypass**: The backend uses the Supabase service role client to bypass DB Row Level Security (RLS) for server-side orchestrations. **The service role key is never exposed to the frontend**.

2. **Database Row Level Security (RLS) (Secondary / Defense-in-Depth)**:
   - RLS acts as a second line of defense. The frontend uses the Supabase client directly with `anon` public key to fetch basic read-only data, restricted by strict RLS policies bound to `auth.uid()`.

