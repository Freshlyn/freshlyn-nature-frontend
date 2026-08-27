import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  rememberAuthRedirect,
  takeAuthRedirect,
  clearAuthRedirect,
} from "./auth-redirect";

describe("auth redirect", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when nothing is pending", () => {
    expect(takeAuthRedirect()).toBeNull();
  });

  it("returns the remembered path", () => {
    rememberAuthRedirect("/cart");
    expect(takeAuthRedirect()).toBe("/cart");
  });

  it("clears the target once taken, so the next login goes Home", () => {
    rememberAuthRedirect("/cart");
    takeAuthRedirect();
    expect(takeAuthRedirect()).toBeNull();
  });

  it("keeps the most recent target when remembered twice", () => {
    rememberAuthRedirect("/cart");
    rememberAuthRedirect("/orders");
    expect(takeAuthRedirect()).toBe("/orders");
  });

  it("refuses to remember the auth screens themselves", () => {
    rememberAuthRedirect("/login");
    expect(takeAuthRedirect()).toBeNull();
    rememberAuthRedirect("/register");
    expect(takeAuthRedirect()).toBeNull();
  });

  it("does not clobber a real target with an auth screen", () => {
    rememberAuthRedirect("/cart");
    rememberAuthRedirect("/login");
    expect(takeAuthRedirect()).toBe("/cart");
  });

  it("clearAuthRedirect drops a pending target", () => {
    rememberAuthRedirect("/cart");
    clearAuthRedirect();
    expect(takeAuthRedirect()).toBeNull();
  });

  // Private mode and some embedded webviews make sessionStorage throw on
  // access rather than merely fail to persist. Login must still work there.
  //
  // The whole object is substituted rather than spied on: jsdom serves
  // sessionStorage through a Proxy, so a vi.spyOn a method is installed but
  // never invoked -- property access goes straight past it and the test
  // silently exercises real storage instead of the failure it claims to.
  it("survives storage that throws", () => {
    const unavailable = () => {
      throw new Error("unavailable");
    };
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: { getItem: unavailable, setItem: unavailable, removeItem: unavailable },
    });
    try {
      expect(() => rememberAuthRedirect("/cart")).not.toThrow();
      expect(takeAuthRedirect()).toBeNull();
      expect(() => clearAuthRedirect()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });
});
