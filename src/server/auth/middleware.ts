import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'opervia_production_hmac_secret_2026_default';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
  tenantRole?: 'owner' | 'admin' | 'agent' | 'logistics';
  company?: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    status: string;
  };
}

export function generateToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Middleware: Requires a valid authenticated user token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: "Accès non autorisé : Token d'authentification requis" });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
    return;
  }

  const user = queryOne<AuthUser>(
    'SELECT id, email, full_name, is_superadmin FROM users WHERE id = ?',
    [decoded.userId]
  );

  if (!user) {
    res.status(401).json({ error: 'Compte utilisateur introuvable.' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware: Requires tenant membership and enforces tenant isolation
 */
export function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }

  // Tenant can be specified via x-tenant-id header or req.params.tenantId or query
  const requestedTenantId =
    (req.headers['x-tenant-id'] as string) ||
    req.params.tenantId ||
    (req.query.tenantId as string);

  if (req.user.is_superadmin && requestedTenantId) {
    // SuperAdmin accessing tenant data in authorized support mode
    const company = queryOne(
      'SELECT id, name, slug, currency, status FROM companies WHERE id = ?',
      [requestedTenantId]
    );
    if (!company) {
      res.status(404).json({ error: 'Entreprise introuvable' });
      return;
    }
    req.tenantId = company.id;
    req.tenantRole = 'owner';
    req.company = company;
    next();
    return;
  }

  if (requestedTenantId) {
    // Verify membership in specified company
    const membership = queryOne<{ role: string; status: string }>(
      'SELECT role, status FROM company_memberships WHERE company_id = ? AND user_id = ?',
      [requestedTenantId, req.user.id]
    );

    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'Accès interdit : Vous ne faites pas partie de cette entreprise.' });
      return;
    }

    const company = queryOne(
      'SELECT id, name, slug, currency, status FROM companies WHERE id = ?',
      [requestedTenantId]
    );

    if (!company || company.status === 'suspended') {
      res.status(403).json({ error: 'Cette entreprise est actuellement suspendue. Contactez le support.' });
      return;
    }

    req.tenantId = company.id;
    req.tenantRole = membership.role as any;
    req.company = company;
    next();
    return;
  }

  // If no tenant specified, find user's first active company membership
  const firstMembership = queryOne<{ company_id: string; role: string }>(
    `SELECT cm.company_id, cm.role, c.id, c.name, c.slug, c.currency, c.status
     FROM company_memberships cm
     JOIN companies c ON c.id = cm.company_id
     WHERE cm.user_id = ? AND cm.status = 'active' AND c.status = 'active'
     LIMIT 1`,
    [req.user.id]
  );

  if (!firstMembership) {
    res.status(400).json({
      error: 'Aucune entreprise active associée à ce compte. Veuillez créer votre entreprise.',
      needsOnboarding: true,
    });
    return;
  }

  req.tenantId = firstMembership.company_id;
  req.tenantRole = firstMembership.role as any;
  req.company = {
    id: firstMembership.company_id,
    name: (firstMembership as any).name,
    slug: (firstMembership as any).slug,
    currency: (firstMembership as any).currency,
    status: (firstMembership as any).status,
  };
  next();
}

/**
 * Middleware: Role authorization guard
 */
export function requireRoles(allowedRoles: Array<'owner' | 'admin' | 'agent' | 'logistics'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (req.user?.is_superadmin) {
      next();
      return;
    }

    if (!req.tenantRole || !allowedRoles.includes(req.tenantRole)) {
      res.status(403).json({
        error: `Action non autorisée. Votre rôle (${req.tenantRole || 'aucun'}) ne possède pas les permissions requises.`,
      });
      return;
    }
    next();
  };
}

/**
 * Middleware: SuperAdmin only guard
 */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.is_superadmin) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs de la plateforme Opervia.' });
    return;
  }
  next();
}
