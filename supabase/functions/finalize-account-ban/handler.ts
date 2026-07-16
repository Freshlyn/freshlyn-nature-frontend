export interface FinalizeAccountBanDeps {
  banAndClearUser(userId: string): Promise<void>;
}

export type FinalizeAccountBanResult =
  | { status: 200; body: { success: true } }
  | { status: 401 | 400; body: { success: false; error: string } };

export async function handleFinalizeAccountBan(
  deps: FinalizeAccountBanDeps,
  authorizedCaller: boolean,
  userId: string | undefined,
): Promise<FinalizeAccountBanResult> {
  if (!authorizedCaller) {
    return { status: 401, body: { success: false, error: "Unauthorized" } };
  }
  if (!userId) {
    return { status: 400, body: { success: false, error: "userId is required" } };
  }

  await deps.banAndClearUser(userId);
  return { status: 200, body: { success: true } };
}
