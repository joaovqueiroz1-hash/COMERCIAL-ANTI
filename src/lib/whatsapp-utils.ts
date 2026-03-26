// WhatsApp number validation for Brazilian numbers
// Valid formats: 11-13 digits (with country code) or 10-11 digits (without)
// Brazilian: +55 + 2-digit DDD + 8-9 digit number = 12-13 digits
// International: various formats

export interface WhatsAppValidation {
  isValid: boolean;
  warning: string | null;
  cleaned: string;
}

export function cleanWhatsAppNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[\s\-\(\)\+\.]/g, '');
}

export function validateWhatsApp(raw: string | null | undefined): WhatsAppValidation {
  if (!raw || !raw.trim()) {
    return { isValid: false, warning: 'Número não informado', cleaned: '' };
  }

  const cleaned = cleanWhatsAppNumber(raw);

  // Check if it contains non-numeric characters after cleaning
  if (/[^\d]/.test(cleaned)) {
    return { isValid: false, warning: 'Formato inválido (contém letras ou caracteres especiais)', cleaned };
  }

  // Too short (less than 8 digits)
  if (cleaned.length < 8) {
    return { isValid: false, warning: `Número muito curto (${cleaned.length} dígitos)`, cleaned };
  }

  // Too long (more than 15 digits - ITU max)
  if (cleaned.length > 15) {
    return { isValid: false, warning: `Número muito longo (${cleaned.length} dígitos)`, cleaned };
  }

  // Brazilian number with country code (55 + DDD + number)
  if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13) {
    return { isValid: true, warning: null, cleaned };
  }

  // Brazilian number without country code (DDD + number)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return { isValid: true, warning: null, cleaned };
  }

  // International numbers (starts with country code, 8-15 digits)
  if (cleaned.length >= 8 && cleaned.length <= 15) {
    // Could be valid international, but flag as needs review
    if (cleaned.length < 10 || cleaned.length > 13) {
      return { isValid: true, warning: `Verificar formato (${cleaned.length} dígitos)`, cleaned };
    }
    return { isValid: true, warning: null, cleaned };
  }

  return { isValid: false, warning: `Número com formato irregular (${cleaned.length} dígitos)`, cleaned };
}

export function normalizeWhatsAppKey(raw: string | null | undefined): string {
  const cleaned = cleanWhatsAppNumber(raw);
  // Remove country code 55 for deduplication
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned.substring(2);
  }
  return cleaned;
}
