import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { handleFinalizeAccountBan, type FinalizeAccountBanDeps } from "./handler.ts";

function buildDeps(): FinalizeAccountBanDeps {
  const admin = createAdminClient();
  return {
    async banAndClearUser(userId) {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
      if (banError) throw new Error(banError.message);

      const { error: clearError } = await admin.auth.admin.updateUserById(userId, {
        email: null,
        phone: null,
      });
      if (clearError) throw new Error(clearError.message);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorizationHeader = req.headers.get("Authorization") ?? "";
    const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
    const authorizedCaller = authorizationHeader === expected;

    const { userId } = await req.json();
    const result = await handleFinalizeAccountBan(buildDeps(), authorizedCaller, userId);
    return new Response(JSON.stringify(result.body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (_error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to finalize account ban." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
