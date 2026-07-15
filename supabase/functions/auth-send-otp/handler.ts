export interface OtpCodesClient {
  from(table: "otp_codes"): {
    upsert(row: {
      phone: string;
      otp: string;
      expires_at: string;
    }): Promise<{ error: { message: string } | null }>;
  };
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpViaProvider(
  client: OtpCodesClient,
  phone: string,
): Promise<void> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await client
    .from("otp_codes")
    .upsert({ phone, otp, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  // Dummy provider stand-in (spec Section 5): logs instead of calling a real SMS API.
  console.log(`[auth-send-otp] OTP for ${phone}: ${otp}`);
}

export async function handleSendOtp(
  client: OtpCodesClient,
  phone: string,
): Promise<{ success: boolean; message: string }> {
  if (!phone || typeof phone !== "string") {
    return { success: false, message: "A valid phone number is required." };
  }
  await sendOtpViaProvider(client, phone);
  return { success: true, message: `OTP sent to ${phone}.` };
}
