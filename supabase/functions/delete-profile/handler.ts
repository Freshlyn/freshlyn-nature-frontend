export interface DeleteProfileDeps {
  getCallerUserId(): Promise<string | null>;
  hasActiveRequest(userId: string): Promise<boolean>;
  insertRequest(params: {
    userId: string;
    scheduledFor: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void>;
  revokeCallerSession(): Promise<void>;
}

export type DeleteProfileResult =
  | { status: 200; body: { success: true; scheduledFor: string } }
  | { status: 401 | 409; body: { success: false; error: string } };

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (spec Section 6 default)

export async function handleDeleteProfile(
  deps: DeleteProfileDeps,
  request: { ipAddress: string | null; userAgent: string | null },
): Promise<DeleteProfileResult> {
  const userId = await deps.getCallerUserId();
  if (!userId) {
    return { status: 401, body: { success: false, error: "Unauthorized" } };
  }

  const alreadyRequested = await deps.hasActiveRequest(userId);
  if (alreadyRequested) {
    return { status: 409, body: { success: false, error: "A deletion request is already in progress." } };
  }

  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();
  await deps.insertRequest({
    userId,
    scheduledFor,
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
  });
  await deps.revokeCallerSession();

  return { status: 200, body: { success: true, scheduledFor } };
}
