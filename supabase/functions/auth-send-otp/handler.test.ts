import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { handleSendOtp, type OtpCodesClient } from "./handler.ts";

function makeMockClient(shouldError = false) {
  const upserted: Record<string, unknown>[] = [];
  const client: OtpCodesClient = {
    from(_table) {
      return {
        async upsert(row) {
          if (shouldError) return { error: { message: "db error" } };
          upserted.push(row);
          return { error: null };
        },
      };
    },
  };
  return { client, upserted };
}

Deno.test("handleSendOtp rejects a missing phone number", async () => {
  const { client } = makeMockClient();
  const result = await handleSendOtp(client, "");
  assertEquals(result.success, false);
});

Deno.test("handleSendOtp upserts an otp_codes row and returns success", async () => {
  const { client, upserted } = makeMockClient();
  const result = await handleSendOtp(client, "+911234567890");
  assertEquals(result.success, true);
  assertEquals(upserted.length, 1);
  assertEquals(upserted[0].phone, "+911234567890");
});

Deno.test("handleSendOtp propagates a database error", async () => {
  const { client } = makeMockClient(true);
  await assertRejects(() => handleSendOtp(client, "+911234567890"));
});
