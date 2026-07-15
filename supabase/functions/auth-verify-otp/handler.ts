export interface VerifyOtpDeps {
  getOtpCode(phone: string): Promise<{ otp: string; expiresAt: string } | null>;
  deleteOtpCode(phone: string): Promise<void>;
  getUserIdByPhone(phone: string): Promise<string | null>;
  createUser(phone: string, password: string): Promise<string>;
  setUserPassword(userId: string, password: string): Promise<void>;
  signInWithPassword(
    phone: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
  generatePassword(): string;
}

export type VerifyOtpResult =
  | {
    success: true;
    isNewUser: boolean;
    session: { access_token: string; refresh_token: string; expires_in: number };
    message: string;
  }
  | { success: false; isNewUser: false; message: string };

export async function verifyOtpViaProvider(
  deps: VerifyOtpDeps,
  phone: string,
  otp: string,
): Promise<boolean> {
  const record = await deps.getOtpCode(phone);
  await deps.deleteOtpCode(phone); // single-use, regardless of outcome
  if (!record) return false;
  if (new Date(record.expiresAt).getTime() < Date.now()) return false;
  return record.otp === otp;
}

export async function handleVerifyOtp(
  deps: VerifyOtpDeps,
  phone: string,
  otp: string,
): Promise<VerifyOtpResult> {
  if (!phone || !otp) {
    return { success: false, isNewUser: false, message: "Phone and OTP are required." };
  }

  const verified = await verifyOtpViaProvider(deps, phone, otp);
  if (!verified) {
    return { success: false, isNewUser: false, message: "Invalid or expired OTP." };
  }

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
