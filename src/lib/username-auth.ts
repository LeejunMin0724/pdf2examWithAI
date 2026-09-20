/**
 * ID-only accounts on top of Supabase Auth.
 *
 * Supabase's built-in credential flow is email + password — there is no native
 * username sign-in. So every 아이디 maps onto a deterministic address inside a
 * domain the app owns (USERNAME_EMAIL_DOMAIN). Nothing is ever mailed there; the
 * address exists only so Supabase can store the credential and enforce one
 * account per 아이디.
 *
 * An input that already looks like an email is passed through untouched, so
 * accounts created before ID-only signup keep working.
 */

/** Reserved domain for synthetic credential addresses. Never receives mail. */
export const USERNAME_EMAIL_DOMAIN = "users.pdf2exam.app";

/** 3–20 chars, letters/digits/underscore/hyphen, starting with a letter or digit. */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + lowercase: 아이디 uniqueness is case-insensitive. */
export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Korean validation message, or null when the value is usable as a login ID. */
export function validateLoginId(raw: string): string | null {
  const value = normalizeLoginId(raw);
  if (!value) return "아이디를 입력해 주세요.";
  if (value.includes("@")) {
    return EMAIL_PATTERN.test(value) ? null : "이메일 형식이 올바르지 않습니다.";
  }
  if (!USERNAME_PATTERN.test(value)) {
    return "아이디는 영문 소문자·숫자·_·- 로 3~20자까지 사용할 수 있습니다.";
  }
  return null;
}

/** Supabase credential address for the given 아이디 (emails pass through). */
export function toAuthEmail(raw: string): string {
  const value = normalizeLoginId(raw);
  return value.includes("@") ? value : `${value}@${USERNAME_EMAIL_DOMAIN}`;
}

/**
 * The 아이디 to show in the UI: our synthetic domain is stripped, anything else
 * (a legacy email account) is shown as-is.
 */
export function toDisplayId(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`;
  const lower = email.toLowerCase();
  return lower.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
