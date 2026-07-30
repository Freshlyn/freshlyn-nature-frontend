import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createAnonClient } from "../_shared/supabase-admin.ts";
import { createTwoFactorClient } from "../_shared/twofactor.ts";
import { handleVerifyOtp, type VerifyOtpDeps } from "./handler.ts";

function buildDeps(): VerifyOtpDeps {
  const admin = createAdminClient();
  const anon = createAnonClient();

  return {
    async getOtpRecord(phone) {
      const { data } = await admin
        .from("otp_codes")
        .select("otp, session_id, expires_at, attempts")
        .eq("phone", phone)
        .maybeSingle();
      return data
        ? {
          otp: data.otp,
          sessionId: data.session_id,
          expiresAt: data.expires_at,
          attempts: data.attempts,
        }
        : null;
    },
    async incrementAttempts(phone) {
      const { error } = await admin.rpc("fn_increment_otp_attempts", { p_phone: phone });
      if (error) throw new Error(error.message);
    },
    async deleteOtpCode(phone) {
      await admin.from("otp_codes").delete().eq("phone", phone);
    },
    async getUserIdByPhone(phone) {
      const { data } = await admin.rpc("fn_get_user_id_by_phone", { p_phone: phone });
      return (data as string | null) ?? null;
    },
    async createUser(phone, password) {
      const { data, error } = await admin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password,
      });
      if (error || !data.user) throw new Error(error?.message ?? "failed to create user");
      return data.user.id;
    },
    async setUserPassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw new Error(error.message);
    },
    async signInWithPassword(phone, password) {
      const { data, error } = await anon.auth.signInWithPassword({ phone, password });
      if (error || !data.session) throw new Error(error?.message ?? "failed to sign in");
      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };
    },
    generatePassword() {
      return crypto.randomUUID() + crypto.randomUUID();
    },
    twoFactor: createTwoFactorClient(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();
    const result = await handleVerifyOtp(buildDeps(), phone, otp);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    // Log the real cause server-side so failures are diagnosable (this is what
    // previously hid an "Invalid phone number format (E.164 required)" throw
    // behind an opaque 500). Return the message to the client too — these come
    // from GoTrue/validation and are safe to surface, and give the user a real
    // hint instead of a dead-end error.
    const message = error instanceof Error ? error.message : "Failed to verify OTP.";
    console.error("[auth-verify-otp] unhandled error:", message);
    return new Response(
      JSON.stringify({ success: false, isNewUser: false, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
