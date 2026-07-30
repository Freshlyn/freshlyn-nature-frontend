import type { TwoFactorClient } from "../_shared/twofactor.ts";

/**
 * Failed attempts allowed against one live OTP before it is discarded.
 *
 * The previous implementation deleted the row before even checking it, so a
 * single typo forced a whole new SMS. Under 2Factor that costs money, so the
 * row now survives a wrong code -- bounded by this cap so a retained session
 * cannot be brute-forced.
 */
export const MAX_ATTEMPTS = 5;

export interface OtpRecord {
  otp: string | null;
  sessionId: string | null;
  expiresAt: string;
  attempts: number;
}

export interface VerifyOtpDeps {
  getOtpRecord(phone: string): Promise<OtpRecord | null>;
  deleteOtpCode(phone: string): Promise<void>;
  incrementAttempts(phone: string): Promise<void>;
  getUserIdByPhone(phone: string): Promise<string | null>;
  createUser(phone: string, password: string): Promise<string>;
  setUserPassword(userId: string, password: string): Promise<void>;
  signInWithPassword(
    phone: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
  generatePassword(): string;
  twoFactor: TwoFactorClient;
}

export type VerifyOtpResult =
  | {
    success: true;
    isNewUser: boolean;
    session: { access_token: string; refresh_token: string; expires_in: number };
    message: string;
  }
  | { success: false; isNewUser: false; message: string };

const INVALID = {
  success: false as const,
  isNewUser: false as const,
  message: "Invalid or expired OTP.",
};

export async function handleVerifyOtp(
  deps: VerifyOtpDeps,
  phone: string,
  otp: string,
): Promise<VerifyOtpResult> {
  if (!phone || !otp) {
    return { success: false, isNewUser: false, message: "Phone and OTP are required." };
  }

  const record = await deps.getOtpRecord(phone);
  if (!record) return INVALID;

  // Expiry is checked locally first so a stale row costs no network round-trip.
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await deps.deleteOtpCode(phone);
    return INVALID;
  }

  // The populated column selects the path -- session_id for a real 2Factor
  // send, otp for the test-mode bypass. Nothing a client sends influences this.
  const verified = record.otp !== null
    ? record.otp === otp
    : await deps.twoFactor.verifyOtp(record.sessionId!, otp);

  if (!verified) {
    if (record.attempts + 1 >= MAX_ATTEMPTS) {
      await deps.deleteOtpCode(phone);
    } else {
      await deps.incrementAttempts(phone);
    }
    return INVALID;
  }

  await deps.deleteOtpCode(phone);

  const password = deps.generatePassword();
  const existingUserId = await deps.getUserIdByPhone(phone);
  let isNewUser = false;

  if (existingUserId) {
    await deps.setUserPassword(existingUserId, password);
  } else {
    await deps.createUser(phone, password);
    isNewUser = true;
  }

  const session = await deps.signInWithPassword(phone, password);

  return { success: true, isNewUser, session, message: "OTP verified." };
}
