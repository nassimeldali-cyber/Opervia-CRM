import crypto from 'crypto';
import { execute, queryOne } from '../db/database.js';
import { normalizePhoneNumber } from './phoneNormalizer.js';
import { TUNISIAN_GOVERNORATES } from '../constants.js';
import { AutomationEngine } from './automationEngine.js';

export class WooCommerceService {
  /**
   * Verifies WooCommerce webhook HMAC-SHA256 signature
   */
  static verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined, secret: string): boolean {
    if (!signatureHeader || !secret) return false;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
    } catch {
      return false;
    }
  }

  /**
   * Matches a text input to one of the 24 official Tunisian governorates
   */
  static matchGovernorate(text: string | undefined): string {
    if (!text) return 'Tunis';
    const clean = text.trim().toLowerCase();
    for (const gov of TUNISIAN_GOVERNORATES) {
      if (clean.includes(gov.toLowerCase()) || gov.toLowerCase().includes(clean)) {
        return gov;
      }
    }
    return 'Tunis';
  }

  /**
   * Idempotently processes WooCommerce order.created or order.updated webhook
   */
  static async processOrderWebhook(
    companyId: string,
    wcOrder: any,
    webhookEventId?: string
  ): Promise<{ success: boolean; orderId?: string; error?: string; skippedDuplicate?: boolean }> {
    try {
      const externalId = `WC-${wcOrder.id}`;

      // Idempotency check
      if (webhookEventId) {
        const existingEvent = queryOne(
          'SELECT id FROM webhook_events WHERE company_id = ? AND provider = "woocommerce" AND event_id = ?',
          [companyId, webhookEventId]
        );
        if (existingEvent) {
          return { success: true, skippedDuplicate: true };
        }
      }

      // Check if order already exists in this tenant
      const existingOrder = queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM orders WHERE company_id = ? AND external_id = ?',
        [companyId, externalId]
      );

      if (existingOrder) {
        // Prevent overwriting advanced statuses (e.g. shipped, delivered) with earlier status
        return { success: true, orderId: existingOrder.id, skippedDuplicate: true };
      }

      // Customer processing
      const rawPhone = wcOrder.billing?.phone || wcOrder.shipping?.phone || '';
      const normPhone = normalizePhoneNumber(rawPhone);
      const customerName = `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim() || 'Client WooCommerce';
      const email = wcOrder.billing?.email || null;
      const gov = this.matchGovernorate(wcOrder.shipping?.state || wcOrder.billing?.state || wcOrder.billing?.city);
      const city = wcOrder.shipping?.city || wcOrder.billing?.city || gov;
      const address = `${wcOrder.shipping?.address_1 || wcOrder.billing?.address_1 || ''} ${wcOrder.shipping?.address_2 || ''}`.trim() || 'Adresse non renseignée';

      let customer = queryOne<{ id: string }>(
        'SELECT id FROM customers WHERE company_id = ? AND phone_normalized = ?',
        [companyId, normPhone.normalized]
      );

      let customerId = customer?.id;
      if (!customerId) {
        customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
        execute(
          `INSERT INTO customers (id, company_id, external_id, full_name, phone, phone_normalized, email, country, governorate, city, address, acquisition_channel, consent_status, total_orders, total_spent_tnd)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'TN', ?, ?, ?, 'woocommerce', 'opt_in', 1, ?)`,
          [
            customerId,
            companyId,
            `wc_cst_${wcOrder.customer_id || wcOrder.id}`,
            customerName,
            rawPhone,
            normPhone.normalized,
            email,
            gov,
            city,
            address,
            parseFloat(wcOrder.total) || 0,
          ]
        );
      } else {
        execute(
          `UPDATE customers
           SET total_orders = total_orders + 1, total_spent_tnd = total_spent_tnd + ?
           WHERE id = ?`,
          [parseFloat(wcOrder.total) || 0, customerId]
        );
      }

      // Order creation
      const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
      const totalAmount = parseFloat(wcOrder.total) || 0;
      const shippingAmount = parseFloat(wcOrder.shipping_total) || 7.0;
      const discountAmount = parseFloat(wcOrder.discount_total) || 0;
      const subtotal = totalAmount - shippingAmount;

      const itemsSummary = (wcOrder.line_items || [])
        .map((item: any) => `${item.quantity}x ${item.name}`)
        .join(', ');

      const paymentMethod = (wcOrder.payment_method || 'cod').toLowerCase().includes('cod') ? 'cod' : 'prepaid';

      execute(
        `INSERT INTO orders (
          id, company_id, external_id, source_channel, customer_id, customer_name, customer_phone,
          governorate, city, address, products_summary, cod_amount_tnd, subtotal_tnd, shipping_tnd,
          discount_tnd, total_tnd, currency, payment_method, payment_status, status, customer_notes
        ) VALUES (?, ?, ?, 'woocommerce', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TND', ?, 'pending', 'to_confirm', ?)`,
        [
          orderId,
          companyId,
          externalId,
          customerId,
          customerName,
          normPhone.normalized,
          gov,
          city,
          address,
          itemsSummary,
          totalAmount,
          subtotal,
          shippingAmount,
          discountAmount,
          totalAmount,
          paymentMethod,
          wcOrder.customer_note || null,
        ]
      );

      // Order Items
      if (Array.isArray(wcOrder.line_items)) {
        for (const item of wcOrder.line_items) {
          execute(
            `INSERT INTO order_items (id, company_id, order_id, sku, product_name, quantity, unit_price_tnd, total_price_tnd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'oit_' + crypto.randomBytes(6).toString('hex'),
              companyId,
              orderId,
              item.sku || 'SKU-WC',
              item.name,
              item.quantity,
              parseFloat(item.price) || 0,
              parseFloat(item.total) || 0,
            ]
          );
        }
      }

      // Status history
      execute(
        `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, reason)
         VALUES (?, ?, ?, 'new', 'to_confirm', 'Webhook WooCommerce synchronisé avec succès')`,
        ['osh_' + crypto.randomBytes(6).toString('hex'), companyId, orderId]
      );

      // Record webhook event for deduplication
      if (webhookEventId) {
        execute(
          `INSERT INTO webhook_events (id, company_id, provider, event_id, event_type, payload_json, signature_verified, status)
           VALUES (?, ?, 'woocommerce', ?, 'order.created', ?, 1, 'processed')`,
          ['wh_' + crypto.randomBytes(6).toString('hex'), companyId, webhookEventId, JSON.stringify({ id: wcOrder.id })]
        );
      }

      // Trigger Automations
      await AutomationEngine.evaluateOrderCreated(companyId, orderId);

      return { success: true, orderId };
    } catch (err: any) {
      console.error('WooCommerce webhook order error:', err);
      return { success: false, error: err.message };
    }
  }
}
