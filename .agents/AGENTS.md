# LeAd Platform Developer & Agent Guide

Welcome to the **LeAd** codebase (formerly Nyay). This document serves as a repository map and technical guide for developers and agentic assistants working on this workspace.

---

## 1. Project Overview & Branding
LeAd is an AI-powered legal workflow platform for India. It translates plain-language citizen complaints into structured facts, automated notices/complaints (like cheque bounces or builder delayed possession), tracks deadlines, and matches cases with advocates.

### Branding Standard
- **App Name**: `LeAd` (cased precisely as `LeAd` for the logo, or `lead` / `lead-web` / `lead-api` for packages/config).
- **Domains & Emails**: Use `lead.ai` or `@lead.ai`.
- **References**: Avoid using the old brand name `Nyay` or `Nyay Platform` in user-facing strings, code comments, or documentation.

---

## 2. Directory Structure

```
./
├── apps/
│   ├── api/                  # FastAPI Python backend (Domain-Driven Design)
│   │   ├── app/
│   │   │   ├── domains/      # Business logic domains
│   │   │   │   ├── identity/     # Auth profiles
│   │   │   │   ├── intake/       # Intake session management & Facts Engine
│   │   │   │   ├── matters/      # Matter/case lifecycle
│   │   │   │   ├── assessment/   # AI routing (Gemini, Claude, Mock)
│   │   │   │   ├── matching/     # Advocate discovery & matching
│   │   │   │   └── admin/        # Platform diagnostics & lawyer verification
│   │   │   └── shared/       # Global utilities (database, events, JWT, middleware)
│   │   └── requirements.txt
│   └── web/                  # Next.js 15 TypeScript frontend
│       ├── src/
│       │   ├── app/          # App router pages (landing page is page.tsx)
│       │   ├── features/     # Feature-scoped logic (intake, matching, matters)
│       │   ├── shared/       # Reusable components (ui, layout) and lib clients
│       │   └── entities/     # Domain models and shared types
│       └── package.json
└── supabase/                 # PostgreSQL migrations and schema definitions
    └── migrations/           # 001_schema.sql to 021_missing_infrastructure.sql

```

---

## 3. Core Technical Workflows

### A. Intake to Case Creation Flow
1. **User Description**: User enters case text or speech.
2. **Start Intake (`POST /api/v1/intake/start`)**: AI Facts Engine parses and outputs key/value facts.
3. **Refine Facts (`PATCH /api/v1/intake/:id/facts`)**: User corrects/approves facts.
4. **Run Assessment (`POST /api/v1/intake/:id/assess`)**: AI reads structured facts (not raw text) and estimates success odds, timeline, court fees, and drafts.
5. **Commit Intake (`POST /api/v1/intake/:id/commit`)**: Matter, client, and lawyer records are created.

### B. Pluggable AI Registry
AI requests are routed dynamically based on environment keys:
- `ANTHROPIC_API_KEY` present → Anthropic Claude
- `GEMINI_API_KEY` present → Google Gemini 2.0 Flash
- Neither key present → Local Mock Provider (free, offline, supports common scenarios like Cheque Bounce and RERA)

---

## 4. Brand Search-and-Replace Mapping

When working in the codebase, use this mapping to keep branding consistent:
- `Nyay Platform` / `Nyay` → `LeAd`
- `nyay.ai` → `lead.ai`
- `nyay-web` → `lead-web`
- `nyay-api` → `lead-api`
- `Nyay Update` → `LeAd Update`
- `client@nyay.ai` → `client@lead.ai`

---

## 5. Pre-Commit & Quality Checklist

Always remember to run and verify the following code quality checks before pushing changes to GitHub:
- **Code Style (Black)**: Run `black --check apps/api/app apps/api/tests` (and reformat if necessary) to ensure proper styling.
- **Linting (Ruff)**: Run `ruff check apps/api/app` to catch and correct static issues.
- **Type Checking (Mypy)**: Run `mypy --ignore-missing-imports apps/api/app` to ensure clean static typing.
- **SQL File Encodings**: Ensure all PostgreSQL migration files in `supabase/migrations/` use standard UTF-8 text encoding.
