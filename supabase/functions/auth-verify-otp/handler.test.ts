import { assertEquals } from "jsr:@std/assert@1";
import { handleVerifyOtp, type VerifyOtpDeps } from "./handler.ts";

function makeMockDeps(overrides: Partial<{
  storedOtp: string;
  expiresAt: string;
  existingUserId: string | null;
}> = {}) {
  const storedOtp = overrides.storedOtp ?? "123456";
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 60_000).toISOString();
  let existingUserId = overrides.existingUserId ?? null;
  let otpRecord: { otp: string; expiresAt: string } | null = { otp: storedOtp, expiresAt };

  const calls = { setUserPassword: 0, createUser: 0 };

  const deps: VerifyOtpDeps = {
    async getOtpCode(_phone) {
      return otpRecord;
    },
    async deleteOtpCode(_phone) {
      otpRecord = null;
    },
    async getUserIdByPhone(_phone) {
      return existingUserId;
    },
    async createUser(_phone, _password) {
      calls.createUser++;
      existingUserId = "new-user-id";
      return "new-user-id";
    },
    async setUserPassword(_userId, _password) {
      calls.setUserPassword++;
    },
    async signInWithPassword(_phone, _password) {
      return { access_token: "at", refresh_token: "rt", expires_in: 3600 };
    },
    generatePassword() {
      return "mock-password";
    },
  };

  return { deps, calls };
}

Deno.test("handleVerifyOtp rejects missing phone or otp", async () => {
  const { deps } = makeMockDeps();
  const result = await handleVerifyOtp(deps, "", "");
  assertEquals(result.success, false);
});

Deno.test("handleVerifyOtp rejects a wrong otp", async () => {
  const { deps } = makeMockDeps({ storedOtp: "123456" });
  const result = await handleVerifyOtp(deps, "+911234567890", "000000");
  assertEquals(result.success, false);
});

Deno.test("handleVerifyOtp rejects an expired otp", async () => {
  const { deps } = makeMockDeps({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const result = await handleVerifyOtp(deps, "+911234567890", "123456");
  assertEquals(result.success, false);
});

Deno.test("handleVerifyOtp logs in an existing user without creating a new one", async () => {
  const { deps, calls } = makeMockDeps({ existingUserId: "existing-user-id" });
  const result = await handleVerifyOtp(deps, "+911234567890", "123456");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.isNewUser, false);
    assertEquals(result.session.access_token, "at");
  }
  assertEquals(calls.setUserPassword, 1);
  assertEquals(calls.createUser, 0);
});

Deno.test("handleVerifyOtp creates a new user on first-time signup", async () => {
  const { deps, calls } = makeMockDeps({ existingUserId: null });
  const result = await handleVerifyOtp(deps, "+911234567890", "123456");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.isNewUser, true);
  }
  assertEquals(calls.createUser, 1);
  assertEquals(calls.setUserPassword, 0);
});

Deno.test("handleVerifyOtp otp is single-use", async () => {
  const { deps } = makeMockDeps();
  const first = await handleVerifyOtp(deps, "+911234567890", "123456");
  assertEquals(first.success, true);
  const second = await handleVerifyOtp(deps, "+911234567890", "123456");
  assertEquals(second.success, false);
});
