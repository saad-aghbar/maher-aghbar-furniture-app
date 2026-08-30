/**
 * Common international dialing codes for phone country pickers.
 * `dial` is digits only (no +). Sorted by English name for search lists.
 */
export type CountryDial = {
  iso2: string;
  dial: string;
  name: string;
  flag: string;
};

export const COUNTRY_DIAL_CODES: CountryDial[] = [
  { iso2: 'AF', dial: '93', name: 'Afghanistan', flag: '🇦🇫' },
  { iso2: 'AL', dial: '355', name: 'Albania', flag: '🇦🇱' },
  { iso2: 'DZ', dial: '213', name: 'Algeria', flag: '🇩🇿' },
  { iso2: 'AD', dial: '376', name: 'Andorra', flag: '🇦🇩' },
  { iso2: 'AO', dial: '244', name: 'Angola', flag: '🇦🇴' },
  { iso2: 'AR', dial: '54', name: 'Argentina', flag: '🇦🇷' },
  { iso2: 'AM', dial: '374', name: 'Armenia', flag: '🇦🇲' },
  { iso2: 'AU', dial: '61', name: 'Australia', flag: '🇦🇺' },
  { iso2: 'AT', dial: '43', name: 'Austria', flag: '🇦🇹' },
  { iso2: 'AZ', dial: '994', name: 'Azerbaijan', flag: '🇦🇿' },
  { iso2: 'BH', dial: '973', name: 'Bahrain', flag: '🇧🇭' },
  { iso2: 'BD', dial: '880', name: 'Bangladesh', flag: '🇧🇩' },
  { iso2: 'BY', dial: '375', name: 'Belarus', flag: '🇧🇾' },
  { iso2: 'BE', dial: '32', name: 'Belgium', flag: '🇧🇪' },
  { iso2: 'BZ', dial: '501', name: 'Belize', flag: '🇧🇿' },
  { iso2: 'BJ', dial: '229', name: 'Benin', flag: '🇧🇯' },
  { iso2: 'BO', dial: '591', name: 'Bolivia', flag: '🇧🇴' },
  { iso2: 'BA', dial: '387', name: 'Bosnia', flag: '🇧🇦' },
  { iso2: 'BR', dial: '55', name: 'Brazil', flag: '🇧🇷' },
  { iso2: 'BN', dial: '673', name: 'Brunei', flag: '🇧🇳' },
  { iso2: 'BG', dial: '359', name: 'Bulgaria', flag: '🇧🇬' },
  { iso2: 'KH', dial: '855', name: 'Cambodia', flag: '🇰🇭' },
  { iso2: 'CM', dial: '237', name: 'Cameroon', flag: '🇨🇲' },
  { iso2: 'CA', dial: '1', name: 'Canada', flag: '🇨🇦' },
  { iso2: 'CL', dial: '56', name: 'Chile', flag: '🇨🇱' },
  { iso2: 'CN', dial: '86', name: 'China', flag: '🇨🇳' },
  { iso2: 'CO', dial: '57', name: 'Colombia', flag: '🇨🇴' },
  { iso2: 'CR', dial: '506', name: 'Costa Rica', flag: '🇨🇷' },
  { iso2: 'HR', dial: '385', name: 'Croatia', flag: '🇭🇷' },
  { iso2: 'CU', dial: '53', name: 'Cuba', flag: '🇨🇺' },
  { iso2: 'CY', dial: '357', name: 'Cyprus', flag: '🇨🇾' },
  { iso2: 'CZ', dial: '420', name: 'Czechia', flag: '🇨🇿' },
  { iso2: 'DK', dial: '45', name: 'Denmark', flag: '🇩🇰' },
  { iso2: 'DJ', dial: '253', name: 'Djibouti', flag: '🇩🇯' },
  { iso2: 'DO', dial: '1', name: 'Dominican Republic', flag: '🇩🇴' },
  { iso2: 'EC', dial: '593', name: 'Ecuador', flag: '🇪🇨' },
  { iso2: 'EG', dial: '20', name: 'Egypt', flag: '🇪🇬' },
  { iso2: 'SV', dial: '503', name: 'El Salvador', flag: '🇸🇻' },
  { iso2: 'EE', dial: '372', name: 'Estonia', flag: '🇪🇪' },
  { iso2: 'ET', dial: '251', name: 'Ethiopia', flag: '🇪🇹' },
  { iso2: 'FI', dial: '358', name: 'Finland', flag: '🇫🇮' },
  { iso2: 'FR', dial: '33', name: 'France', flag: '🇫🇷' },
  { iso2: 'GE', dial: '995', name: 'Georgia', flag: '🇬🇪' },
  { iso2: 'DE', dial: '49', name: 'Germany', flag: '🇩🇪' },
  { iso2: 'GH', dial: '233', name: 'Ghana', flag: '🇬🇭' },
  { iso2: 'GR', dial: '30', name: 'Greece', flag: '🇬🇷' },
  { iso2: 'GT', dial: '502', name: 'Guatemala', flag: '🇬🇹' },
  { iso2: 'HN', dial: '504', name: 'Honduras', flag: '🇭🇳' },
  { iso2: 'HK', dial: '852', name: 'Hong Kong', flag: '🇭🇰' },
  { iso2: 'HU', dial: '36', name: 'Hungary', flag: '🇭🇺' },
  { iso2: 'IS', dial: '354', name: 'Iceland', flag: '🇮🇸' },
  { iso2: 'IN', dial: '91', name: 'India', flag: '🇮🇳' },
  { iso2: 'ID', dial: '62', name: 'Indonesia', flag: '🇮🇩' },
  { iso2: 'IR', dial: '98', name: 'Iran', flag: '🇮🇷' },
  { iso2: 'IQ', dial: '964', name: 'Iraq', flag: '🇮🇶' },
  { iso2: 'IE', dial: '353', name: 'Ireland', flag: '🇮🇪' },
  { iso2: 'IL', dial: '972', name: 'Israel', flag: '🇮🇱' },
  { iso2: 'IT', dial: '39', name: 'Italy', flag: '🇮🇹' },
  { iso2: 'CI', dial: '225', name: 'Ivory Coast', flag: '🇨🇮' },
  { iso2: 'JM', dial: '1', name: 'Jamaica', flag: '🇯🇲' },
  { iso2: 'JP', dial: '81', name: 'Japan', flag: '🇯🇵' },
  { iso2: 'JO', dial: '962', name: 'Jordan', flag: '🇯🇴' },
  { iso2: 'KZ', dial: '7', name: 'Kazakhstan', flag: '🇰🇿' },
  { iso2: 'KE', dial: '254', name: 'Kenya', flag: '🇰🇪' },
  { iso2: 'KW', dial: '965', name: 'Kuwait', flag: '🇰🇼' },
  { iso2: 'KG', dial: '996', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { iso2: 'LV', dial: '371', name: 'Latvia', flag: '🇱🇻' },
  { iso2: 'LB', dial: '961', name: 'Lebanon', flag: '🇱🇧' },
  { iso2: 'LY', dial: '218', name: 'Libya', flag: '🇱🇾' },
  { iso2: 'LT', dial: '370', name: 'Lithuania', flag: '🇱🇹' },
  { iso2: 'LU', dial: '352', name: 'Luxembourg', flag: '🇱🇺' },
  { iso2: 'MO', dial: '853', name: 'Macau', flag: '🇲🇴' },
  { iso2: 'MY', dial: '60', name: 'Malaysia', flag: '🇲🇾' },
  { iso2: 'MV', dial: '960', name: 'Maldives', flag: '🇲🇻' },
  { iso2: 'MT', dial: '356', name: 'Malta', flag: '🇲🇹' },
  { iso2: 'MX', dial: '52', name: 'Mexico', flag: '🇲🇽' },
  { iso2: 'MD', dial: '373', name: 'Moldova', flag: '🇲🇩' },
  { iso2: 'MC', dial: '377', name: 'Monaco', flag: '🇲🇨' },
  { iso2: 'MN', dial: '976', name: 'Mongolia', flag: '🇲🇳' },
  { iso2: 'ME', dial: '382', name: 'Montenegro', flag: '🇲🇪' },
  { iso2: 'MA', dial: '212', name: 'Morocco', flag: '🇲🇦' },
  { iso2: 'MZ', dial: '258', name: 'Mozambique', flag: '🇲🇿' },
  { iso2: 'MM', dial: '95', name: 'Myanmar', flag: '🇲🇲' },
  { iso2: 'NP', dial: '977', name: 'Nepal', flag: '🇳🇵' },
  { iso2: 'NL', dial: '31', name: 'Netherlands', flag: '🇳🇱' },
  { iso2: 'NZ', dial: '64', name: 'New Zealand', flag: '🇳🇿' },
  { iso2: 'NI', dial: '505', name: 'Nicaragua', flag: '🇳🇮' },
  { iso2: 'NG', dial: '234', name: 'Nigeria', flag: '🇳🇬' },
  { iso2: 'MK', dial: '389', name: 'North Macedonia', flag: '🇲🇰' },
  { iso2: 'NO', dial: '47', name: 'Norway', flag: '🇳🇴' },
  { iso2: 'OM', dial: '968', name: 'Oman', flag: '🇴🇲' },
  { iso2: 'PK', dial: '92', name: 'Pakistan', flag: '🇵🇰' },
  { iso2: 'PS', dial: '970', name: 'Palestine', flag: '🇵🇸' },
  { iso2: 'PA', dial: '507', name: 'Panama', flag: '🇵🇦' },
  { iso2: 'PY', dial: '595', name: 'Paraguay', flag: '🇵🇾' },
  { iso2: 'PE', dial: '51', name: 'Peru', flag: '🇵🇪' },
  { iso2: 'PH', dial: '63', name: 'Philippines', flag: '🇵🇭' },
  { iso2: 'PL', dial: '48', name: 'Poland', flag: '🇵🇱' },
  { iso2: 'PT', dial: '351', name: 'Portugal', flag: '🇵🇹' },
  { iso2: 'QA', dial: '974', name: 'Qatar', flag: '🇶🇦' },
  { iso2: 'RO', dial: '40', name: 'Romania', flag: '🇷🇴' },
  { iso2: 'RU', dial: '7', name: 'Russia', flag: '🇷🇺' },
  { iso2: 'RW', dial: '250', name: 'Rwanda', flag: '🇷🇼' },
  { iso2: 'SA', dial: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { iso2: 'SN', dial: '221', name: 'Senegal', flag: '🇸🇳' },
  { iso2: 'RS', dial: '381', name: 'Serbia', flag: '🇷🇸' },
  { iso2: 'SG', dial: '65', name: 'Singapore', flag: '🇸🇬' },
  { iso2: 'SK', dial: '421', name: 'Slovakia', flag: '🇸🇰' },
  { iso2: 'SI', dial: '386', name: 'Slovenia', flag: '🇸🇮' },
  { iso2: 'ZA', dial: '27', name: 'South Africa', flag: '🇿🇦' },
  { iso2: 'KR', dial: '82', name: 'South Korea', flag: '🇰🇷' },
  { iso2: 'ES', dial: '34', name: 'Spain', flag: '🇪🇸' },
  { iso2: 'LK', dial: '94', name: 'Sri Lanka', flag: '🇱🇰' },
  { iso2: 'SD', dial: '249', name: 'Sudan', flag: '🇸🇩' },
  { iso2: 'SE', dial: '46', name: 'Sweden', flag: '🇸🇪' },
  { iso2: 'CH', dial: '41', name: 'Switzerland', flag: '🇨🇭' },
  { iso2: 'SY', dial: '963', name: 'Syria', flag: '🇸🇾' },
  { iso2: 'TW', dial: '886', name: 'Taiwan', flag: '🇹🇼' },
  { iso2: 'TJ', dial: '992', name: 'Tajikistan', flag: '🇹🇯' },
  { iso2: 'TZ', dial: '255', name: 'Tanzania', flag: '🇹🇿' },
  { iso2: 'TH', dial: '66', name: 'Thailand', flag: '🇹🇭' },
  { iso2: 'TN', dial: '216', name: 'Tunisia', flag: '🇹🇳' },
  { iso2: 'TR', dial: '90', name: 'Turkey', flag: '🇹🇷' },
  { iso2: 'TM', dial: '993', name: 'Turkmenistan', flag: '🇹🇲' },
  { iso2: 'UA', dial: '380', name: 'Ukraine', flag: '🇺🇦' },
  { iso2: 'AE', dial: '971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { iso2: 'GB', dial: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { iso2: 'US', dial: '1', name: 'United States', flag: '🇺🇸' },
  { iso2: 'UY', dial: '598', name: 'Uruguay', flag: '🇺🇾' },
  { iso2: 'UZ', dial: '998', name: 'Uzbekistan', flag: '🇺🇿' },
  { iso2: 'VE', dial: '58', name: 'Venezuela', flag: '🇻🇪' },
  { iso2: 'VN', dial: '84', name: 'Vietnam', flag: '🇻🇳' },
  { iso2: 'YE', dial: '967', name: 'Yemen', flag: '🇾🇪' },
  { iso2: 'ZM', dial: '260', name: 'Zambia', flag: '🇿🇲' },
  { iso2: 'ZW', dial: '263', name: 'Zimbabwe', flag: '🇿🇼' },
].sort((a, b) => a.name.localeCompare(b.name));

/** Default for this product region (Palestine +970). */
export const DEFAULT_DIAL_ISO2 = 'PS';

const DIAL_BY_LENGTH = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dial.length - a.dial.length,
);

export function findCountryByIso2(iso2: string): CountryDial | undefined {
  return COUNTRY_DIAL_CODES.find((c) => c.iso2 === iso2);
}

export function findCountryByDial(dial: string): CountryDial | undefined {
  const digits = dial.replace(/\D/g, '');
  return DIAL_BY_LENGTH.find((c) => c.dial === digits);
}

export function defaultCountry(): CountryDial {
  return findCountryByIso2(DEFAULT_DIAL_ISO2) ?? COUNTRY_DIAL_CODES[0]!;
}

/** Digits only national number (no leading 0 preferred for E.164 join). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatInternational(dial: string, national: string): string {
  const d = digitsOnly(dial);
  let n = digitsOnly(national);
  // Drop a single leading 0 on national numbers (common trunk prefix).
  if (n.startsWith('0')) n = n.slice(1);
  // Dial alone is not a phone number — country is chosen in the picker.
  if (!n) return '';
  if (!d) return n;
  return `+${d}${n}`;
}

/**
 * Normalize any stored / typed phone into E.164 using the dial picker rules.
 * Returns '' when there is no national number yet.
 */
export function toE164Phone(
  raw: string | null | undefined,
  fallback: CountryDial = defaultCountry(),
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const { country, national } = parsePhoneValue(trimmed, fallback);
  return formatInternational(country.dial, national);
}

/** Full E.164: + then 8–15 digits (country already from picker). */
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function isValidE164Phone(raw: string | null | undefined): boolean {
  const e164 = toE164Phone(raw);
  return e164.length > 0 && E164_RE.test(e164);
}

/** Empty / dial-only is ok; otherwise must be valid E.164. */
export function isValidOptionalE164Phone(raw: string | null | undefined): boolean {
  const e164 = toE164Phone(raw);
  if (!e164) return true;
  return E164_RE.test(e164);
}

/**
 * Split a stored phone into dial country + national remainder.
 * Prefers longest matching dial prefix when the value starts with +.
 */
export function parsePhoneValue(
  value: string | null | undefined,
  fallback: CountryDial = defaultCountry(),
): { country: CountryDial; national: string } {
  const raw = (value ?? '').trim();
  if (!raw) return { country: fallback, national: '' };

  const hasPlus = raw.startsWith('+');
  const digits = digitsOnly(raw);
  if (!digits) return { country: fallback, national: '' };

  if (hasPlus || digits.length >= 8) {
    const match = DIAL_BY_LENGTH.find((c) => digits.startsWith(c.dial));
    if (match) {
      return { country: match, national: digits.slice(match.dial.length) };
    }
  }

  return { country: fallback, national: digits };
}

/**
 * Space a stored phone for reading. Digits (and a leading +) are unchanged.
 * Empty / placeholder values pass through so callers can hide them.
 */
export function formatPhoneForDisplay(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  const hadPlus = trimmed.startsWith('+');
  const digits = digitsOnly(trimmed);
  if (!digits) return trimmed;

  const { country, national } = parsePhoneValue(trimmed);
  const canSplit = Boolean(national) && digits.startsWith(country.dial);
  if (canSplit) {
    const grouped = groupDigitsFromEnd(national, 3);
    return `${hadPlus ? '+' : ''}${country.dial} ${grouped}`;
  }

  const grouped = groupDigitsFromEnd(digits, 3);
  return hadPlus ? `+${grouped}` : grouped;
}

function groupDigitsFromEnd(digits: string, size: number): string {
  if (digits.length <= size) return digits;
  const parts: string[] = [];
  let rest = digits;
  while (rest.length > size) {
    parts.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  if (rest) parts.unshift(rest);
  return parts.join(' ');
}
