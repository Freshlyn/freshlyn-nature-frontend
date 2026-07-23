import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { handleSendOtp } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    const result = await handleSendOtp(createAdminClient(), phone);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    // Log the real cause server-side and surface it, rather than masking every
    // failure as an opaque 500 (see auth-verify-otp/index.ts for context).
    const message = error instanceof Error ? error.message : "Failed to send OTP.";
    console.error("[auth-send-otp] unhandled error:", message);
    return new Response(
      JSON.stringify({ success: false, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
