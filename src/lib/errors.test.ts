import { describe, it, expect } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { getErrorMessage, isNetworkError, getRejectedItems } from "./errors";

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

  it("names the offending item and its cap for a quantity_limit_exceeded 409", async () => {
    // The generic body.error here is "One or more items failed validation",
    // which tells a shopper nothing about which item or what to do. The
    // rejectedItems payload carries the actionable part.
    const response = new Response(
      JSON.stringify({
        error: "One or more items failed validation",
        rejectedItems: [
          {
            productId: "p1",
            variantId: "v1",
            reason: "quantity_limit_exceeded",
            maxQuantityPerOrder: 10,
          },
        ],
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
    const message = await getErrorMessage(new FunctionsHttpError(response));
    expect(message).toMatch(/10/);
    expect(message).not.toBe("One or more items failed validation");
  });

  it("explains an insufficient_stock rejection without inventing a limit", async () => {
    const response = new Response(
      JSON.stringify({
        error: "One or more items failed validation",
        rejectedItems: [{ productId: "p1", variantId: "v1", reason: "insufficient_stock" }],
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
    const message = await getErrorMessage(new FunctionsHttpError(response));
    expect(message).toMatch(/stock/i);
  });

  it("summarises when several items are rejected at once", async () => {
    const response = new Response(
      JSON.stringify({
        error: "One or more items failed validation",
        rejectedItems: [
          { productId: "p1", variantId: "v1", reason: "insufficient_stock" },
          { productId: "p2", variantId: "v2", reason: "quantity_limit_exceeded", maxQuantityPerOrder: 10 },
        ],
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
    const message = await getErrorMessage(new FunctionsHttpError(response));
    expect(message).toMatch(/2 items/i);
  });

  it("keeps the server message when a failure carries no rejectedItems", async () => {
    // 422 serviceability and friends must not be reworded by the 409 path.
    const response = new Response(
      JSON.stringify({ error: "We don't deliver to this address yet" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
    expect(await getErrorMessage(new FunctionsHttpError(response))).toBe(
      "We don't deliver to this address yet",
    );
  });

  it("falls back to an error's message", async () => {
    expect(await getErrorMessage(new Error("Something specific"))).toBe("Something specific");
  });

  it("has a last-resort message for values that carry nothing useful", async () => {
    expect(await getErrorMessage(null)).toBe("Something went wrong.");
  });
});

// getErrorMessage only produces prose ("an item is out of stock"), which cannot
// tell a customer WHICH of eight lines to fix. These pin down the structured
// extraction the cart uses to mark the offending line.
describe("getRejectedItems", () => {
  function http409(body: unknown): FunctionsHttpError {
    return new FunctionsHttpError(
      new Response(JSON.stringify(body), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  it("extracts the product/variant pairs the server refused", async () => {
    const items = await getRejectedItems(
      http409({
        error: "One or more items failed validation",
        rejectedItems: [
          { productId: "p1", variantId: "v1", reason: "insufficient_stock" },
          { productId: "p2", variantId: "v2", reason: "quantity_limit_exceeded" },
        ],
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ productId: "p1", variantId: "v1" });
    expect(items[1]).toMatchObject({ productId: "p2", variantId: "v2" });
  });

  it("returns nothing for a failure that carries no rejectedItems", async () => {
    // A 422 serviceability rejection must not mark any cart line.
    expect(await getRejectedItems(http409({ error: "we don't deliver here" }))).toEqual([]);
  });

  it("returns nothing for a network error", async () => {
    expect(await getRejectedItems(new FunctionsFetchError("offline"))).toEqual([]);
    expect(await getRejectedItems(new TypeError("Failed to fetch"))).toEqual([]);
  });

  it("returns nothing for a non-error value", async () => {
    expect(await getRejectedItems(null)).toEqual([]);
    expect(await getRejectedItems(undefined)).toEqual([]);
  });

  it("skips malformed entries rather than marking the wrong line", async () => {
    // A missing id cannot be matched to a cart line; keeping it would risk
    // marking an unrelated item.
    const items = await getRejectedItems(
      http409({
        rejectedItems: [
          { productId: "p1", variantId: "v1", reason: "insufficient_stock" },
          { reason: "insufficient_stock" },
          null,
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("p1");
  });

  it("survives a body that is not JSON", async () => {
    const err = new FunctionsHttpError(new Response("<html>502</html>", { status: 502 }));
    expect(await getRejectedItems(err)).toEqual([]);
  });
});
