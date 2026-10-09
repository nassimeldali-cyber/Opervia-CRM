import { execute, query, queryOne } from '../db/database.js';
import { WhatsAppService } from './whatsappService.js';

export interface BackgroundJob {
  id: string;
  company_id: string;
  job_type: string;
  payload_json: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

export class BackgroundWorker {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;

  static start(intervalMs: number = 10000): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => {
      this.processNextJobs().catch((err) => console.error('Background worker iteration error:', err));
    }, intervalMs);
    console.log(`Background worker queue started (interval: ${intervalMs}ms)`);
  }

  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  static async enqueue(companyId: string, jobType: string, payload: any, maxAttempts = 3): Promise<string> {
    const jobId = 'job_' + Math.random().toString(36).substring(2, 10);
    execute(
      `INSERT INTO background_jobs (id, company_id, job_type, payload_json, status, max_attempts)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [jobId, companyId, jobType, JSON.stringify(payload), maxAttempts]
    );
    return jobId;
  }

  static async processNextJobs(limit: number = 5): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;

    try {
      const jobs = query<BackgroundJob>(
        `SELECT * FROM background_jobs
         WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= CURRENT_TIMESTAMP)
         ORDER BY created_at ASC LIMIT ?`,
        [limit]
      );

      for (const job of jobs) {
        await this.executeJob(job);
      }

      return jobs.length;
    } finally {
      this.isRunning = false;
    }
  }

  private static async executeJob(job: BackgroundJob): Promise<void> {
    execute('UPDATE background_jobs SET status = "processing", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [job.id]);
    const payload = JSON.parse(job.payload_json || '{}');

    try {
      switch (job.job_type) {
        case 'send_campaign_batch': {
          const { campaignId, recipientIds } = payload;
          const campaign = queryOne<{ template_id: string }>(
            'SELECT template_id FROM campaigns WHERE id = ? AND company_id = ?',
            [campaignId, job.company_id]
          );

          if (!campaign) throw new Error('Campagne introuvable');

          for (const recId of recipientIds || []) {
            const recipient = queryOne<{ customer_id: string; phone: string }>(
              'SELECT customer_id, phone FROM campaign_recipients WHERE id = ?',
              [recId]
            );
            if (!recipient) continue;

            // Check consent
            const customer = queryOne<{ consent_status: string }>(
              'SELECT consent_status FROM customers WHERE id = ?',
              [recipient.customer_id]
            );

            if (customer?.consent_status === 'opt_out') {
              execute(
                'UPDATE campaign_recipients SET status = "opted_out", error_message = "Client désabonné" WHERE id = ?',
                [recId]
              );
              continue;
            }

            // Find or create conversation
            let conv = queryOne<{ id: string }>('SELECT id FROM conversations WHERE customer_id = ?', [recipient.customer_id]);
            let convId = conv?.id;
            if (!convId) {
              convId = 'cnv_' + Math.random().toString(36).substring(2, 9);
              execute(
                'INSERT INTO conversations (id, company_id, customer_id, channel, status) VALUES (?, ?, ?, "whatsapp", "open")',
                [convId, job.company_id, recipient.customer_id]
              );
            }

            const sendRes = await WhatsAppService.sendMessage({
              companyId: job.company_id,
              conversationId: convId,
              text: `[Campagne #${campaignId}]`,
              templateId: campaign.template_id,
              isMarketing: true,
            });

            if (sendRes.success) {
              execute('UPDATE campaign_recipients SET status = "sent", sent_at = CURRENT_TIMESTAMP WHERE id = ?', [recId]);
              execute('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?', [campaignId]);
            } else {
              execute('UPDATE campaign_recipients SET status = "failed", error_message = ? WHERE id = ?', [sendRes.error, recId]);
              execute('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?', [campaignId]);
            }
          }
          break;
        }

        case 'order_to_confirm_monitor': {
          // Identify orders awaiting confirmation for > 2 hours and generate a reminder task
          const stalledOrders = query<{ id: string; customer_name: string; customer_phone: string }>(
            `SELECT id, customer_name, customer_phone FROM orders
             WHERE company_id = ? AND status = 'to_confirm' AND datetime(created_at, '+2 hours') <= datetime('now')`,
            [job.company_id]
          );

          for (const ord of stalledOrders) {
            const existingTask = queryOne(
              'SELECT id FROM tasks WHERE company_id = ? AND related_order_id = ? AND title LIKE "%Rappel confirmation%"',
              [job.company_id, ord.id]
            );
            if (!existingTask) {
              execute(
                `INSERT INTO tasks (id, company_id, title, description, related_order_id, priority)
                 VALUES (?, ?, ?, ?, ?, 'high')`,
                [
                  'tsk_' + Math.random().toString(36).substring(2, 9),
                  job.company_id,
                  `Rappel confirmation commande ${ord.id}`,
                  `Commande en attente depuis > 2h pour ${ord.customer_name} (${ord.customer_phone})`,
                  ord.id,
                ]
              );
            }
          }
          break;
        }

        default:
          console.log(`Unknown job type: ${job.job_type}`);
      }

      execute('UPDATE background_jobs SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [job.id]);
    } catch (err: any) {
      const attempts = job.attempts + 1;
      const hasMoreAttempts = attempts < job.max_attempts;
      const status = hasMoreAttempts ? 'pending' : 'failed';
      // Exponential backoff
      const backoffMinutes = Math.pow(2, attempts);

      execute(
        `UPDATE background_jobs
         SET attempts = ?, status = ?, error_message = ?,
             next_run_at = datetime('now', '+${backoffMinutes} minutes'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [attempts, status, err.message, job.id]
      );
    }
  }
}
