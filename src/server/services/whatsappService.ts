import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { normalizePhoneNumber } from './phoneNormalizer.js';

export interface WhatsAppConfig {
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  verifyToken?: string;
  appSecret?: string;
}

export class WhatsAppService {
  /**
   * Verifies incoming webhook signature using Meta's X-Hub-Signature-256 HMAC-SHA256
   */
  static verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
    if (!signatureHeader || !appSecret) return false;
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') return false;

    const signature = parts[1];
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
    } catch {
      return false;
    }
  }

  /**
   * Processes incoming Meta WhatsApp Cloud API Webhook payload
   */
  static async processWebhookPayload(companyId: string, payload: any): Promise<{ processed: boolean; error?: string }> {
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      if (!change) return { processed: false, error: 'Structure de payload invalide' };

      // 1. Process Messages
      if (change.messages && change.messages.length > 0) {
        for (const msg of change.messages) {
          const providerMsgId = msg.id;
          const fromRaw = msg.from;
          const text = msg.text?.body || (msg.type === 'interactive' ? msg.interactive?.button_reply?.title : `[Média: ${msg.type}]`);

          // Idempotency check via webhook_events
          const existingEvent = queryOne(
            'SELECT id FROM webhook_events WHERE company_id = ? AND provider = "whatsapp" AND event_id = ?',
            [companyId, providerMsgId]
          );
          if (existingEvent) {
            console.log(`WhatsApp event ${providerMsgId} already processed (idempotent skip)`);
            continue;
          }

          // Record webhook event
          execute(
            `INSERT INTO webhook_events (id, company_id, provider, event_id, event_type, payload_json, signature_verified, status)
             VALUES (?, ?, 'whatsapp', ?, 'message_received', ?, 1, 'processed')`,
            ['wh_' + crypto.randomBytes(6).toString('hex'), companyId, providerMsgId, JSON.stringify(msg)]
          );

          // Normalize customer phone
          const normPhone = normalizePhoneNumber(fromRaw);

          // Find or create customer
          let customer = queryOne<{ id: string; consent_status: string }>(
            'SELECT id, consent_status FROM customers WHERE company_id = ? AND phone_normalized = ?',
            [companyId, normPhone.normalized]
          );

          if (!customer) {
            const customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
            const contactName = change.contacts?.[0]?.profile?.name || `Client ${normPhone.formatted || fromRaw}`;
            execute(
              `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, acquisition_channel, consent_status)
               VALUES (?, ?, ?, ?, ?, 'whatsapp', 'opt_in')`,
              [customerId, companyId, contactName, fromRaw, normPhone.normalized]
            );
            customer = { id: customerId, consent_status: 'opt_in' };
          }

          // Check if opt-out requested (e.g. STOP or ARRET)
          const lowerText = (text || '').trim().toLowerCase();
          if (['stop', 'arret', 'arrêt', 'desabonner'].includes(lowerText)) {
            execute(
              'UPDATE customers SET consent_status = "opt_out", opt_out_at = CURRENT_TIMESTAMP WHERE id = ?',
              [customer.id]
            );
          }

          // Find or create conversation
          let conversation = queryOne<{ id: string; unread_count: number }>(
            'SELECT id, unread_count FROM conversations WHERE company_id = ? AND customer_id = ? AND channel = "whatsapp"',
            [companyId, customer.id]
          );

          let convId = conversation?.id;
          if (!convId) {
            convId = 'cnv_' + crypto.randomBytes(6).toString('hex');
            execute(
              `INSERT INTO conversations (id, company_id, customer_id, channel, status, last_message_text, last_message_at, unread_count)
               VALUES (?, ?, ?, 'whatsapp', 'open', ?, CURRENT_TIMESTAMP, 1)`,
              [convId, companyId, customer.id, text]
            );
          } else {
            execute(
              `UPDATE conversations
               SET status = 'open', last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, unread_count = unread_count + 1
               WHERE id = ?`,
              [text, convId]
            );
          }

          // Store message
          execute(
            `INSERT INTO messages (id, company_id, conversation_id, sender_type, channel, provider_message_id, text, status)
             VALUES (?, ?, ?, 'customer', 'whatsapp', ?, ?, 'delivered')`,
            ['msg_' + crypto.randomBytes(6).toString('hex'), companyId, convId, providerMsgId, text]
          );
        }
      }

      // 2. Process Status Updates (sent, delivered, read, failed)
      if (change.statuses && change.statuses.length > 0) {
        for (const st of change.statuses) {
          const providerMsgId = st.id;
          const status = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
          execute(
            'UPDATE messages SET status = ? WHERE company_id = ? AND provider_message_id = ?',
            [status, companyId, providerMsgId]
          );
        }
      }

      return { processed: true };
    } catch (err: any) {
      console.error('WhatsApp webhook processing error:', err);
      return { processed: false, error: err.message };
    }
  }

  /**
   * Sends an outbound WhatsApp message
   */
  static async sendMessage(params: {
    companyId: string;
    conversationId: string;
    text: string;
    senderUserId?: string;
    templateId?: string;
    isMarketing?: boolean;
  }): Promise<{ success: boolean; messageId?: string; error?: string; status?: string }> {
    const { companyId, conversationId, text, senderUserId, templateId, isMarketing } = params;

    const conv = queryOne<{ customer_id: string }>(
      'SELECT customer_id FROM conversations WHERE id = ? AND company_id = ?',
      [conversationId, companyId]
    );
    if (!conv) {
      return { success: false, error: 'Conversation introuvable' };
    }

    const customer = queryOne<{ phone_normalized: string; consent_status: string }>(
      'SELECT phone_normalized, consent_status FROM customers WHERE id = ? AND company_id = ?',
      [conv.customer_id, companyId]
    );
    if (!customer) {
      return { success: false, error: 'Client introuvable' };
    }

    // Check customer consent if marketing message
    if (isMarketing && customer.consent_status === 'opt_out') {
      return {
        success: false,
        error: 'Envoi bloqué : Le client a exercé son droit de refus (opt-out).',
      };
    }

    // Check integration credentials
    const integration = queryOne<{ credentials_json: string; status: string }>(
      'SELECT credentials_json, status FROM integrations WHERE company_id = ? AND type = "whatsapp"',
      [companyId]
    );

    const creds: WhatsAppConfig = integration?.credentials_json ? JSON.parse(integration.credentials_json) : {};
    const msgId = 'msg_' + crypto.randomBytes(6).toString('hex');

    // If real Meta credentials are configured, call Meta Cloud API
    if (creds.accessToken && creds.phoneNumberId) {
      try {
        const payload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: customer.phone_normalized.replace('+', ''),
        };

        if (templateId) {
          const tmpl = queryOne<{ name: string; language: string }>(
            'SELECT name, language FROM message_templates WHERE id = ? AND company_id = ?',
            [templateId, companyId]
          );
          payload.type = 'template';
          payload.template = {
            name: tmpl?.name || templateId,
            language: { code: tmpl?.language || 'fr' },
          };
        } else {
          payload.type = 'text';
          payload.text = { preview_url: false, body: text };
        }

        const response = await fetch(`https://graph.facebook.com/v20.0/${creds.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const respData = await response.json();
        if (!response.ok) {
          const errMsg = respData?.error?.message || 'Erreur API Meta WhatsApp';
          execute(
            `INSERT INTO messages (id, company_id, conversation_id, sender_type, sender_id, channel, text, status, error_reason)
             VALUES (?, ?, ?, 'agent', ?, 'whatsapp', ?, 'failed', ?)`,
            [msgId, companyId, conversationId, senderUserId || null, text, errMsg]
          );
          return { success: false, error: errMsg };
        }

        const providerMsgId = respData?.messages?.[0]?.id;
        execute(
          `INSERT INTO messages (id, company_id, conversation_id, sender_type, sender_id, channel, provider_message_id, text, status)
           VALUES (?, ?, ?, 'agent', ?, 'whatsapp', ?, ?, 'sent')`,
          [msgId, companyId, conversationId, senderUserId || null, providerMsgId, text]
        );

        execute(
          `UPDATE conversations SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [text, conversationId]
        );

        return { success: true, messageId: msgId, status: 'sent' };
      } catch (err: any) {
        return { success: false, error: `Échec réseau Meta API: ${err.message}` };
      }
    } else {
      // Integration not configured with active Meta Cloud API credentials
      // Return clear status rather than pretending it was delivered to WhatsApp
      execute(
        `INSERT INTO messages (id, company_id, conversation_id, sender_type, sender_id, channel, text, status, error_reason)
         VALUES (?, ?, ?, 'agent', ?, 'whatsapp', ?, 'queued', 'En attente de connexion WhatsApp Cloud API')`,
        [msgId, companyId, conversationId, senderUserId || null, text]
      );

      execute(
        `UPDATE conversations SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [text, conversationId]
      );

      return {
        success: true,
        messageId: msgId,
        status: 'queued',
        error: 'Message enregistré localement. La passerelle Meta WhatsApp Cloud API doit être configurée avec un Token valide pour la transmission réseau.',
      };
    }
  }
}
