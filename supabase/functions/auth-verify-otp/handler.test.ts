import { assertEquals } from "jsr:@std/assert@1";
import { handleVerifyOtp, MAX_ATTEMPTS, type VerifyOtpDeps } from "./handler.ts";

function makeMockDeps(overrides: Partial<{
  otp: string | null;
  sessionId: string | null;
  expiresAt: string;
  attempts: number;
  existingUserId: string | null;
  providerResult: boolean;
}> = {}) {
  let record: {
    otp: string | null;
    sessionId: string | null;
    expiresAt: string;
    attempts: number;
  } | null = {
    otp: overrides.otp ?? null,
    sessionId: overrides.sessionId ?? "sess-1",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    attempts: overrides.attempts ?? 0,
  };

  let existingUserId = overrides.existingUserId ?? null;
  const calls = { setUserPassword: 0, createUser: 0, deleted: 0, incremented: 0, provider: 0 };

  const deps: VerifyOtpDeps = {
    getOtpRecord(_phone) {
      return Promise.resolve(record);
    },
    deleteOtpCode(_phone) {
      calls.deleted++;
      record = null;
      return Promise.resolve();
    },
    incrementAttempts(_phone) {
      calls.incremented++;
      if (record) record.attempts++;
      return Promise.resolve();
    },
    getUserIdByPhone(_phone) {
      return Promise.resolve(existingUserId);
    },
    createUser(_phone, _password) {
      calls.createUser++;
      existingUserId = "new-user-id";
      return Promise.resolve("new-user-id");
    },
    setUserPassword(_userId, _password) {
      calls.setUserPassword++;
      return Promise.resolve();
    },
    signInWithPassword(_phone, _password) {
      return Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600 });
    },
    generatePassword() {
      return "mock-password";
    },
    twoFactor: {
      sendOtp() {
        return Promise.resolve("sess-1");
      },
      verifyOtp(_sessionId, _otp) {
        calls.provider++;
        return Promise.resolve(overrides.providerResult ?? true);
      },
    },
  };

  return { deps, calls };
}

Deno.test("handleVerifyOtp rejects missing phone or otp", async () => {
  const { deps } = makeMockDeps();
  assertEquals((await handleVerifyOtp(deps, "", "")).success, false);
});

Deno.test("the real path delegates to the provider with the stored session id", async () => {
  const { deps, calls } = makeMockDeps({ sessionId: "sess-xyz", providerResult: true });
  const result = await handleVerifyOtp(deps, "+919000000001", "123456");
  assertEquals(result.success, true);
  assertEquals(calls.provider, 1);
});

Deno.test("the test path compares locally and never calls the provider", async () => {
  const { deps, calls } = makeMockDeps({ otp: "123456", sessionId: null });
  const result = await handleVerifyOtp(deps, "+919123456789", "123456");
  assertEquals(result.success, true);
  assertEquals(calls.provider, 0);
});

// Changed behaviour: a typo must not burn a paid SMS, so the row survives.
Deno.test("a wrong code keeps the row and increments attempts", async () => {
  const { deps, calls } = makeMockDeps({ providerResult: false });
  const result = await handleVerifyOtp(deps, "+919000000001", "000000");
  assertEquals(result.success, false);
  assertEquals(calls.incremented, 1);
  assertEquals(calls.deleted, 0);
});

Deno.test("the row is deleted once attempts reach the cap", async () => {
  const { deps, calls } = makeMockDeps({ providerResult: false, attempts: MAX_ATTEMPTS - 1 });
  const result = await handleVerifyOtp(deps, "+919000000001", "000000");
  assertEquals(result.success, false);
  assertEquals(calls.deleted, 1);
});

Deno.test("a successful verification deletes the row", async () => {
  const { deps, calls } = makeMockDeps({ providerResult: true });
  await handleVerifyOtp(deps, "+919000000001", "123456");
  assertEquals(calls.deleted, 1);
});

Deno.test("an expired row is rejected without a provider call", async () => {
  const { deps, calls } = makeMockDeps({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const result = await handleVerifyOtp(deps, "+919000000001", "123456");
  assertEquals(result.success, false);
  assertEquals(calls.provider, 0);
  assertEquals(calls.deleted, 1);
});

Deno.test("logs in an existing user without creating a new one", async () => {
  const { deps, calls } = makeMockDeps({ existingUserId: "existing-user-id" });
  const result = await handleVerifyOtp(deps, "+919000000001", "123456");
  assertEquals(result.success, true);
  if (result.success) assertEquals(result.isNewUser, false);
  assertEquals(calls.setUserPassword, 1);
  assertEquals(calls.createUser, 0);
});

Deno.test("creates a new user on first-time signup", async () => {
  const { deps, calls } = makeMockDeps({ existingUserId: null });
  const result = await handleVerifyOtp(deps, "+919000000001", "123456");
  assertEquals(result.success, true);
  if (result.success) assertEquals(result.isNewUser, true);
  assertEquals(calls.createUser, 1);
});
