# Nova Bank - Architecture Document

**Hack to Night 2026** | Team: Neo, Gimhani, Zenith, Ruwithma  
**Stack:** Next.js 16 · Supabase · TypeScript · Tailwind CSS · shadcn/ui

---

## System Overview

```mermaid
graph TD
    User["👤 User (Browser)"]

    subgraph Frontend["Next.js 16 App Router"]
        Auth["Auth Pages\n/login · /sign-up · /reset-password"]
        Dashboard["/dashboard"]
        Transfer["/bank-transfer"]
        Bills["/pay-bills"]
        Accounts["/bank-accounts"]
        Txns["/transactions"]
        EStmt["/e-statement"]
        SmartSpend["/smart-spend"]
        QR["/qr-pay"]
        Settings["/settings"]
        MW["middleware.ts\n(Route Protection)"]
    end

    subgraph APILayer["API Routes (Next.js)"]
        TransferAPI["/api/transfer"]
        AccountsAPI["/api/accounts"]
        TxnsAPI["/api/transactions"]
        ProfileAPI["/api/profile"]
        SearchAPI["/api/search"]
        InsightsAPI["/api/insights"]
        PayReqAPI["/api/payment-requests"]
        SplitsAPI["/api/splits"]
        UtilAPI["/api/utility-predictor"]
    end

    subgraph Supabase["Supabase (Backend-as-a-Service)"]
        SupaAuth["Auth\n(JWT · bcrypt · email confirm)"]
        Postgres["PostgreSQL\n(RLS enabled)"]
        Realtime["Realtime\n(balance updates)"]
    end

    OpenAI["OpenAI API\n(Smart Spend · Utility Predictor)"]

    User -->|HTTPS| MW
    MW -->|Protected routes| Frontend
    MW -->|Unauthenticated| Auth
    Auth -->|supabase.auth.*| SupaAuth
    Frontend -->|fetch()| APILayer
    APILayer -->|supabase client| Postgres
    APILayer -->|supabase.auth| SupaAuth
    Postgres -->|Realtime sub| Realtime
    Realtime -->|WebSocket| Dashboard
    InsightsAPI -->|API call| OpenAI
    UtilAPI -->|API call| OpenAI
```

---

## Database Schema

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
    }

    PROFILES {
        uuid id PK
        text full_name
        text nic
        text role
        timestamptz created_at
    }

    ACCOUNTS {
        serial id PK
        uuid user_id FK
        text account_number
        text account_name
        numeric balance
        text pin_hash
        timestamptz created_at
    }

    TRANSACTIONS {
        serial id PK
        text from_account
        text to_account
        numeric amount
        text description
        text status
        uuid created_by FK
        timestamptz created_at
    }

    AUDIT_LOGS {
        serial id PK
        text event
        uuid user_id FK
        jsonb payload
        timestamptz created_at
    }

    AUTH_USERS ||--|| PROFILES : "extends"
    PROFILES ||--o{ ACCOUNTS : "owns"
    PROFILES ||--o{ TRANSACTIONS : "initiates"
    PROFILES ||--o{ AUDIT_LOGS : "generates"
```

---

## Authentication & Request Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware
    participant NextAPI as Next.js API Route
    participant Supabase

    Browser->>Middleware: GET /dashboard
    Middleware->>Supabase: Verify JWT (cookie)
    alt Not authenticated
        Supabase-->>Middleware: Invalid/expired
        Middleware-->>Browser: 302 → /login
    else Authenticated
        Supabase-->>Middleware: Valid session
        Middleware-->>Browser: Allow through
    end

    Browser->>NextAPI: POST /api/transfer
    NextAPI->>Supabase: createServerClient (cookie)
    Supabase-->>NextAPI: auth.uid()
    NextAPI->>Supabase: rpc('perform_transfer', {...})
    Note over Supabase: Atomic TX: debit + credit + log
    Supabase-->>NextAPI: { ok: true, transaction_id }
    NextAPI-->>Browser: 200 OK
```

---

## Transfer Transaction (Atomic RPC)

```mermaid
flowchart TD
    A[POST /api/transfer] --> B{Amount > 0?}
    B -->|No| FAIL1[400 Invalid amount]
    B -->|Yes| C[RPC: perform_transfer]
    C --> D{Owns from_account?\nRLS check}
    D -->|No| FAIL2[403 Not your account]
    D -->|Yes| E{Balance ≥ amount?}
    E -->|No| FAIL3[422 Insufficient funds]
    E -->|Yes| F[BEGIN TRANSACTION]
    F --> G[Debit from_account]
    G --> H[Credit to_account]
    H --> I[Insert transaction record]
    I --> J[Insert audit_log]
    J --> K[COMMIT]
    K --> SUCCESS[200 OK + transaction_id]
```

---

## Security Model

| Layer | Mechanism | Bugs Fixed |
|---|---|---|
| **Auth** | Supabase JWT (signed, HttpOnly cookie) | S5 - forgeable sessions |
| **Passwords** | bcrypt via Supabase Auth | S6 - plaintext passwords |
| **Queries** | Supabase JS client (parameterized) | S1 - SQL injection (all routes) |
| **Data Access** | Row Level Security on all tables | S4, L4 - PIN exposure, ownership bypass |
| **Routes** | Next.js middleware JWT check | F2 - unprotected pages |
| **Secrets** | Env vars only (no hardcoded creds) | S10 - hardcoded credentials |
| **API Errors** | Generic `{ ok: false, message }` | S7, S8, S9 - internal leaks |

---

## Feature Map

```mermaid
graph LR
    NB((Nova Bank))

    NB --> A[Auth]
    A --> A1[Login]
    A --> A2[Sign Up]
    A --> A3[Reset Password]

    NB --> B[Banking]
    B --> B1[Bank Transfer]
    B1 --> B1a[PIN Confirmation]
    B1 --> B1b[Atomic RPC]
    B --> B2[Pay Bills]
    B --> B3[QR Pay]
    B3 --> B3a[QR Scanner]
    B3 --> B3b[QR Generator]

    NB --> C[Accounts]
    C --> C1[View Accounts]
    C --> C2[Add / Edit Account]

    NB --> D[Analytics]
    D --> D1[Smart Spend]
    D1 --> D1a[Spending Breakdown]
    D1 --> D1b[AI Insights]
    D --> D2[Utility Predictor]

    NB --> E[Statements]
    E --> E1[Transaction History]
    E --> E2[E-Statement PDF]

    NB --> F[Settings]
    F --> F1[Profile Update]
    F --> F2[Dark Mode]
```

---

## Bugs Fixed Summary

**29 bugs found → 10 auto-fixed by Supabase migration, 19 manually resolved**

```mermaid
xychart-beta
    title "Bugs by Category"
    x-axis ["Security", "Functional", "Logical", "DevOps"]
    y-axis "Count" 0 --> 14
    bar [10, 12, 5, 2]
```

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| Security | 6 | 2 | 1 | 0 |
| Functional | 1 | 6 | 4 | 0 |
| Logical | 4 | 0 | 1 | 0 |
| DevOps | 0 | 0 | 1 | 1 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Auth & DB** | Supabase (PostgreSQL + RLS + Auth) |
| **AI** | OpenAI API (insights, utility predictor) |
| **Charts** | Recharts |
| **Forms / Validation** | Zod |
| **PDF Export** | jsPDF + jspdf-autotable |
| **QR** | qrcode + qr-scanner |
| **Containerisation** | Docker + Docker Compose |
| **Linting** | Biome |
