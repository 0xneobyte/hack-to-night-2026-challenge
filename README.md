# Nova Bank

> **Hack to Night 2026** - Team Nova (Neo · Gimhani · Zenith · Ruwithma)

A full-stack digital banking web app built for the Hack to Night 2026 challenge. The task was to audit a buggy banking system, fix 29 identified bugs across security, logic, and functionality, then extend it with new features.

---

## What We Built

- Replaced a broken, insecure backend with **Supabase** (Auth + PostgreSQL + RLS)
- Fixed all critical security bugs: SQL injection, plaintext passwords, forgeable sessions, credential leaks
- Wired up a fully disconnected frontend to real APIs
- Added new features: Smart Spend analytics, QR Pay, Utility Bill Predictor, E-Statement PDF export, Realtime balance updates

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth & Database | Supabase (PostgreSQL + RLS + Auth) |
| AI | NVIDIA NIM API (Smart Spend, Utility Predictor) |
| Charts | Recharts |
| PDF Export | jsPDF |
| QR | qrcode + qr-scanner |
| Containerisation | Docker + Docker Compose |

---

## Features

- **Authentication** - Login, Sign Up, Reset Password (Supabase Auth, JWT sessions)
- **Dashboard** - Real-time account balances and recent transactions
- **Bank Transfer** - Atomic transfers with PIN confirmation and balance validation
- **Pay Bills** - Utility and service bill payments
- **QR Pay** - Generate and scan QR codes for payments
- **Bank Accounts** - View and manage linked accounts
- **Transaction History** - Filterable transaction list
- **E-Statement** - Download account statement as PDF
- **Smart Spend** - AI-powered spending breakdown and monthly trends
- **Utility Predictor** - AI forecast of upcoming utility bills
- **Settings** - Profile management, dark mode

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with [WSL2 backend](https://docs.docker.com/desktop/features/wsl) on Windows)
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

```bash
git clone https://github.com/fossnsbm/hack-to-night-2026-challenge.git
cd hack-to-night-2026-challenge
cp .env.example .env.local
```

Fill in `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

NVIDIA_API_KEY=your_nvidia_nim_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=openai/gpt-oss-120b
```

> Get your Supabase keys from **Project Settings → API** in the Supabase dashboard.  
> Get a free NVIDIA NIM API key at [build.nvidia.com](https://build.nvidia.com).

### Database Setup

Run the migrations in the Supabase SQL editor (or via the Supabase CLI):

```bash
# Apply all migrations in order
supabase/migrations/
```

The migrations create:
- `profiles` - user profiles linked to Supabase Auth
- `accounts` - bank accounts with balance constraints
- `transactions` - immutable transaction records
- `audit_logs` - transfer audit trail
- `perform_transfer()` - atomic transfer RPC function with balance checks

### Run

```bash
docker compose up --build --watch
```

App runs at `http://localhost:3000`.

---

## Project Structure

```
app/
├── (accounts)/          # Auth pages (login, sign-up, reset-password)
├── api/                 # API routes
│   ├── transfer/        # Atomic bank transfer
│   ├── accounts/        # Account listing
│   ├── transactions/    # Transaction history
│   ├── payment-requests/# QR payment requests
│   ├── splits/          # Bill splitting
│   ├── insights/        # AI spending insights
│   └── utility-predictor/ # AI bill forecast
├── dashboard/
├── bank-transfer/
├── pay-bills/
├── qr-pay/
├── bank-accounts/
├── transactions/
├── e-statement/
├── smart-spend/
├── utility-predictor/
└── settings/

lib/
├── supabase/            # Supabase client (browser + server)
├── ai/                  # AI helper utilities
├── validation.ts        # Zod schemas
├── types.ts             # Shared TypeScript types
└── generate-statement-pdf.ts

supabase/
└── migrations/          # SQL migration files

middleware.ts            # JWT-based route protection
```

---

## Security

The original system had 10 critical security vulnerabilities. All are resolved:

| Bug | Fix |
|---|---|
| SQL injection in every route | Supabase JS client uses parameterized queries |
| Plaintext passwords | Supabase Auth (bcrypt) |
| Forgeable session cookies | Signed JWTs via `@supabase/ssr` |
| PINs exposed via API param | RLS + `pin_hash` never returned in queries |
| No ownership check on transfers | RLS enforces `auth.uid() = user_id` |
| Hardcoded DB credentials | Env vars only |
| Admin endpoint leaking `process.env` | Endpoint deleted, use Supabase Dashboard |
| Error responses leaking connection strings | Generic error handler, internal details server-logged only |

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system diagram, database schema, auth flow, and transfer transaction flowchart.

---

## Team

| Member | Role |
|---|---|
| **Neo** | Supabase setup, schema, RLS, middleware, transfer RPC |
| **Gimhani** | API routes rewrite, transfer logic |
| **Zenith** | Frontend auth flow, dashboard wiring |
| **Ruwithma** | Feature pages, UI fixes, PDF export |
