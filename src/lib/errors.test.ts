import { describe, it, expect } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { getErrorMessage, isNetworkError } from "./errors";

// A lost connection has to be told apart from a server saying no: the two need
// different words in the toast ("check your connection and retry" vs. whatever
// the backend explained). These pin the classifier down, including the browser
// differences that are easy to regress on.

describe("isNetworkError", () => {
  it("recognises the supabase functions fetch failure", () => {
    expect(isNetworkError(new FunctionsFetchError(new TypeError("Failed to fetch")))).toBe(true);
  });

  // The exact TypeError message differs per engine, and a matcher tuned only
  // to Chrome silently misclassifies every Safari/Firefox user.
  it.each([
    ["Chrome", "Failed to fetch"],
    ["Safari", "Load failed"],
    ["Firefox", "NetworkError when attempting to fetch resource."],
    ["React Native", "Network request failed"],
  ])("recognises a bare fetch rejection on %s", (_engine, message) => {
    expect(isNetworkError(new TypeError(message))).toBe(true);
  });

  it("does not treat an unrelated TypeError as a network failure", () => {
    expect(isNetworkError(new TypeError("x is not a function"))).toBe(false);
  });

  it("does not treat ordinary errors or non-errors as network failures", () => {
    expect(isNetworkError(new Error("Invalid or expired OTP"))).toBe(false);
    expect(isNetworkError({ message: "nope" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("explains a dropped connection in plain language", async () => {
    // The point of the fix: never surface a raw "Failed to fetch" to a
    // customer -- it reads like a crash and suggests no action.
    const message = await getErrorMessage(
      new FunctionsFetchError(new TypeError("Failed to fetch")),
    );
    expect(message).toMatch(/no internet connection/i);
    expect(message).not.toMatch(/failed to fetch/i);
  });

  it("prefers the server's own explanation for a structured HTTP failure", async () => {
    const response = new Response(JSON.stringify({ error: "Invalid or expired OTP" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    expect(await getErrorMessage(new FunctionsHttpError(response))).toBe("Invalid or expired OTP");
  });

  it("falls back to an error's message", async () => {
    expect(await getErrorMessage(new Error("Something specific"))).toBe("Something specific");
  });

  it("has a last-resort message for values that carry nothing useful", async () => {
    expect(await getErrorMessage(null)).toBe("Something went wrong.");
  });
});
