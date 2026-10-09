import { Router, Response } from 'express';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { WhatsAppService } from '../services/whatsappService.js';

const router = Router();

// GET /api/conversations - list conversations
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, channel, search } = req.query;

    let sql = `
      SELECT c.*, cust.full_name as customer_name, cust.phone as customer_phone,
             cust.phone_normalized as customer_norm_phone, cust.governorate,
             u.full_name as assigned_agent_name
      FROM conversations c
      JOIN customers cust ON cust.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_agent_id
      WHERE c.company_id = ?
    `;
    const params: any[] = [req.tenantId];

    if (status && status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    if (channel && channel !== 'all') {
      sql += ' AND c.channel = ?';
      params.push(channel);
    }

    if (search) {
      sql += ' AND (cust.full_name LIKE ? OR cust.phone LIKE ? OR c.last_message_text LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY c.last_message_at DESC';
    const conversations = query(sql, params);
    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const conv = queryOne('SELECT * FROM conversations WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    if (!conv) {
      res.status(404).json({ error: 'Conversation introuvable.' });
      return;
    }

    // Mark as read
    execute('UPDATE conversations SET unread_count = 0 WHERE id = ?', [req.params.id]);

    const messages = query(
      `SELECT m.*, u.full_name as sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.company_id = ?
       ORDER BY m.created_at ASC`,
      [req.params.id, req.tenantId]
    );

    const customer = queryOne('SELECT * FROM customers WHERE id = ? AND company_id = ?', [conv.customer_id, req.tenantId]);
    const orders = query('SELECT * FROM orders WHERE customer_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 5', [conv.customer_id, req.tenantId]);

    res.json({ conversation: conv, customer, orders, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/:id/messages - send reply
router.post('/:id/messages', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, template_id } = req.body;
    if (!text && !template_id) {
      res.status(400).json({ error: 'Le contenu du message ou un modèle WhatsApp est requis.' });
      return;
    }

    const result = await WhatsAppService.sendMessage({
      companyId: req.tenantId!,
      conversationId: req.params.id,
      text: text || '',
      templateId: template_id,
      senderUserId: req.user!.id,
      isMarketing: false,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      message: 'Message transmis',
      messageId: result.messageId,
      status: result.status,
      notice: result.error, // Informational notice if queued locally pending credentials
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['open', 'pending', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }

    execute('UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?', [status, req.params.id, req.tenantId]);
    res.json({ message: 'Statut de conversation mis à jour.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assigned_agent_id } = req.body;
    execute('UPDATE conversations SET assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?', [assigned_agent_id || null, req.params.id, req.tenantId]);
    res.json({ message: 'Conversation assignée.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
