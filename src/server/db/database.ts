import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: SqlJsDatabase | null = null;
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'opervia.db');
const BACKUP_PATH = path.join(DATA_DIR, 'opervia.backup.db');

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      fileBuffer = fs.readFileSync(DB_PATH);
    } catch (err) {
      console.error('Error reading existing DB file, checking backup...', err);
      if (fs.existsSync(BACKUP_PATH)) {
        fileBuffer = fs.readFileSync(BACKUP_PATH);
      }
    }
  }

  if (fileBuffer && fileBuffer.length > 0) {
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    if (fs.existsSync(DB_PATH)) {
      // Keep a safety backup
      try {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
      } catch {
        // Ignore backup copy failure
      }
    }
    fs.renameSync(tempPath, DB_PATH);
  } catch (error) {
    console.error('Failed to persist database to disk:', error);
  }
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const res = query<T>(sql, params);
  return res.length > 0 ? res[0] : null;
}

export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  saveDb();
}

/**
 * Migration runner with version tracking
 */
async function runMigrations(db: SqlJsDatabase): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const stmt = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC');
  const applied: number[] = [];
  while (stmt.step()) {
    applied.push(stmt.getAsObject().version as number);
  }
  stmt.free();

  const migrations: Array<{ version: number; name: string; up: (db: SqlJsDatabase) => void }> = [
    {
      version: 1,
      name: 'initial_multi_tenant_schema',
      up: (db) => {
        db.run(`
          -- Users table
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            is_superadmin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Companies (Tenants)
          CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            country TEXT DEFAULT 'TN',
            currency TEXT DEFAULT 'TND',
            timezone TEXT DEFAULT 'Africa/Tunis',
            business_model TEXT DEFAULT 'ecommerce_cod',
            order_volume TEXT DEFAULT '100-500',
            status TEXT DEFAULT 'active', -- active, suspended
            settings_json TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Company Memberships (RBAC)
          CREATE TABLE IF NOT EXISTS company_memberships (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL, -- owner, admin, agent, logistics
            status TEXT DEFAULT 'active', -- active, invited
            invited_email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(company_id, user_id)
          );

          -- Subscription Plans
          CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            price_eur REAL NOT NULL,
            price_tnd REAL NOT NULL,
            billing_cycle_months INTEGER NOT NULL,
            max_users INTEGER NOT NULL,
            max_stores INTEGER NOT NULL,
            max_whatsapp_messages INTEGER NOT NULL,
            max_automations INTEGER NOT NULL,
            features_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Company Subscriptions
          CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            company_id TEXT UNIQUE NOT NULL,
            plan_id TEXT NOT NULL,
            status TEXT NOT NULL, -- trial, active, past_due, suspended, cancelled, expired
            current_period_start DATETIME NOT NULL,
            current_period_end DATETIME NOT NULL,
            cancel_at_period_end INTEGER DEFAULT 0,
            payment_provider TEXT DEFAULT 'manual_bank_transfer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
          );

          -- Invoices & Manual Receipts
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            subscription_id TEXT,
            amount_eur REAL NOT NULL,
            amount_tnd REAL NOT NULL,
            status TEXT NOT NULL, -- paid, pending_verification, failed
            payment_method TEXT NOT NULL, -- manual_bank_transfer, online
            receipt_note TEXT,
            receipt_reference TEXT,
            verified_by_user_id TEXT,
            verified_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Customers CRM
          CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            external_id TEXT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            phone_normalized TEXT NOT NULL,
            email TEXT,
            country TEXT DEFAULT 'TN',
            governorate TEXT,
            city TEXT,
            address TEXT,
            preferred_language TEXT DEFAULT 'fr',
            tags_json TEXT DEFAULT '[]',
            notes TEXT,
            acquisition_channel TEXT DEFAULT 'website', -- website, whatsapp, facebook, instagram, manual
            consent_status TEXT DEFAULT 'opt_in', -- opt_in, opt_out, pending
            opt_out_at DATETIME,
            total_orders INTEGER DEFAULT 0,
            total_spent_tnd REAL DEFAULT 0,
            refused_orders_count INTEGER DEFAULT 0,
            assigned_agent_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, phone_normalized)
          );

          -- Products & Catalog
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            store_id TEXT,
            external_id TEXT,
            sku TEXT,
            name TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            price_tnd REAL NOT NULL,
            cost_tnd REAL DEFAULT 0,
            stock_quantity INTEGER DEFAULT 0,
            track_inventory INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Orders
          CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            external_id TEXT,
            store_id TEXT,
            source_channel TEXT DEFAULT 'manual', -- woocommerce, shopify, custom_api, whatsapp, facebook, manual
            customer_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            governorate TEXT NOT NULL,
            city TEXT,
            address TEXT NOT NULL,
            products_summary TEXT,
            cod_amount_tnd REAL NOT NULL,
            subtotal_tnd REAL NOT NULL,
            shipping_tnd REAL DEFAULT 7.0, -- Standard Tunisian shipping fee
            discount_tnd REAL DEFAULT 0,
            total_tnd REAL NOT NULL,
            currency TEXT DEFAULT 'TND',
            payment_method TEXT DEFAULT 'cod', -- cod, prepaid
            payment_status TEXT DEFAULT 'pending', -- pending, paid
            status TEXT NOT NULL DEFAULT 'to_confirm',
            assigned_agent_id TEXT,
            delivery_carrier TEXT,
            tracking_number TEXT,
            customer_notes TEXT,
            internal_notes TEXT,
            confirmed_at DATETIME,
            shipped_at DATETIME,
            delivered_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
          );

          -- Order Items
          CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            product_id TEXT,
            sku TEXT,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price_tnd REAL NOT NULL,
            total_price_tnd REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
          );

          -- Order Status Audit History
          CREATE TABLE IF NOT EXISTS order_status_history (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            changed_by_user_id TEXT,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
          );

          -- Stores & Connectors
          CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            type TEXT NOT NULL, -- woocommerce, shopify, custom_api, whatsapp
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'disconnected', -- connected, disconnected, error
            credentials_json TEXT DEFAULT '{}',
            webhook_secret TEXT,
            last_sync_at DATETIME,
            error_log TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Webhook Events (Deduplication & Audit)
          CREATE TABLE IF NOT EXISTS webhook_events (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            event_id TEXT,
            event_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            signature_verified INTEGER DEFAULT 0,
            status TEXT DEFAULT 'processed', -- processed, failed, ignored
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE(company_id, provider, event_id)
          );

          -- Omnichannel Conversations
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            channel TEXT DEFAULT 'whatsapp', -- whatsapp, messenger, instagram, manual
            status TEXT DEFAULT 'open', -- open, pending, resolved
            assigned_agent_id TEXT,
            last_message_text TEXT,
            last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            unread_count INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
          );

          -- Messages
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            sender_type TEXT NOT NULL, -- customer, agent, system, automation
            sender_id TEXT,
            channel TEXT DEFAULT 'whatsapp',
            provider_message_id TEXT,
            text TEXT NOT NULL,
            media_url TEXT,
            media_type TEXT,
            status TEXT DEFAULT 'sent', -- queued, sent, delivered, read, failed
            error_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
          );

          -- Message Templates (Meta WhatsApp Approved Templates)
          CREATE TABLE IF NOT EXISTS message_templates (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            meta_template_id TEXT,
            name TEXT NOT NULL,
            language TEXT DEFAULT 'fr',
            category TEXT NOT NULL, -- utility, marketing, authentication
            body TEXT NOT NULL,
            variables_json TEXT DEFAULT '[]',
            status TEXT DEFAULT 'approved', -- approved, pending, rejected
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Campaigns
          CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            template_id TEXT NOT NULL,
            status TEXT DEFAULT 'draft', -- draft, scheduled, sending, completed, paused, cancelled
            target_filter_json TEXT DEFAULT '{}',
            total_recipients INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            delivered_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            scheduled_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (template_id) REFERENCES message_templates(id)
          );

          -- Campaign Recipients
          CREATE TABLE IF NOT EXISTS campaign_recipients (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            campaign_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            phone TEXT NOT NULL,
            status TEXT DEFAULT 'queued', -- queued, sent, delivered, failed, opted_out
            error_message TEXT,
            sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
          );

          -- Automation Rules
          CREATE TABLE IF NOT EXISTS automation_rules (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            name TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            trigger_type TEXT NOT NULL, -- order_created, order_status_changed, whatsapp_received, order_to_confirm_delay
            conditions_json TEXT DEFAULT '[]',
            actions_json TEXT DEFAULT '[]',
            execution_count INTEGER DEFAULT 0,
            last_executed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Automation Executions Log
          CREATE TABLE IF NOT EXISTS automation_executions (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            trigger_event TEXT NOT NULL,
            status TEXT NOT NULL, -- success, failed
            execution_log TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
          );

          -- Tasks
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            assigned_to_user_id TEXT,
            related_order_id TEXT,
            related_customer_id TEXT,
            due_date DATETIME,
            priority TEXT DEFAULT 'medium', -- low, medium, high
            status TEXT DEFAULT 'pending', -- pending, completed
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Notifications
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            link TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
          );

          -- Persistent Background Job Queue
          CREATE TABLE IF NOT EXISTS background_jobs (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            job_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 5,
            next_run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Audit Logs
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            company_id TEXT,
            user_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT,
            details_json TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Indexes for High Performance and Tenant Isolation
          CREATE INDEX IF NOT EXISTS idx_customers_company_phone ON customers(company_id, phone_normalized);
          CREATE INDEX IF NOT EXISTS idx_orders_company_status ON orders(company_id, status);
          CREATE INDEX IF NOT EXISTS idx_orders_company_created ON orders(company_id, created_at);
          CREATE INDEX IF NOT EXISTS idx_orders_company_customer ON orders(company_id, customer_id);
          CREATE INDEX IF NOT EXISTS idx_conversations_company ON conversations(company_id, status);
          CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
          CREATE INDEX IF NOT EXISTS idx_bg_jobs_status ON background_jobs(status, next_run_at);
        `);
      },
    },
  ];

  for (const mig of migrations) {
    if (!applied.includes(mig.version)) {
      console.log(`Applying migration v${mig.version}: ${mig.name}`);
      mig.up(db);
      db.run('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [mig.version, mig.name]);
    }
  }
}
