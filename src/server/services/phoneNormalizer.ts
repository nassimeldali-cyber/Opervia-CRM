/**
 * Normalizes phone numbers specifically for Tunisian e-commerce and international E.164 standards.
 * Tunisian numbers have 8 digits starting with 2, 4, 5, 7, or 9.
 */
export function normalizePhoneNumber(rawPhone: string | null | undefined): {
  normalized: string;
  isValid: boolean;
  country: string;
  formatted: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { normalized: '', isValid: false, country: 'UNKNOWN', formatted: '' };
  }

  // Remove spaces, dashes, dots, parentheses, slashes
  let cleaned = rawPhone.replace(/[\s\-\.\(\)\/]/g, '').trim();

  // If starts with 00216, replace with +216
  if (cleaned.startsWith('00216')) {
    cleaned = '+216' + cleaned.slice(5);
  } else if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If starts with 216 without +, add +
  if (cleaned.startsWith('216') && cleaned.length === 11) {
    cleaned = '+' + cleaned;
  }

  // Handle local 8-digit Tunisian number: e.g. 98123456 or 20123456
  const tunisian8DigitRegex = /^[24579]\d{7}$/;
  if (tunisian8DigitRegex.test(cleaned)) {
    cleaned = '+216' + cleaned;
  }

  // If local number with leading zero e.g. 098123456 (9 digits)
  if (cleaned.startsWith('0') && cleaned.length === 9 && tunisian8DigitRegex.test(cleaned.slice(1))) {
    cleaned = '+216' + cleaned.slice(1);
  }

  // Validation
  const isTunisian = /^\+216[24579]\d{7}$/.test(cleaned);
  const isInternational = /^\+[1-9]\d{6,14}$/.test(cleaned);

  if (isTunisian) {
    // Format Tunisian nicely: +216 98 123 456
    const national = cleaned.slice(4);
    const formatted = `+216 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
    return {
      normalized: cleaned,
      isValid: true,
      country: 'TN',
      formatted,
    };
  }

  if (isInternational) {
    return {
      normalized: cleaned,
      isValid: true,
      country: cleaned.startsWith('+33') ? 'FR' : cleaned.startsWith('+213') ? 'DZ' : cleaned.startsWith('+212') ? 'MA' : 'INTL',
      formatted: cleaned,
    };
  }

  return {
    normalized: cleaned,
    isValid: false,
    country: 'UNKNOWN',
    formatted: cleaned,
  };
}
