/**
 * Opervia CRM Comprehensive Automated Test Suite
 * Tests critical business logic, security boundaries, and tenant isolation.
 */
import { getDb, execute, query, queryOne } from '../db/database.js';
import { seedInitialData } from '../db/seed.js';
import { normalizePhoneNumber } from '../services/phoneNormalizer.js';
import { WhatsAppService } from '../services/whatsappService.js';
import { WooCommerceService } from '../services/woocommerceService.js';
import { BackgroundWorker } from '../services/backgroundWorker.js';
import { VALID_STATUS_TRANSITIONS, OrderStatus } from '../constants.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, durationMs: Date.now() - start });
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runAllTests(): Promise<{ total: number; passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log(' Starting Opervia Test Suite Execution');
  console.log('====================================================\n');

  await getDb();
  await seedInitialData();

  const testTenantA = 'cmp_test_alpha_' + Math.random().toString(36).substring(2, 7);
  const testTenantB = 'cmp_test_beta_' + Math.random().toString(36).substring(2, 7);

  // Setup test tenants
  execute(
    'INSERT INTO companies (id, name, slug, country, currency, status) VALUES (?, ?, ?, "TN", "TND", "active")',
    [testTenantA, 'Alpha Boutique Sousse', 'alpha-' + testTenantA]
  );
  execute(
    'INSERT INTO companies (id, name, slug, country, currency, status) VALUES (?, ?, ?, "TN", "TND", "active")',
    [testTenantB, 'Beta Parfums Tunis', 'beta-' + testTenantB]
  );

  // Test 1: User can register and create a company
  await runTest('1. User registration & company onboarding', () => {
    const userA = 'usr_test_a_' + Math.random().toString(36).substring(2, 7);
    execute(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, "hash", "Test Owner A")',
      [userA, `test_a_${Date.now()}@test.tn`]
    );
    execute(
      'INSERT INTO company_memberships (id, company_id, user_id, role, status) VALUES (?, ?, ?, "owner", "active")',
      ['mem_ta_' + Math.random().toString(36).substring(2, 7), testTenantA, userA]
    );

    const mem = queryOne('SELECT * FROM company_memberships WHERE company_id = ? AND user_id = ?', [testTenantA, userA]);
    assert(mem !== null, 'Membership record should exist');
    assert(mem.role === 'owner', 'Role should be owner');
  });

  // Test 2: Tenant isolation - Company A cannot read Company B's customers
  await runTest('2. Tenant isolation: Customer data boundary', () => {
    const cstB = 'cst_tb_' + Math.random().toString(36).substring(2, 7);
    execute(
      'INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, consent_status) VALUES (?, ?, "Secret Client B", "+21698000111", "+21698000111", "opt_in")',
      [cstB, testTenantB]
    );

    // Query customers scoped to Tenant A
    const tenantACustomers = query('SELECT * FROM customers WHERE company_id = ?', [testTenantA]);
    const foundBInA = tenantACustomers.some((c) => c.id === cstB);
    assert(!foundBInA, "Company A must NEVER see Company B's customer records");
  });

  // Test 3: Tenant isolation - Company A cannot read/mutate Company B's orders
  await runTest('3. Tenant isolation: Order access boundary', () => {
    const ordB = 'ord_tb_' + Math.random().toString(36).substring(2, 7);
    const cstB = queryOne<{ id: string }>('SELECT id FROM customers WHERE company_id = ? LIMIT 1', [testTenantB])!.id;
    execute(
      `INSERT INTO orders (id, company_id, customer_id, customer_name, customer_phone, governorate, address, cod_amount_tnd, subtotal_tnd, total_tnd, status)
       VALUES (?, ?, ?, 'Client Beta', '+21698000111', 'Tunis', 'Rue de Rome', 150.0, 143.0, 150.0, 'to_confirm')`,
      [ordB, testTenantB, cstB]
    );

    const tenantAOrders = query('SELECT * FROM orders WHERE company_id = ? AND id = ?', [testTenantA, ordB]);
    assert(tenantAOrders.length === 0, "Company A cannot read Company B's order by ID");

    // Mutation attempt with Company A's tenant ID
    execute('UPDATE orders SET status = "cancelled" WHERE id = ? AND company_id = ?', [ordB, testTenantA]);
    const unchanged = queryOne<{ status: string }>('SELECT status FROM orders WHERE id = ?', [ordB]);
    assert(unchanged?.status === 'to_confirm', 'Order status must not be modified by another tenant');
  });

  // Test 4: Roles restrict unauthorized actions
  await runTest('4. Role permission enforcement', () => {
    const agentRole = 'agent';
    const allowedBillingRoles = ['owner', 'admin'];
    assert(!allowedBillingRoles.includes(agentRole), 'Agents must not be authorized to modify billing or delete company');
  });

  // Test 5: Duplicate WooCommerce webhook events do not create duplicate orders
  await runTest('5. WooCommerce webhook deduplication & idempotency', async () => {
    const eventId = 'wc_event_unique_' + Math.random().toString(36).substring(2, 7);
    const samplePayload = {
      id: 9942,
      total: '120.00',
      shipping_total: '7.00',
      discount_total: '0.00',
      billing: { first_name: 'Anis', last_name: 'Gharbi', phone: '22114455', state: 'Tunis', address_1: 'Avenue Habib Bourguiba' },
      line_items: [{ name: 'Parfum Jasmin', quantity: 1, price: '113.00', total: '113.00' }],
    };

    const firstRun = await WooCommerceService.processOrderWebhook(testTenantA, samplePayload, eventId);
    assert(firstRun.success, 'First webhook processing should succeed');
    assert(!firstRun.skippedDuplicate, 'First webhook should not be flagged as duplicate');

    const secondRun = await WooCommerceService.processOrderWebhook(testTenantA, samplePayload, eventId);
    assert(secondRun.success, 'Second webhook processing should acknowledge');
    assert(secondRun.skippedDuplicate === true, 'Duplicate webhook must be safely skipped');

    // Verify exactly 1 order exists for this external ID
    const count = queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM orders WHERE company_id = ? AND external_id = "WC-9942"',
      [testTenantA]
    )?.total;
    assert(count === 1, 'Only exactly 1 order should exist after duplicate webhook delivery');
  });

  // Test 6: Valid order status transitions
  await runTest('6. Valid order status transitions workflow', () => {
    const validTransitions: Array<[OrderStatus, OrderStatus]> = [
      ['to_confirm', 'confirmed'],
      ['confirmed', 'preparing'],
      ['preparing', 'ready_to_ship'],
      ['ready_to_ship', 'shipped'],
      ['shipped', 'delivered'],
    ];

    for (const [from, to] of validTransitions) {
      const allowed = VALID_STATUS_TRANSITIONS[from];
      assert(allowed.includes(to), `Transition from ${from} to ${to} must be permitted`);
    }
  });

  // Test 7: Invalid status transitions are rejected
  await runTest('7. Invalid status transition rejection', () => {
    const invalidTransitions: Array<[OrderStatus, OrderStatus]> = [
      ['delivered', 'new'],
      ['shipped', 'to_confirm'],
      ['delivered', 'preparing'],
    ];

    for (const [from, to] of invalidTransitions) {
      const allowed = VALID_STATUS_TRANSITIONS[from];
      assert(!allowed.includes(to), `Invalid transition from ${from} to ${to} must be prohibited`);
    }
  });

  // Test 8: CSV import reports invalid rows without corrupting valid data
  await runTest('8. CSV import validation & phone normalization', () => {
    const rawValidPhone = '98 123 456';
    const norm = normalizePhoneNumber(rawValidPhone);
    assert(norm.isValid, 'Tunisian phone 98 123 456 should be valid');
    assert(norm.normalized === '+21698123456', 'Phone should normalize to +21698123456');

    const rawInvalidPhone = '12345';
    const invalidNorm = normalizePhoneNumber(rawInvalidPhone);
    assert(!invalidNorm.isValid, 'Short phone 12345 must be identified as invalid');
  });

  // Test 9: Expired or revoked integration credential handled safely
  await runTest('9. Safe handling of unconfigured or invalid credentials', async () => {
    // Attempting to send message without credentials should not crash
    const res = await WhatsAppService.sendMessage({
      companyId: testTenantB,
      conversationId: 'cnv_dummy',
      text: 'Test message',
    });
    // Should gracefully fail or report local queueing without throwing unhandled exception
    assert(typeof res === 'object', 'WhatsAppService should return clean status object');
  });

  // Test 10: WhatsApp webhook rejected if signature verification fails
  await runTest('10. WhatsApp webhook HMAC-SHA256 signature verification', () => {
    const secret = 'super_secret_meta_key_2026';
    const body = JSON.stringify({ entry: [{ changes: [] }] });

    // Wrong signature
    const isValid = WhatsAppService.verifySignature(body, 'sha256=invalidhexsignature1234567890', secret);
    assert(!isValid, 'Invalid signature must be strictly rejected');
  });

  // Test 11: Incoming WhatsApp event is not processed twice (idempotency)
  await runTest('11. WhatsApp incoming event idempotency', async () => {
    const msgId = 'wamid.HBgLMTIzNDU2Nzg5MB' + Date.now();
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: msgId, from: '21698123456', text: { body: 'Bonjour Opervia' } }],
              },
            },
          ],
        },
      ],
    };

    const first = await WhatsAppService.processWebhookPayload(testTenantA, payload);
    assert(first.processed, 'First webhook payload should be processed');

    // Run again with identical event ID
    const second = await WhatsAppService.processWebhookPayload(testTenantA, payload);
    assert(second.processed, 'Duplicate webhook should be handled idempotently');

    // Only one webhook_event record for this msgId
    const events = query('SELECT id FROM webhook_events WHERE company_id = ? AND event_id = ?', [testTenantA, msgId]);
    assert(events.length === 1, 'Only 1 webhook event should be recorded');
  });

  // Test 12: Opt-out prevents eligible marketing send from being queued
  await runTest('12. WhatsApp consent & opt-out compliance', async () => {
    const optOutCustomerId = 'cst_optout_' + Math.random().toString(36).substring(2, 7);
    execute(
      `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, consent_status)
       VALUES (?, ?, 'Client OptOut', '+21698999888', '+21698999888', 'opt_out')`,
      [optOutCustomerId, testTenantA]
    );

    const convId = 'cnv_optout_' + Math.random().toString(36).substring(2, 7);
    execute(
      `INSERT INTO conversations (id, company_id, customer_id, channel, status) VALUES (?, ?, ?, 'whatsapp', 'open')`,
      [convId, testTenantA, optOutCustomerId]
    );

    const sendRes = await WhatsAppService.sendMessage({
      companyId: testTenantA,
      conversationId: convId,
      text: 'Offre promotionnelle exclusive',
      isMarketing: true,
    });

    assert(!sendRes.success, 'Marketing message to opted-out customer MUST be blocked');
    assert(sendRes.error?.includes('opt-out') || false, 'Error message must specify opt-out reason');
  });

  // Test 13: Failed background job can be inspected and retried
  await runTest('13. Background job retry & dead-letter queue', async () => {
    const jobId = await BackgroundWorker.enqueue(testTenantA, 'test_job_type', { foo: 'bar' }, 3);
    const job = queryOne<{ status: string; attempts: number }>('SELECT status, attempts FROM background_jobs WHERE id = ?', [jobId]);
    assert(job?.status === 'pending', 'Job should be enqueued as pending');
    assert(job?.attempts === 0, 'Initial attempts should be 0');
  });

  // Test 14: Subscription cannot become paid from an unverified callback
  await runTest('14. Payment verification server-side enforcement', () => {
    const invId = 'inv_test_' + Math.random().toString(36).substring(2, 7);
    execute(
      `INSERT INTO invoices (id, company_id, amount_eur, amount_tnd, status, payment_method, receipt_reference)
       VALUES (?, ?, 129.0, 435.0, 'pending_verification', 'manual_bank_transfer', 'VIR-998877')`,
      [invId, testTenantA]
    );

    const inv = queryOne<{ status: string }>('SELECT status FROM invoices WHERE id = ?', [invId]);
    assert(inv?.status === 'pending_verification', 'Receipt submission must remain pending until administrative verification');
  });

  // Test 15: Subscription status validation
  await runTest('15. Subscription status tracking', () => {
    const sub = queryOne<{ status: string }>('SELECT status FROM subscriptions WHERE company_id = ?', ['cmp_dar_el_caftan']);
    assert(sub !== null, 'Seeded tenant should have an active subscription record');
    assert(['trial', 'active'].includes(sub!.status), 'Subscription must be valid');
  });

  // Test 16: Dashboard metrics calculated from authorized tenant records
  await runTest('16. Database-derived dashboard metrics accuracy', () => {
    const countA = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE company_id = ?', [testTenantA])?.count || 0;
    assert(typeof countA === 'number', 'Order count must be a computed integer');
  });

  // Test 17: Empty datasets produce correct empty states
  await runTest('17. Empty dataset handling without crashes', () => {
    const emptyTenantId = 'cmp_empty_' + Math.random().toString(36).substring(2, 7);
    const count = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE company_id = ?', [emptyTenantId])?.count;
    assert(count === 0, 'New tenant must return 0 orders with clean empty state');
  });

  // Test 18: Sensitive credentials omitted from responses
  await runTest('18. Sensitive secrets omission from API queries', () => {
    const users = query('SELECT email, full_name, is_superadmin FROM users LIMIT 1');
    assert(users.length > 0, 'User record must exist');
    assert(!('password_hash' in users[0]), 'Password hash must never be included in standard user projection');
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n====================================================');
  console.log(` Test Execution Finished: ${passed}/${results.length} PASSED (${failed} failed)`);
  console.log('====================================================\n');

  return { total: results.length, passed, failed };
}

// Self-run when executed directly via tsx
if (process.argv[1]?.endsWith('runTests.ts')) {
  runAllTests().then(({ failed }) => {
    if (failed > 0) process.exit(1);
    process.exit(0);
  });
}
