import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/products
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM products WHERE company_id = ?';
    const params: any[] = [req.tenantId];

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const products = query(sql, params);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sku, price_tnd, cost_tnd = 0, stock_quantity = 0, description, image_url } = req.body;
    if (!name || price_tnd === undefined) {
      res.status(400).json({ error: 'Nom du produit et prix en TND requis.' });
      return;
    }

    const productId = 'prd_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO products (
        id, company_id, sku, name, description, image_url, price_tnd, cost_tnd, stock_quantity, track_inventory, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        productId,
        req.tenantId,
        sku || 'SKU-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        name.trim(),
        description || '',
        image_url || '',
        Number(price_tnd),
        Number(cost_tnd),
        Number(stock_quantity),
      ]
    );

    res.status(201).json({ message: 'Produit créé avec succès', productId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sku, price_tnd, cost_tnd, stock_quantity, is_active, description } = req.body;
    execute(
      `UPDATE products
       SET name = COALESCE(?, name),
           sku = COALESCE(?, sku),
           price_tnd = COALESCE(?, price_tnd),
           cost_tnd = COALESCE(?, cost_tnd),
           stock_quantity = COALESCE(?, stock_quantity),
           is_active = COALESCE(?, is_active),
           description = COALESCE(?, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [name, sku, price_tnd, cost_tnd, stock_quantity, is_active, description, req.params.id, req.tenantId]
    );

    res.json({ message: 'Produit mis à jour avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    execute('DELETE FROM products WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    res.json({ message: 'Produit supprimé.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
