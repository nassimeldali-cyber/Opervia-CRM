import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { execute, query, queryOne } from './database.js';
import { SUBSCRIPTION_PLANS } from '../constants.js';

export async function seedInitialData(): Promise<void> {
  // 1. Seed Subscription Plans if empty
  const existingPlans = query('SELECT id FROM subscription_plans');
  if (existingPlans.length === 0) {
    console.log('Seeding subscription plans...');
    for (const plan of SUBSCRIPTION_PLANS) {
      execute(
        `INSERT INTO subscription_plans (id, name, slug, price_eur, price_tnd, billing_cycle_months, max_users, max_stores, max_whatsapp_messages, max_automations, features_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `plan_${plan.slug}`,
          plan.name,
          plan.slug,
          plan.priceEur,
          plan.priceTnd,
          plan.billingCycleMonths,
          plan.maxUsers,
          plan.maxStores,
          plan.maxWhatsappMessages,
          plan.maxAutomations,
          JSON.stringify(plan.features),
        ]
      );
    }
  }

  // 2. Seed Platform SuperAdmin if not exists
  const superadminEmail = 'superadmin@opervia.io';
  const existingSuperadmin = queryOne('SELECT id FROM users WHERE email = ?', [superadminEmail]);
  const passwordHash = await bcrypt.hash('OperviaAdmin2026!', 10);

  let superadminId = existingSuperadmin?.id;
  if (!existingSuperadmin) {
    superadminId = 'usr_superadmin_' + crypto.randomBytes(4).toString('hex');
    execute(
      `INSERT INTO users (id, email, password_hash, full_name, is_superadmin)
       VALUES (?, ?, ?, ?, 1)`,
      [superadminId, superadminEmail, passwordHash, 'SuperAdmin Opervia']
    );
    console.log('Seeded SuperAdmin account:', superadminEmail);
  }

  // 3. Seed Demo Tenant: "Dar El Caftan Tunisie" if no companies exist
  const existingCompanies = query('SELECT id FROM companies');
  if (existingCompanies.length === 0) {
    console.log('Seeding Demo Company: Dar El Caftan Tunisie...');
    const demoOwnerEmail = 'demo@opervia.io';
    const demoOwnerId = 'usr_owner_' + crypto.randomBytes(4).toString('hex');
    const demoCompanyId = 'cmp_dar_el_caftan';

    // Create demo owner user
    execute(
      `INSERT INTO users (id, email, password_hash, full_name, is_superadmin)
       VALUES (?, ?, ?, ?, 0)`,
      [demoOwnerId, demoOwnerEmail, passwordHash, 'Sarra Ben Mahmoud']
    );

    // Create demo company
    execute(
      `INSERT INTO companies (id, name, slug, country, currency, timezone, business_model, order_volume, status, settings_json)
       VALUES (?, ?, ?, 'TN', 'TND', 'Africa/Tunis', 'ecommerce_cod', '100-500', 'active', ?)`,
      [
        demoCompanyId,
        'Dar El Caftan Tunisie',
        'dar-el-caftan',
        JSON.stringify({
          logoUrl: '',
          taxId: '1428570/A/P/M/000',
          autoAssignAgents: true,
          defaultCarrier: 'Aramex Tunisie',
          standardShippingFee: 7.0,
        }),
      ]
    );

    // Membership: Owner
    execute(
      `INSERT INTO company_memberships (id, company_id, user_id, role, status)
       VALUES (?, ?, ?, 'owner', 'active')`,
      ['mem_' + crypto.randomBytes(6).toString('hex'), demoCompanyId, demoOwnerId]
    );

    // Create second member: Logistics manager
    const logisticsUserId = 'usr_logistics_' + crypto.randomBytes(4).toString('hex');
    execute(
      `INSERT INTO users (id, email, password_hash, full_name, is_superadmin)
       VALUES (?, ?, ?, ?, 0)`,
      [logisticsUserId, 'logistique@opervia.io', passwordHash, 'Mohamed Trabelsi']
    );
    execute(
      `INSERT INTO company_memberships (id, company_id, user_id, role, status)
       VALUES (?, ?, ?, 'logistics', 'active')`,
      ['mem_' + crypto.randomBytes(6).toString('hex'), demoCompanyId, logisticsUserId]
    );

    // Pro subscription for Demo Company
    const proPlan = queryOne('SELECT id FROM subscription_plans WHERE slug = ?', ['pro_quarterly']);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    execute(
      `INSERT INTO subscriptions (id, company_id, plan_id, status, current_period_start, current_period_end, payment_provider)
       VALUES (?, ?, ?, 'active', ?, ?, 'manual_bank_transfer')`,
      [
        'sub_' + crypto.randomBytes(6).toString('hex'),
        demoCompanyId,
        proPlan?.id || 'plan_pro_quarterly',
        now.toISOString(),
        periodEnd.toISOString(),
      ]
    );

    // Seed Demo Products
    const products = [
      { id: 'prd_1', sku: 'CAF-ROYAL-BL', name: 'Caftan Royal Bleu Nuit & Broderie Dorée', price: 290.0, cost: 130.0, stock: 24 },
      { id: 'prd_2', sku: 'ROB-JASMIN-WH', name: 'Robe Soirée Jasmin Blanc Satin', price: 180.0, cost: 85.0, stock: 15 },
      { id: 'prd_3', sku: 'JEB-MODERN-GR', name: 'Jebba Moderne Kaki Lin Tunisien', price: 145.0, cost: 60.0, stock: 30 },
      { id: 'prd_4', sku: 'FOUL-SOIE-RD', name: 'Foulard Soie Sauvage Rouge Carmin', price: 45.0, cost: 18.0, stock: 50 },
    ];
    for (const p of products) {
      execute(
        `INSERT INTO products (id, company_id, sku, name, description, price_tnd, cost_tnd, stock_quantity, track_inventory, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [p.id, demoCompanyId, p.sku, p.name, `Article haute couture tunisienne ${p.name}`, p.price, p.cost, p.stock]
      );
    }

    // Seed Demo Customers with verified Tunisian numbers
    const customers = [
      { id: 'cst_1', name: 'Amira Chahed', phone: '+21698421055', gov: 'Tunis', city: 'El Menzah 9', addr: '14 Rue des Violettes' },
      { id: 'cst_2', name: 'Yassine Karray', phone: '+21620554123', gov: 'Sfax', city: 'Sfax Ville', addr: 'Route de Téniour km 3' },
      { id: 'cst_3', name: 'Leila Bouazizi', phone: '+21655987321', gov: 'Sousse', city: 'Kantaoui', addr: 'Résidence Les Palmiers, Apt 12' },
      { id: 'cst_4', name: 'Karim Jaziri', phone: '+21644112233', gov: 'Bizerte', city: 'Zarzouna', addr: 'Av. Habib Bourguiba' },
      { id: 'cst_5', name: 'Fatma Gharbi', phone: '+21671234567', gov: 'Ariana', city: 'Ennasr 2', addr: 'Immeuble Jasmin, Bloc B' },
      { id: 'cst_6', name: 'Hedi Miled', phone: '+21699887766', gov: 'Nabeul', city: 'Hammamet Nord', addr: 'Zone Touristique' },
    ];
    for (const c of customers) {
      execute(
        `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, country, governorate, city, address, acquisition_channel, consent_status, total_orders, total_spent_tnd)
         VALUES (?, ?, ?, ?, ?, 'TN', ?, ?, ?, 'whatsapp', 'opt_in', 1, 190.0)`,
        [c.id, demoCompanyId, c.name, c.phone, c.phone, c.gov, c.city, c.addr]
      );
    }

    // Seed Orders with authentic Tunisian COD distribution
    const sampleOrders = [
      { id: 'ord_1001', ext: 'WC-8491', cst: customers[0], prod: products[0], status: 'to_confirm', total: 297.0, sub: 290.0 },
      { id: 'ord_1002', ext: 'WC-8492', cst: customers[1], prod: products[1], status: 'confirmed', total: 187.0, sub: 180.0 },
      { id: 'ord_1003', ext: 'WC-8493', cst: customers[2], prod: products[2], status: 'preparing', total: 152.0, sub: 145.0 },
      { id: 'ord_1004', ext: 'WC-8494', cst: customers[3], prod: products[3], status: 'shipped', total: 52.0, sub: 45.0 },
      { id: 'ord_1005', ext: 'WC-8495', cst: customers[4], prod: products[0], status: 'delivered', total: 297.0, sub: 290.0 },
      { id: 'ord_1006', ext: 'WC-8496', cst: customers[5], prod: products[1], status: 'unreachable', total: 187.0, sub: 180.0 },
    ];

    for (const o of sampleOrders) {
      execute(
        `INSERT INTO orders (
          id, company_id, external_id, source_channel, customer_id, customer_name, customer_phone,
          governorate, city, address, products_summary, cod_amount_tnd, subtotal_tnd, shipping_tnd,
          total_tnd, currency, payment_method, payment_status, status, assigned_agent_id, delivery_carrier
        ) VALUES (?, ?, ?, 'woocommerce', ?, ?, ?, ?, ?, ?, ?, ?, ?, 7.0, ?, 'TND', 'cod', 'pending', ?, ?, 'Aramex Tunisie')`,
        [
          o.id,
          demoCompanyId,
          o.ext,
          o.cst.id,
          o.cst.name,
          o.cst.phone,
          o.cst.gov,
          o.cst.city,
          o.cst.addr,
          `1x ${o.prod.name}`,
          o.total,
          o.sub,
          o.total,
          o.status,
          demoOwnerId,
        ]
      );

      // Order Item
      execute(
        `INSERT INTO order_items (id, company_id, order_id, product_id, sku, product_name, quantity, unit_price_tnd, total_price_tnd)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ['oit_' + crypto.randomBytes(4).toString('hex'), demoCompanyId, o.id, o.prod.id, o.prod.sku, o.prod.name, o.prod.price, o.prod.price]
      );

      // Status history
      execute(
        `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, changed_by_user_id, reason)
         VALUES (?, ?, ?, 'new', ?, ?, 'Synchronisation initiale de démonstration')`,
        ['osh_' + crypto.randomBytes(4).toString('hex'), demoCompanyId, o.id, o.status, demoOwnerId]
      );
    }

    // Seed Meta WhatsApp Approved Templates
    const templates = [
      {
        id: 'tmpl_1',
        name: 'order_confirmation_cod_fr',
        category: 'utility',
        body: 'Bonjour {{1}}, merci pour votre commande chez Dar El Caftan (Réf: {{2}}). Le montant à payer à la livraison est de {{3}} TND. Pouvez-vous nous confirmer votre adresse à {{4}} ? Répondez OUI pour valider.',
        vars: ['nom_client', 'ref_commande', 'montant_tnd', 'ville'],
      },
      {
        id: 'tmpl_2',
        name: 'shipping_update_aramex',
        category: 'utility',
        body: 'Excellente nouvelle {{1}} ! Votre colis {{2}} a été remis au livreur Aramex. Préparez la somme exacte de {{3}} TND en espèces. Suivi : {{4}}.',
        vars: ['nom_client', 'ref_commande', 'montant_tnd', 'num_suivi'],
      },
      {
        id: 'tmpl_3',
        name: 'unreachable_followup',
        category: 'utility',
        body: 'Bonjour {{1}}, notre service de confirmation a essayé de vous joindre concernant votre commande {{2}}. À quel moment souhaitez-vous que nous vous rappelions ?',
        vars: ['nom_client', 'ref_commande'],
      },
    ];
    for (const t of templates) {
      execute(
        `INSERT INTO message_templates (id, company_id, name, language, category, body, variables_json, status)
         VALUES (?, ?, ?, 'fr', ?, ?, ?, 'approved')`,
        [t.id, demoCompanyId, t.name, t.category, t.body, JSON.stringify(t.vars)]
      );
    }

    // Seed Demo Conversations in Omnichannel Inbox
    const convId = 'cnv_101';
    execute(
      `INSERT INTO conversations (id, company_id, customer_id, channel, status, assigned_agent_id, last_message_text, unread_count, priority)
       VALUES (?, ?, ?, 'whatsapp', 'open', ?, 'Oui bonjour, je confirme ma commande pour Tunis.', 1, 'high')`,
      [convId, demoCompanyId, customers[0].id, demoOwnerId]
    );

    execute(
      `INSERT INTO messages (id, company_id, conversation_id, sender_type, channel, text, status)
       VALUES (?, ?, ?, 'system', 'whatsapp', 'Modèle envoyé: order_confirmation_cod_fr', 'delivered')`,
      ['msg_1', demoCompanyId, convId]
    );
    execute(
      `INSERT INTO messages (id, company_id, conversation_id, sender_type, channel, text, status)
       VALUES (?, ?, ?, 'customer', 'whatsapp', 'Oui bonjour, je confirme ma commande pour Tunis.', 'delivered')`,
      ['msg_2', demoCompanyId, convId]
    );

    // Seed Automation Rules
    execute(
      `INSERT INTO automation_rules (id, company_id, name, enabled, trigger_type, conditions_json, actions_json)
       VALUES (?, ?, 'Auto-confirmation WhatsApp lors d''une nouvelle commande COD', 1, 'order_created', ?, ?)`,
      [
        'rule_1',
        demoCompanyId,
        JSON.stringify([{ field: 'payment_method', operator: 'equals', value: 'cod' }]),
        JSON.stringify([
          { type: 'set_order_status', status: 'to_confirm' },
          { type: 'send_whatsapp_template', template_id: 'tmpl_1' },
          { type: 'create_task', title: 'Appeler client si pas de réponse sous 2h' },
        ]),
      ]
    );

    // Seed Integrations placeholders
    execute(
      `INSERT INTO integrations (id, company_id, type, name, status, webhook_secret)
       VALUES (?, ?, 'woocommerce', 'Boutique Principale WooCommerce', 'connected', 'wc_secret_live_demo')`,
      ['int_wc_1', demoCompanyId]
    );
    execute(
      `INSERT INTO integrations (id, company_id, type, name, status, webhook_secret)
       VALUES (?, ?, 'whatsapp', 'Meta WhatsApp Cloud API (+216 71 000 000)', 'connected', 'meta_verify_demo')`,
      ['int_wa_1', demoCompanyId]
    );

    console.log('Demo Company seeding complete!');
  }
}
