# Opervia — Multi-Tenant E-Commerce CRM & WhatsApp Platform

Opervia is a commercial, multi-tenant SaaS CRM built for e-commerce merchants in Tunisia and international markets. It centralizes order confirmation workflows, cash-on-delivery (COD) logistics, omnichannel customer communications via the official Meta WhatsApp Business Cloud API, WooCommerce / Shopify / Custom store synchronization, and automated rule engines.

---

## 1. Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, responsive layout with persistent sidebar and split-pane omnichannel inbox.
- **Backend API**: Node.js, Express, TypeScript, structured REST API routes (`/api/*`), HMAC-SHA256 signature verification for webhooks, token-based authentication.
- **Database & Persistence**: Standard SQL relational database engine powered by WebAssembly SQLite (`sql.js`) with versioned schema migrations, persistent binary snapshotting to disk (`data/opervia.db`), foreign keys, and automatic backup copying (`data/opervia.backup.db`).
- **Tenant Isolation**: Every database table includes `company_id`. Strict tenant isolation middleware validates company membership on every query and mutation, preventing cross-tenant leakage.
- **Background Worker**: Persistent database queue (`background_jobs`) with scheduled polling, retry policies, exponential backoff, and dead-letter failure tracking for WhatsApp campaigns, webhook retries, and delayed confirmation reminders.

---

## 2. Directory Structure

```
├── server.ts                    # Full-stack server entry point (Express + Vite middlewares)
├── data/                        # Persistent database storage & safety backups
│   ├── opervia.db               # SQLite database file
│   └── opervia.backup.db        # Automatic backup copy
├── src/
│   ├── server/
│   │   ├── constants.ts         # Tunisian 24 governorates, order statuses, plans
│   │   ├── auth/
│   │   │   └── middleware.ts    # JWT/HMAC verification, tenant isolation, RBAC
│   │   ├── db/
│   │   │   ├── database.ts      # sql.js persistent database engine & migration runner
│   │   │   └── seed.ts          # Seed script for plans, SuperAdmin, and demo tenant
│   │   ├── services/
│   │   │   ├── phoneNormalizer.ts   # Tunisian (+216) & international phone normalization
│   │   │   ├── whatsappService.ts   # Meta Cloud API, HMAC verification, opt-out check
│   │   │   ├── woocommerceService.ts# WooCommerce webhook HMAC verification & order sync
│   │   │   ├── automationEngine.ts  # Configurable trigger/condition/action rule engine
│   │   │   └── backgroundWorker.ts  # Persistent job queue with retry backoff
│   │   ├── routes/
│   │   │   ├── authRoutes.ts        # Register, login, session
│   │   │   ├── companyRoutes.ts     # Onboarding, settings, team members
│   │   │   ├── orderRoutes.ts       # COD orders, status transitions, CSV import/export
│   │   │   ├── customerRoutes.ts    # CRM, phone normalization, anti-duplicate merge
│   │   │   ├── productRoutes.ts     # SKU, pricing in TND, stock inventory
│   │   │   ├── conversationRoutes.ts# Omnichannel inbox, messages, assign agent
│   │   │   ├── whatsappRoutes.ts    # Meta webhook verification challenge & events
│   │   │   ├── integrationRoutes.ts # WooCommerce, Shopify, Custom REST API
│   │   │   ├── automationRoutes.ts  # Rule builder & execution logs
│   │   │   ├── campaignRoutes.ts    # WhatsApp campaigns, audience estimation
│   │   │   ├── taskRoutes.ts        # Order follow-up tasks & reminders
│   │   │   ├── reportRoutes.ts      # Database-derived KPIs & governorates analytics
│   │   │   ├── billingRoutes.ts     # Subscriptions, bank receipts, invoices
│   │   │   └── superadminRoutes.ts  # Multi-tenant management & platform metrics
│   │   └── test/
│   │       └── runTests.ts          # Automated test suite covering all 18 test scenarios
│   ├── client/
│   │   ├── api.ts                   # Client HTTP API wrapper with tenant isolation header
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          # Responsive navigation with badge counters
│   │   │   ├── Header.tsx           # Company switcher, new order trigger, notifications
│   │   │   └── OnboardingWizard.tsx # 8-step guided onboarding checklist
│   │   └── views/
│   │       ├── DashboardView.tsx    # Live KPIs, Tunisian governorates breakdown
│   │       ├── OrdersView.tsx       # Table & Kanban COD pipeline, slip printer
│   │       ├── InboxView.tsx        # Omnichannel chat, Meta approved templates
│   │       ├── CustomersView.tsx    # Customer CRM, duplicate merging
│   │       ├── ProductsView.tsx     # Products catalog, costs & margins in TND
│   │       ├── AutomationsView.tsx  # Workflows & trigger actions
│   │       ├── CampaignsView.tsx    # WhatsApp broadcast with opt-out enforcement
│   │       ├── AnalyticsView.tsx    # Delivery success rates & refusal analysis
│   │       ├── TasksView.tsx        # Team tasks & follow-ups
│   │       ├── IntegrationsView.tsx # WooCommerce, WhatsApp Cloud API, REST API docs
│   │       ├── TeamView.tsx         # Team roles (Owner, Admin, Agent, Logistics)
│   │       ├── SubscriptionView.tsx # SaaS plans, bank transfer proof upload
│   │       ├── SettingsView.tsx     # Company parameters, INPDP data privacy
│   │       ├── SuperAdminView.tsx   # Platform administration portal
│   │       └── AuthView.tsx         # Authentication & quick demo access
│   ├── App.tsx                      # Main application view router
│   ├── main.tsx                     # React root
│   └── index.css                    # Tailwind CSS
```

