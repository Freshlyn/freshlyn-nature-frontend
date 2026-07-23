// Phone normalization for the auth flow.
//
// The whole backend (edge functions, GoTrue) expects E.164-formatted numbers
// (e.g. "+919876543210"). The login form collects only the 10 local digits and
// renders "+91" as decorative markup, so without normalization the client sends
// a raw, non-E.164 string. GoTrue's admin.createUser then rejects it with
// "Invalid phone number format (E.164 required)", which the edge function
// surfaces as an opaque 500. Normalizing here, at the client boundary, keeps
// send-otp and verify-otp addressing the same canonical value.

const IN_COUNTRY_CODE = "91";

/**
 * Normalize a user-entered Indian phone number to E.164 ("+91XXXXXXXXXX").
 *
 * Accepts the shapes a user can realistically produce — 10 local digits,
 * a leading 0 (trunk prefix), an existing 91/+91 country code — and returns
 * null when the result is not a valid Indian mobile number (10 digits starting
 * 6–9). Callers should treat null as "invalid phone" and show a validation
 * message rather than sending it.
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");

  // Strip a country code if the user already typed one.
  if (digits.length === 12 && digits.startsWith(IN_COUNTRY_CODE)) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // Trunk-prefixed local number: 0XXXXXXXXXX -> XXXXXXXXXX
    digits = digits.slice(1);
  }

  // A valid Indian mobile is 10 digits and starts with 6, 7, 8, or 9.
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return null;
  }

  return `+${IN_COUNTRY_CODE}${digits}`;
}
