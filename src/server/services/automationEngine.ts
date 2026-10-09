import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { WhatsAppService } from './whatsappService.js';

export interface AutomationRule {
  id: string;
  company_id: string;
  name: string;
  enabled: number;
  trigger_type: string;
  conditions_json: string;
  actions_json: string;
}

export class AutomationEngine {
  /**
   * Evaluates rules on order creation
   */
  static async evaluateOrderCreated(companyId: string, orderId: string): Promise<void> {
    const rules = query<AutomationRule>(
      'SELECT * FROM automation_rules WHERE company_id = ? AND enabled = 1 AND trigger_type = "order_created"',
      [companyId]
    );

    if (rules.length === 0) return;

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ? AND company_id = ?', [orderId, companyId]);
    if (!order) return;

    for (const rule of rules) {
      try {
        const conditions = JSON.parse(rule.conditions_json || '[]');
        if (this.matchConditions(order, conditions)) {
          const actions = JSON.parse(rule.actions_json || '[]');
          await this.executeActions(companyId, actions, { order });

          execute(
            `UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [rule.id]
          );

          execute(
            `INSERT INTO automation_executions (id, company_id, rule_id, trigger_event, status, execution_log)
             VALUES (?, ?, ?, 'order_created', 'success', ?)`,
            [
              'aex_' + crypto.randomBytes(6).toString('hex'),
              companyId,
              rule.id,
              JSON.stringify({ orderId, executedActions: actions.length }),
            ]
          );
        }
      } catch (err: any) {
        console.error(`Automation rule ${rule.id} failed:`, err);
        execute(
          `INSERT INTO automation_executions (id, company_id, rule_id, trigger_event, status, execution_log)
           VALUES (?, ?, ?, 'order_created', 'failed', ?)`,
          ['aex_' + crypto.randomBytes(6).toString('hex'), companyId, rule.id, err.message]
        );
      }
    }
  }

  /**
   * Evaluates rules on order status change
   */
  static async evaluateOrderStatusChanged(companyId: string, orderId: string, fromStatus: string, toStatus: string): Promise<void> {
    const rules = query<AutomationRule>(
      'SELECT * FROM automation_rules WHERE company_id = ? AND enabled = 1 AND trigger_type = "order_status_changed"',
      [companyId]
    );

    if (rules.length === 0) return;
    const order = queryOne<any>('SELECT * FROM orders WHERE id = ? AND company_id = ?', [orderId, companyId]);
    if (!order) return;

    for (const rule of rules) {
      try {
        const conditions = JSON.parse(rule.conditions_json || '[]');
        // Include fromStatus & toStatus in match scope
        const matchScope = { ...order, fromStatus, toStatus };
        if (this.matchConditions(matchScope, conditions)) {
          const actions = JSON.parse(rule.actions_json || '[]');
          await this.executeActions(companyId, actions, { order, fromStatus, toStatus });

          execute(
            `UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [rule.id]
          );

          execute(
            `INSERT INTO automation_executions (id, company_id, rule_id, trigger_event, status, execution_log)
             VALUES (?, ?, ?, 'order_status_changed', 'success', ?)`,
            [
              'aex_' + crypto.randomBytes(6).toString('hex'),
              companyId,
              rule.id,
              JSON.stringify({ orderId, fromStatus, toStatus }),
            ]
          );
        }
      } catch (err: any) {
        console.error(`Automation rule ${rule.id} failed:`, err);
      }
    }
  }

  private static matchConditions(data: any, conditions: any[]): boolean {
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    for (const c of conditions) {
      const val = data[c.field];
      if (c.operator === 'equals' && val != c.value) return false;
      if (c.operator === 'not_equals' && val == c.value) return false;
      if (c.operator === 'greater_than' && Number(val) <= Number(c.value)) return false;
      if (c.operator === 'less_than' && Number(val) >= Number(c.value)) return false;
    }
    return true;
  }

  private static async executeActions(companyId: string, actions: any[], context: any): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'create_task':
          execute(
            `INSERT INTO tasks (id, company_id, title, description, related_order_id, related_customer_id, priority)
             VALUES (?, ?, ?, ?, ?, ?, 'medium')`,
            [
              'tsk_' + crypto.randomBytes(6).toString('hex'),
              companyId,
              action.title || 'Tâche automatique',
              action.description || `Liée à la commande ${context.order?.id || ''}`,
              context.order?.id || null,
              context.order?.customer_id || null,
            ]
          );
          break;

        case 'set_order_status':
          if (context.order?.id && action.status) {
            execute(
              'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
              [action.status, context.order.id, companyId]
            );
          }
          break;

        case 'send_whatsapp_template':
          if (context.order?.customer_id && action.template_id) {
            // Find or create conversation
            let conv = queryOne<{ id: string }>(
              'SELECT id FROM conversations WHERE company_id = ? AND customer_id = ?',
              [companyId, context.order.customer_id]
            );
            let convId = conv?.id;
            if (!convId) {
              convId = 'cnv_' + crypto.randomBytes(6).toString('hex');
              execute(
                `INSERT INTO conversations (id, company_id, customer_id, channel, status)
                 VALUES (?, ?, ?, 'whatsapp', 'open')`,
                [convId, companyId, context.order.customer_id]
              );
            }
            await WhatsAppService.sendMessage({
              companyId,
              conversationId: convId,
              text: `[Modèle automatique #${action.template_id}]`,
              templateId: action.template_id,
              isMarketing: false,
            });
          }
          break;

        case 'add_customer_tag':
          if (context.order?.customer_id && action.tag) {
            const cst = queryOne<{ tags_json: string }>(
              'SELECT tags_json FROM customers WHERE id = ? AND company_id = ?',
              [context.order.customer_id, companyId]
            );
            if (cst) {
              const tags: string[] = JSON.parse(cst.tags_json || '[]');
              if (!tags.includes(action.tag)) {
                tags.push(action.tag);
                execute(
                  'UPDATE customers SET tags_json = ? WHERE id = ? AND company_id = ?',
                  [JSON.stringify(tags), context.order.customer_id, companyId]
                );
              }
            }
          }
          break;

        case 'notify_team':
          execute(
            `INSERT INTO notifications (id, company_id, title, message, link)
             VALUES (?, ?, ?, ?, ?)`,
            [
              'not_' + crypto.randomBytes(6).toString('hex'),
              companyId,
              action.title || 'Alerte Automatisation',
              action.message || 'Une règle automatique a été déclenchée',
              context.order ? `/orders?id=${context.order.id}` : '/orders',
            ]
          );
          break;
      }
    }
  }
}
