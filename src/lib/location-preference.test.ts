import { describe, it, expect, vi, beforeEach } from "vitest";

// platformStorage is mocked because the real one branches on Capacitor, which
// has no bridge in jsdom. We are testing serialisation, not the adapter.
const store = new Map<string, string>();
vi.mock("@/lib/platform/storage", () => ({
  platformStorage: {
    async getItem(key: string) {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      store.set(key, value);
    },
    async removeItem(key: string) {
      store.delete(key);
    },
  },
}));

describe("location preference", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  it("returns null before anything is stored", async () => {
    const { readLocationPreference } = await import("./location-preference");
    expect(await readLocationPreference()).toBeNull();
  });

  it("round-trips a stored preference", async () => {
    const { readLocationPreference, writeLocationPreference } =
      await import("./location-preference");

    await writeLocationPreference({ serviceable: true, label: "Ballygunge", matchedBy: "gps" });

    expect(await readLocationPreference()).toEqual({
      serviceable: true,
      label: "Ballygunge",
      matchedBy: "gps",
    });
  });

  it("stores a rejection too, so the screen is not shown again", async () => {
    // The screen is shown ONCE. An out-of-area user who reaches the catalogue
    // must not be re-prompted on every launch.
    const { readLocationPreference, writeLocationPreference } =
      await import("./location-preference");

    await writeLocationPreference({ serviceable: false, label: "700001", matchedBy: "pincode" });

    expect((await readLocationPreference())?.serviceable).toBe(false);
  });

  it("treats a corrupt stored value as absent", async () => {
    // A half-written or hand-edited value must not crash app start. Returning
    // null just shows the screen once more, which is harmless.
    store.set("freshlyn.location-preference", "{not json");
    const { readLocationPreference } = await import("./location-preference");

    expect(await readLocationPreference()).toBeNull();
  });

  it("clears a stored preference", async () => {
    const { readLocationPreference, writeLocationPreference, clearLocationPreference } =
      await import("./location-preference");

    await writeLocationPreference({ serviceable: true, label: "Ballygunge", matchedBy: "gps" });
    await clearLocationPreference();

    expect(await readLocationPreference()).toBeNull();
  });

  it("round-trips the coordinates that produced the verdict", async () => {
    // Carried so the address form can offer "use the location you shared
    // earlier?" instead of triggering a second OS permission moment in the
    // common case of a user setting up at home.
    const { readLocationPreference, writeLocationPreference } =
      await import("./location-preference");

    await writeLocationPreference({
      serviceable: true,
      label: "Your location",
      matchedBy: "gps",
      latitude: 22.53,
      longitude: 88.36,
    });

    const stored = await readLocationPreference();
    expect(stored?.latitude).toBe(22.53);
    expect(stored?.longitude).toBe(88.36);
  });

  it("reads a preference saved without coordinates", async () => {
    // A pincode-tier preference has no coordinates, and an older stored value
    // predates the fields entirely. Both must read back cleanly.
    const { readLocationPreference, writeLocationPreference } =
      await import("./location-preference");

    await writeLocationPreference({ serviceable: true, label: "700019", matchedBy: "pincode" });

    const stored = await readLocationPreference();
    expect(stored?.latitude).toBeUndefined();
    expect(stored?.serviceable).toBe(true);
  });
});
