import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The hook's value is its priority chain: dialog > history > guarded exit.
// That logic is worth testing in Node -- on-device verification (plan gate 6)
// can only be run by hand, so without this the chain would ship unexercised.

const isNative = vi.fn();
vi.mock("@/lib/platform", () => ({ isNative: () => isNative() }));

const addListener = vi.fn();
const exitApp = vi.fn();
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (...args: unknown[]) => addListener(...args),
    exitApp: () => exitApp(),
  },
}));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

// React's module exports are non-configurable, so they are replaced wholesale
// rather than spied on. useEffect runs its body immediately and useRef returns
// a persistent box -- enough to exercise the hook with no renderer involved.
const pendingEffects: Array<() => void | (() => void)> = [];
const refBoxes = new Map<number, { current: unknown }>();
let refIndex = 0;
vi.mock("react", () => ({
  useEffect: (fn: () => void | (() => void)) => {
    pendingEffects.push(fn);
  },
  useRef: (initial: unknown) => {
    const key = refIndex++;
    if (!refBoxes.has(key)) refBoxes.set(key, { current: initial });
    return refBoxes.get(key)!;
  },
}));

/**
 * Run the hook's effect body without a React renderer: capture the handler
 * Capacitor would receive, then invoke it like a real back press.
 */
async function mountAndGetHandler(): Promise<() => void> {
  const { useAndroidBackButton } = await import("./back-button");

  let handler: (() => void) | undefined;
  addListener.mockImplementation((_event: string, cb: () => void) => {
    handler = cb;
    return Promise.resolve({ remove: vi.fn() });
  });

  // Deliberate: React's hooks are mocked above, so this is a plain function
  // call driving the hook body, not a render. rules-of-hooks cannot know that.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useAndroidBackButton();
  pendingEffects.forEach((fn) => fn());

  if (!handler) throw new Error("back button handler was never registered");
  return handler;
}

describe("useAndroidBackButton", () => {
  beforeEach(() => {
    vi.resetModules();
    isNative.mockReset();
    addListener.mockReset();
    exitApp.mockReset();
    toast.mockReset();
    document.body.innerHTML = "";
    pendingEffects.length = 0;
    refBoxes.clear();
    refIndex = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers nothing on web", async () => {
    isNative.mockReturnValue(false);
    const { useAndroidBackButton } = await import("./back-button");

    useAndroidBackButton();
    pendingEffects.forEach((fn) => fn());

    expect(addListener).not.toHaveBeenCalled();
  });

  it("closes an open dialog first, without navigating or exiting", async () => {
    isNative.mockReturnValue(true);
    const handler = await mountAndGetHandler();

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    const keys: string[] = [];
    dialog.addEventListener("keydown", (e) => keys.push((e as KeyboardEvent).key));
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    handler();

    expect(keys).toEqual(["Escape"]);
    expect(back).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("goes up in history when not on a root route", async () => {
    isNative.mockReturnValue(true);
    window.history.pushState({}, "", "/orders/abc-123");
    const handler = await mountAndGetHandler();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    handler();

    expect(back).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("requires a confirming second press to exit from a root route", async () => {
    isNative.mockReturnValue(true);
    window.history.pushState({}, "", "/");
    const handler = await mountAndGetHandler();

    // First press: arm and warn, do NOT exit.
    handler();
    expect(exitApp).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({ title: "Press back again to exit" });

    // Second press within the window: exit.
    handler();
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it("does not exit when the second press is too late", async () => {
    isNative.mockReturnValue(true);
    window.history.pushState({}, "", "/");
    const handler = await mountAndGetHandler();

    handler();
    expect(exitApp).not.toHaveBeenCalled();

    // Past the 2s confirm window -- this press re-arms rather than exiting.
    vi.advanceTimersByTime(2500);
    handler();
    expect(exitApp).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(2);
  });
});
