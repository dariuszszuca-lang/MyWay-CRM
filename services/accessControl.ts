export const ALLOWED_EMAILS = [
  'dariusz.szuca@gmail.com',
  'krystiannagaba@gmail.com',
  'mywaymarcin@gmail.com',
  'npucz708@gmail.com',
  'gabinet.osrodekmyway@gmail.com',
];

export const STATS_ACCESS_EMAILS = [
  'mywaymarcin@gmail.com',
  'npucz708@gmail.com',
  'krystiannagaba@gmail.com',
];

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || '';

const isEmailAllowed = (email: string | null | undefined, allowedEmails: string[]) => {
  const normalizedEmail = normalizeEmail(email);
  return allowedEmails.some((allowed) => allowed.toLowerCase() === normalizedEmail);
};

export const canAccessApp = (email?: string | null) => isEmailAllowed(email, ALLOWED_EMAILS);

export const canAccessStats = (email?: string | null) => isEmailAllowed(email, STATS_ACCESS_EMAILS);
