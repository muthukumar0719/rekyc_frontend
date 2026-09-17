export function maskEmail(email) {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 4);
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 1))}@${domain}`;
}

export function maskMobile(mobile) {
  if (!mobile) return '';
  return String(mobile).replace(/.(?=.{4})/g, '*');
}

// Account-number masking method: mask every character, from the first one.
// No digit is ever shown in plain text.
export function maskAccount(value) {
  if (!value) return '';
  return '*'.repeat(String(value).length);
}

// Display-only masking that keeps the last 4 digits visible, e.g. *********3755.
// Used for the un-focused state of an account-number field.
export function maskAccountLast4(value) {
  if (!value) return '';
  return String(value).replace(/.(?=.{4})/g, '*');
}
