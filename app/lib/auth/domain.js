// The one place the institutional domain rule lives (server and tests). Value comes from ALLOWED_EMAIL_DOMAIN.

export const allowedDomain = () => (process.env.ALLOWED_EMAIL_DOMAIN || "psgtech.ac.in").trim().toLowerCase();

/**
 * True only for a single, well-formed address whose domain is exactly the allowed one (case-insensitive).
 * "student@psgtech.ac.in" / "Student@PSGTECH.AC.IN" -> true
 * "student@gmail.com", "x@psgtech.ac.in.evil.com", "x@sub.psgtech.ac.in", "a@b@psgtech.ac.in" -> false
 */
export function isAllowedEmail(email, domain = allowedDomain()) {
  if (typeof email !== "string") return false;
  const value = email.trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return parts[1] === domain;
}
