import { assertEquals } from "jsr:@std/assert@1";
import { handleFinalizeAccountBan, type FinalizeAccountBanDeps } from "./handler.ts";

function makeDeps() {
  const calls: string[] = [];
  const deps: FinalizeAccountBanDeps = {
    async banAndClearUser(userId) {
      calls.push(userId);
    },
  };
  return { deps, calls };
}

Deno.test("finalize-account-ban returns 401 when the caller is not authorized", async () => {
  const { deps } = makeDeps();
  const result = await handleFinalizeAccountBan(deps, false, "user-1");
  assertEquals(result.status, 401);
});

Deno.test("finalize-account-ban returns 400 when userId is missing", async () => {
  const { deps } = makeDeps();
  const result = await handleFinalizeAccountBan(deps, true, undefined);
  assertEquals(result.status, 400);
});

Deno.test("finalize-account-ban bans and clears the given user", async () => {
  const { deps, calls } = makeDeps();
  const result = await handleFinalizeAccountBan(deps, true, "user-1");
  assertEquals(result.status, 200);
  assertEquals(calls, ["user-1"]);
});
