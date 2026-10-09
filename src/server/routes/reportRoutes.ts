import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/reports/dashboard - Real, tenant-specific, database-derived metrics
router.get('/dashboard', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    // 1. Orders by Status
    const statusCounts = query<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM orders WHERE company_id = ? GROUP BY status',
      [tenantId]
    );

    const countsMap: Record<string, number> = {};
    let totalOrders = 0;
    statusCounts.forEach((s) => {
      countsMap[s.status] = s.count;
      totalOrders += s.count;
    });

    // 2. Orders today
    const ordersToday = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM orders WHERE company_id = ? AND date(created_at) = date('now')`,
      [tenantId]
    )?.count || 0;

    // 3. Financial totals
    const finance = queryOne<{ total_revenue: number; delivered_revenue: number }>(
      `SELECT SUM(total_tnd) as total_revenue,
              SUM(CASE WHEN status = 'delivered' THEN total_tnd ELSE 0 END) as delivered_revenue
       FROM orders WHERE company_id = ?`,
      [tenantId]
    );

    // 4. Delivery & Refusal Rates
    const deliveredCount = countsMap['delivered'] || 0;
    const refusedCount = countsMap['refused'] || 0;
    const returnedCount = countsMap['returned'] || 0;
    const terminalDeliveries = deliveredCount + refusedCount + returnedCount;

    const deliverySuccessRate = terminalDeliveries > 0 ? ((deliveredCount / terminalDeliveries) * 100).toFixed(1) : '100.0';
    const refusalRate = terminalDeliveries > 0 ? ((refusedCount / terminalDeliveries) * 100).toFixed(1) : '0.0';

    // 5. Customer & Inbox metrics
    const customerCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM customers WHERE company_id = ?',
      [tenantId]
    )?.count || 0;

    const openConversations = queryOne<{ count: number; unread: number }>(
      `SELECT COUNT(*) as count, SUM(unread_count) as unread
       FROM conversations WHERE company_id = ? AND status = 'open'`,
      [tenantId]
    );

    // 6. Breakdown by Tunisian Governorate
    const governorateStats = query<{ governorate: string; order_count: number; total_amount: number }>(
      `SELECT governorate, COUNT(*) as order_count, SUM(total_tnd) as total_amount
       FROM orders WHERE company_id = ?
       GROUP BY governorate ORDER BY order_count DESC LIMIT 10`,
      [tenantId]
    );

    // 7. Breakdown by Channel
    const channelStats = query<{ source_channel: string; count: number }>(
      'SELECT source_channel, COUNT(*) as count FROM orders WHERE company_id = ? GROUP BY source_channel',
      [tenantId]
    );

    // 8. Pending tasks
    const pendingTasks = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks WHERE company_id = ? AND status = "pending"',
      [tenantId]
    )?.count || 0;

    // 9. Integration health
    const integrations = query(
      'SELECT type, name, status, last_sync_at FROM integrations WHERE company_id = ?',
      [tenantId]
    );

    res.json({
      metrics: {
        totalOrders,
        ordersToday,
        toConfirm: countsMap['to_confirm'] || 0,
        confirmed: countsMap['confirmed'] || 0,
        preparing: countsMap['preparing'] || 0,
        shipped: countsMap['shipped'] || 0,
        delivered: deliveredCount,
        refused: refusedCount,
        returned: returnedCount,
        unreachable: countsMap['unreachable'] || 0,
        cancelled: countsMap['cancelled'] || 0,
        totalRevenueTnd: finance?.total_revenue || 0,
        deliveredRevenueTnd: finance?.delivered_revenue || 0,
        deliverySuccessRate: Number(deliverySuccessRate),
        refusalRate: Number(refusalRate),
        customerCount,
        openConversations: openConversations?.count || 0,
        unreadMessages: openConversations?.unread || 0,
        pendingTasks,
      },
      countsMap,
      governorateStats,
      channelStats,
      integrations,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