---

## 3. Database Schema & Migrations

Migrations run automatically at server startup (`src/server/db/database.ts`):

- `users`: User credentials (`id`, `email`, `password_hash`, `full_name`, `is_superadmin`).
- `companies`: Tenant entities (`id`, `name`, `slug`, `country`, `currency`, `timezone`, `status`).
- `company_memberships`: Role-based access control (`company_id`, `user_id`, `role`: owner, admin, agent, logistics).
- `subscription_plans`: Plan definitions (Starter 49€, Pro 129€, Growth 229€, Enterprise 399€).
- `subscriptions`: Active tenant subscriptions with period dates and status (`trial`, `active`, `past_due`, `suspended`, `cancelled`, `expired`).
- `invoices`: Billing records with payment method (`manual_bank_transfer`, `online`) and verification audit.
- `customers`: Tenant customers with normalized Tunisian phone numbers (`+216...`), governorates, consent status (`opt_in`, `opt_out`), total orders, total spent in TND, refusal history.
- `products` & `order_items`: Catalog with SKU, cost, selling price in TND, stock.
- `orders`: Tunisian COD orders with subtotal, shipping fee (7 TND default), total, status workflow, and carrier tracking.
- `order_status_history`: Timestamped audit trail of each order status change with the user ID responsible.
- `integrations`: Store connections (`woocommerce`, `shopify`, `custom_api`, `whatsapp`) with credentials and webhook secrets.
- `webhook_events`: Idempotency tracking table with payload and verification status.
- `conversations` & `messages`: Omnichannel chat messages with delivery receipts (`sent`, `delivered`, `read`, `failed`).
- `message_templates`: Meta WhatsApp approved templates catalogue.
- `campaigns` & `campaign_recipients`: Scheduled WhatsApp broadcasts with opt-out suppression.
- `automation_rules` & `automation_executions`: Configurable triggers and actions.
- `tasks`: Team tasks and confirmation reminders.
- `background_jobs`: Persistent queue for asynchronous processing.
- `audit_logs`: Platform administrative access trail.

---

## 4. Environment Variables (`.env`)

Configure the following variables in `.env` (sample provided in `.env.example`):

```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=opervia_production_hmac_secret_2026_default
DATA_DIR=./data

# Meta WhatsApp Cloud API (optional, can also be configured per tenant via UI)
WHATSAPP_CLOUD_API_VERSION=v20.0
WHATSAPP_SYSTEM_VERIFY_TOKEN=opervia_webhook_verify_token_sample
WHATSAPP_APP_SECRET=sample_meta_app_secret_for_hmac_sha256

# WooCommerce Webhook Secret
WOOCOMMERCE_WEBHOOK_SECRET=sample_wc_webhook_secret_key
```

---

## 5. Running the Application & Tests

### Development Mode:
```bash
npm run dev
```

### Run Automated Tests (all 18 scenarios):
```bash
npm test
```

### Production Build:
```bash
npm run build
npm start
```

---

## 6. Demonstration Accounts

- **Demo E-commerce Merchant (Tunisia)**:
  - Email: `demo@opervia.io`
  - Password: `OperviaAdmin2026!`
  - Company: **Dar El Caftan Tunisie** (Pre-seeded with real COD orders, Tunisian phone numbers, and WhatsApp conversations)
- **Platform SuperAdmin**:
  - Email: `superadmin@opervia.io`
  - Password: `OperviaAdmin2026!`
