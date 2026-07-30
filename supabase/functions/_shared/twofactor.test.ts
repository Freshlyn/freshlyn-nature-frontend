import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { createTwoFactorClient, TwoFactorError } from "./twofactor.ts";

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return ((_input: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status }),
    )) as typeof fetch;
}

Deno.env.set("TWOFACTOR_API_KEY", "test-key");

Deno.test("sendOtp returns the session id from Details", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Success", Details: "sess-abc-123" }),
  );
  assertEquals(await client.sendOtp("+919000000001"), "sess-abc-123");
});

// The critical regression guard: 2Factor answers HTTP 200 on failures, so a
// naive response.ok check would report a failed send as delivered.
Deno.test("sendOtp treats HTTP 200 + Status:Error as a failure", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Error", Details: "Invalid API Key" }, 200),
  );
  await assertRejects(() => client.sendOtp("+919000000001"), TwoFactorError);
});

Deno.test("verifyOtp returns true when the provider matches the code", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Success", Details: "OTP Matched" }),
  );
  assertEquals(await client.verifyOtp("sess-abc-123", "123456"), true);
});

// A wrong code is a normal negative outcome, not an operational failure --
// it must return false, not throw, so the handler can count the attempt.
Deno.test("verifyOtp returns false for a mismatched code", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Error", Details: "OTP Mismatch" }),
  );
  assertEquals(await client.verifyOtp("sess-abc-123", "000000"), false);
});

Deno.test("verifyOtp throws on an operational provider error", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Error", Details: "Invalid API Key" }),
  );
  await assertRejects(() => client.verifyOtp("sess-abc-123", "123456"), TwoFactorError);
});

Deno.test("the API key never appears in a thrown error message", async () => {
  const client = createTwoFactorClient(
    fakeFetch({ Status: "Error", Details: "Invalid API Key" }),
  );
  const err = await client.sendOtp("+919000000001").catch((e) => e);
  assertEquals(String(err).includes("test-key"), false);
});
