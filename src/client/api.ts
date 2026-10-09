/**
 * Opervia API Client
 * Manages authentication, active tenant header, and request lifecycle.
 */

const TOKEN_KEY = 'opervia_token';
const TENANT_KEY = 'opervia_active_tenant_id';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  status: string;
  role?: string;
}

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
  },

  getActiveTenantId(): string | null {
    return localStorage.getItem(TENANT_KEY);
  },

  setActiveTenantId(id: string): void {
    localStorage.setItem(TENANT_KEY, id);
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const tenantId = this.getActiveTenantId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // If unauthorized, do not throw silently if logging in
      if (!endpoint.includes('/api/auth/login')) {
        this.clearToken();
        window.location.reload();
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Erreur serveur (${response.status})`);
    }

    return data as T;
  },

  get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  },
};
