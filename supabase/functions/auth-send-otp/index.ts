import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { createTwoFactorClient } from "../_shared/twofactor.ts";
import { handleSendOtp, type SendOtpDeps } from "./handler.ts";

/**
 * Hash the client IP with a secret salt. Rate limiting needs only a stable
 * identifier, and a raw IP is personal data under India's DPDP Act -- so the
 * plaintext value is never written anywhere.
 */
async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = Deno.env.get("TWOFACTOR_IP_SALT") ?? "";
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildDeps(): SendOtpDeps {
  const admin = createAdminClient();

  return {
    async checkAllowed(phone, ipHash) {
      const { data, error } = await admin.rpc("fn_check_otp_send_allowed", {
        p_phone: phone,
        p_ip_hash: ipHash,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        allowed: row?.allowed ?? false,
        reason: row?.reason ?? "",
        retryAfterSeconds: row?.retry_after_seconds ?? 0,
      };
    },
    async logSend(phone, ipHash) {
      const { error } = await admin
        .from("otp_send_log")
        .insert({ phone, ip_hash: ipHash });
      if (error) throw new Error(error.message);
    },
    async storeSession(phone, sessionId, expiresAt) {
      const { error } = await admin.from("otp_codes").upsert({
        phone,
        otp: null,
        session_id: sessionId,
        expires_at: expiresAt,
        attempts: 0,
      });
      if (error) throw new Error(error.message);
    },
    async storeTestCode(phone, otp, expiresAt) {
      const { error } = await admin.from("otp_codes").upsert({
        phone,
        otp,
        session_id: null,
        expires_at: expiresAt,
        attempts: 0,
      });
      if (error) throw new Error(error.message);
    },
    twoFactor: createTwoFactorClient(),
    testPhones: (Deno.env.get("TWOFACTOR_TEST_PHONES") ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await handleSendOtp(buildDeps(), phone, await hashIp(ip));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send OTP.";
    console.error("[auth-send-otp] unhandled error:", message);
    return new Response(
      JSON.stringify({ success: false, message: "Could not send OTP. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
