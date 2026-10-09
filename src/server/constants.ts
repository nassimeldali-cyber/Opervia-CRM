// Constants for Tunisian E-Commerce and Global Configuration
export const TUNISIAN_GOVERNORATES = [
  'Ariana',
  'Béja',
  'Ben Arous',
  'Bizerte',
  'Gabès',
  'Gafsa',
  'Jendouba',
  'Kairouan',
  'Kasserine',
  'Kébili',
  'Le Kef',
  'Mahdia',
  'La Manouba',
  'Médenine',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sidi Bouzid',
  'Siliana',
  'Sousse',
  'Tataouine',
  'Tozeur',
  'Tunis',
  'Zaghouan',
] as const;

export type TunisianGovernorate = (typeof TUNISIAN_GOVERNORATES)[number];

export const ORDER_STATUSES = [
  'new',
  'to_confirm',
  'confirmed',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'unreachable',
  'cancelled',
  'refused',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { fr: string; en: string; ar: string; color: string }> = {
  new: { fr: 'Nouveau', en: 'New', ar: 'جديد', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  to_confirm: { fr: 'À Confirmer', en: 'To Confirm', ar: 'في انتظار التأكيد', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { fr: 'Confirmée', en: 'Confirmed', ar: 'مؤكدة', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  preparing: { fr: 'En préparation', en: 'Preparing', ar: 'قيد التحضير', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ready_to_ship: { fr: 'Prêt à expédier', en: 'Ready to ship', ar: 'جاهز للشحن', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  shipped: { fr: 'Expédiée', en: 'Shipped', ar: 'تم الشحن', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  delivered: { fr: 'Livrée', en: 'Delivered', ar: 'تم التسليم', color: 'bg-green-50 text-green-700 border-green-200' },
  unreachable: { fr: 'Injoignable', en: 'Unreachable', ar: 'لا يجيب', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { fr: 'Annulée', en: 'Cancelled', ar: 'ملغاة', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  refused: { fr: 'Refusée', en: 'Refused', ar: 'مرفوضة', color: 'bg-red-50 text-red-700 border-red-200' },
  returned: { fr: 'Retournée', en: 'Returned', ar: 'راجعة', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['to_confirm', 'confirmed', 'cancelled'],
  to_confirm: ['confirmed', 'unreachable', 'cancelled'],
  unreachable: ['to_confirm', 'confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refused', 'returned'],
  delivered: ['returned'], // Return after delivery
  refused: ['to_confirm', 'returned'], // Re-call attempt or return to stock
  returned: ['to_confirm'],
  cancelled: ['to_confirm'], // Supervisor reopen
};

export const USER_ROLES = ['owner', 'admin', 'agent', 'logistics'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUBSCRIPTION_PLANS = [
  {
    slug: 'starter_monthly',
    name: 'Starter Mensuel',
    priceEur: 49,
    priceTnd: 165,
    billingCycleMonths: 1,
    maxUsers: 3,
    maxStores: 1,
    maxWhatsappMessages: 1000,
    maxAutomations: 5,
    features: ['Commandes illimitées', 'WhatsApp Cloud API', '1 Boutique WooCommerce', '3 Utilisateurs', 'Support Email'],
  },
  {
    slug: 'pro_quarterly',
    name: 'Pro Trimestriel',
    priceEur: 129,
    priceTnd: 435,
    billingCycleMonths: 3,
    maxUsers: 7,
    maxStores: 3,
    maxWhatsappMessages: 5000,
    maxAutomations: 15,
    features: ['Toutes les fonctions Starter', '3 Boutiques connectées', '7 Utilisateurs', 'Automatisations avancées', 'Rapports de livraison COD'],
  },
  {
    slug: 'growth_biannual',
    name: 'Croissance Semestriel',
    priceEur: 229,
    priceTnd: 770,
    billingCycleMonths: 6,
    maxUsers: 15,
    maxStores: 6,
    maxWhatsappMessages: 15000,
    maxAutomations: 30,
    features: ['Toutes les fonctions Pro', '6 Boutiques connectées', '15 Utilisateurs', 'Campagnes WhatsApp ciblées', 'Support prioritaire WhatsApp'],
  },
  {
    slug: 'enterprise_annual',
    name: 'Entreprise Annuel',
    priceEur: 399,
    priceTnd: 1350,
    billingCycleMonths: 12,
    maxUsers: 50,
    maxStores: 20,
    maxWhatsappMessages: 50000,
    maxAutomations: 100,
    features: ['Accès illimité multi-boutiques', '50 Utilisateurs', 'Campagnes de masse', 'Gestionnaire de compte dédié', 'API Webhook sur mesure', 'Économie de 32%'],
  },
];
