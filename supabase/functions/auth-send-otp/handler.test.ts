import { assertEquals } from "jsr:@std/assert@1";
import { handleSendOtp, type SendOtpDeps } from "./handler.ts";
import { TwoFactorError } from "../_shared/twofactor.ts";

function makeDeps(overrides: Partial<{
  allowed: boolean;
  reason: string;
  retryAfterSeconds: number;
  testPhones: string[];
  sendImpl: () => Promise<string>;
}> = {}) {
  const calls = { provider: 0, logged: 0, sessions: [] as string[], codes: [] as string[] };

  const deps: SendOtpDeps = {
    checkAllowed(_phone, _ipHash) {
      return Promise.resolve({
        allowed: overrides.allowed ?? true,
        reason: overrides.reason ?? "",
        retryAfterSeconds: overrides.retryAfterSeconds ?? 0,
      });
    },
    logSend(_phone, _ipHash) {
      calls.logged++;
      return Promise.resolve();
    },
    storeSession(_phone, sessionId, _expiresAt) {
      calls.sessions.push(sessionId);
      return Promise.resolve();
    },
    storeTestCode(_phone, otp, _expiresAt) {
      calls.codes.push(otp);
      return Promise.resolve();
    },
    twoFactor: {
      async sendOtp(_phone) {
        calls.provider++;
        return overrides.sendImpl ? await overrides.sendImpl() : "sess-1";
      },
      verifyOtp() {
        return Promise.resolve(true);
      },
    },
    testPhones: overrides.testPhones ?? [],
  };

  return { deps, calls };
}

Deno.test("handleSendOtp rejects a missing phone number", async () => {
  const { deps, calls } = makeDeps();
  const result = await handleSendOtp(deps, "", null);
  assertEquals(result.success, false);
  assertEquals(calls.provider, 0);
});

// The test that proves throttling actually saves money: a blocked request must
// never reach the provider, because reaching it is what bills the account.
Deno.test("a throttled request never calls the provider", async () => {
  const { deps, calls } = makeDeps({ allowed: false, reason: "phone_cooldown", retryAfterSeconds: 45 });
  const result = await handleSendOtp(deps, "+919000000001", "hash-a");
  assertEquals(result.success, false);
  assertEquals(calls.provider, 0);
  assertEquals(calls.logged, 0);
});

Deno.test("layer 1 surfaces the remaining wait in seconds", async () => {
  const { deps } = makeDeps({ allowed: false, reason: "phone_cooldown", retryAfterSeconds: 45 });
  const result = await handleSendOtp(deps, "+919000000001", "hash-a");
  assertEquals(result.message.includes("45"), true);
});

// Layers 3 and 4 stay vague on purpose: naming the limit an attacker hit helps
// them tune around it.
Deno.test("layer 3 and 4 messages do not reveal which limit was hit", async () => {
  for (const reason of ["ip_hourly", "global_daily"]) {
    const { deps } = makeDeps({ allowed: false, reason });
    const result = await handleSendOtp(deps, "+919000000001", "hash-a");
    assertEquals(result.message.toLowerCase().includes("ip"), false);
    assertEquals(result.message.toLowerCase().includes("global"), false);
  }
});

Deno.test("an allowed send stores the session id and logs the send", async () => {
  const { deps, calls } = makeDeps();
  const result = await handleSendOtp(deps, "+919000000001", "hash-a");
  assertEquals(result.success, true);
  assertEquals(calls.provider, 1);
  assertEquals(calls.sessions, ["sess-1"]);
  assertEquals(calls.logged, 1);
});

Deno.test("an allowlisted test phone never calls the provider", async () => {
  const { deps, calls } = makeDeps({ testPhones: ["+919123456789"] });
  const result = await handleSendOtp(deps, "+919123456789", "hash-a");
  assertEquals(result.success, true);
  assertEquals(calls.provider, 0);
  assertEquals(calls.codes, ["123456"]);
});

// A provider outage must not consume the user's allowance.
Deno.test("a provider failure logs no send and returns a generic message", async () => {
  const { deps, calls } = makeDeps({
    sendImpl: () => Promise.reject(new TwoFactorError("Insufficient balance")),
  });
  const result = await handleSendOtp(deps, "+919000000001", "hash-a");
  assertEquals(result.success, false);
  assertEquals(calls.logged, 0);
  assertEquals(result.message.toLowerCase().includes("balance"), false);
});
