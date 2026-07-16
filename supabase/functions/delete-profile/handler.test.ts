import { assertEquals } from "jsr:@std/assert@1";
import { handleDeleteProfile, type DeleteProfileDeps } from "./handler.ts";

function makeDeps(options: { userId?: string | null; alreadyRequested?: boolean } = {}) {
  const calls = { insertRequest: [] as unknown[], revokeCallerSession: 0 };
  const deps: DeleteProfileDeps = {
    async getCallerUserId() {
      return options.userId === undefined ? "user-1" : options.userId;
    },
    async hasActiveRequest(_userId) {
      return options.alreadyRequested ?? false;
    },
    async insertRequest(params) {
      calls.insertRequest.push(params);
    },
    async revokeCallerSession() {
      calls.revokeCallerSession++;
    },
  };
  return { deps, calls };
}

Deno.test("delete-profile returns 401 when there is no authenticated caller", async () => {
  const { deps } = makeDeps({ userId: null });
  const result = await handleDeleteProfile(deps, { ipAddress: "1.2.3.4", userAgent: "test-agent" });
  assertEquals(result.status, 401);
});

Deno.test("delete-profile returns 409 when a request is already in progress", async () => {
  const { deps, calls } = makeDeps({ alreadyRequested: true });
  const result = await handleDeleteProfile(deps, { ipAddress: "1.2.3.4", userAgent: "test-agent" });
  assertEquals(result.status, 409);
  assertEquals(calls.insertRequest.length, 0);
  assertEquals(calls.revokeCallerSession, 0);
});

Deno.test("delete-profile inserts a request scheduled 7 days out and revokes the session", async () => {
  const { deps, calls } = makeDeps();
  const before = Date.now();
  const result = await handleDeleteProfile(deps, { ipAddress: "1.2.3.4", userAgent: "test-agent" });
  assertEquals(result.status, 200);
  if (result.status === 200) {
    const scheduledForMs = new Date(result.body.scheduledFor!).getTime();
    const deltaDays = (scheduledForMs - before) / (24 * 60 * 60 * 1000);
    assertEquals(Math.round(deltaDays), 7);
  }
  assertEquals(calls.insertRequest.length, 1);
  assertEquals((calls.insertRequest[0] as { ipAddress: string }).ipAddress, "1.2.3.4");
  assertEquals((calls.insertRequest[0] as { userAgent: string }).userAgent, "test-agent");
  assertEquals(calls.revokeCallerSession, 1);
});
