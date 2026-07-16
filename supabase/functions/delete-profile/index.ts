import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-admin.ts";
import { handleDeleteProfile, type DeleteProfileDeps } from "./handler.ts";

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0].trim();
}

function buildDeps(authorizationHeader: string): DeleteProfileDeps {
  const admin = createAdminClient();
  const userClient = createUserClient(authorizationHeader);
  const token = authorizationHeader.replace(/^Bearer\s+/i, "");

  return {
    async getCallerUserId() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return null;
      return data.user.id;
    },
    async hasActiveRequest(userId) {
      const { data } = await admin
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "flagged"])
        .maybeSingle();
      return !!data;
    },
    async insertRequest(params) {
      const { error } = await admin.from("account_deletion_requests").insert({
        user_id: params.userId,
        scheduled_for: params.scheduledFor,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });
      if (error) throw new Error(error.message);
    },
    async revokeCallerSession() {
      await admin.auth.admin.signOut(token, "global");
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorizationHeader = req.headers.get("Authorization") ?? "";
    const result = await handleDeleteProfile(buildDeps(authorizationHeader), {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return new Response(JSON.stringify(result.body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (_error) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to request account deletion." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
