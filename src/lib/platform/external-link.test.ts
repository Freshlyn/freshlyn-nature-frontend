import { describe, it, expect, vi, beforeEach } from "vitest";

const isNative = vi.fn();
vi.mock("@/lib/platform", () => ({ isNative: () => isNative() }));

describe("openExternalUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    isNative.mockReset();
  });

  it("opens a new tab on web, never touching location", async () => {
    isNative.mockReturnValue(false);
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      get href() {
        return "";
      },
      set href(v: string) {
        assign(v);
      },
    } as Location);

    const { openExternalUrl } = await import("./external-link");
    openExternalUrl("https://freshlynnature.com/");

    expect(open).toHaveBeenCalledWith(
      "https://freshlynnature.com/",
      "_blank",
      "noopener,noreferrer",
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("navigates on native so Capacitor fires an ACTION_VIEW intent", async () => {
    isNative.mockReturnValue(true);
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      get href() {
        return "";
      },
      set href(v: string) {
        assign(v);
      },
    } as Location);

    const { openExternalUrl } = await import("./external-link");
    openExternalUrl("https://freshlynnature.com/");

    // window.open would be swallowed by the Android WebView -- the plain
    // navigation is the only form that reaches shouldOverrideUrlLoading.
    expect(assign).toHaveBeenCalledWith("https://freshlynnature.com/");
    expect(open).not.toHaveBeenCalled();
  });
});
