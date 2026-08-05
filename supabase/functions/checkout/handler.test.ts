import { assertEquals } from "jsr:@std/assert@1";
import { handleCheckout, type AddressRecord, type CheckoutDeps, type CheckoutInput } from "./handler.ts";
import { RazorpayError } from "../_shared/razorpay.ts";

interface VariantFixture {
  price: number;
  stockQuantity: number;
  maxQuantityPerOrder: number;
}

interface SubscriptionOptionFixture {
  enabled: boolean;
  frequencies: string[];
  discountPercent: number;
}

function makeDeps(options: {
  userId?: string | null;
  variants?: Record<string, VariantFixture>;
  subscriptionOptions?: Record<string, SubscriptionOptionFixture>;
  address?: AddressRecord | null;
  razorpayThrows?: boolean;
} = {}) {
  const calls: {
    createOrder: unknown[];
    supersede: unknown[];
    persistRazorpayOrderId: unknown[];
    razorpayCreateOrder: unknown[];
    /**
     * Every dep invocation in the order it happened. The supersede sweep filters
     * on payment_method, so it MUST run before the order row exists; asserting
     * only on call counts would pass even if the two were reordered.
     */
    order: string[];
  } = {
    createOrder: [],
    supersede: [],
    persistRazorpayOrderId: [],
    razorpayCreateOrder: [],
    order: [],
  };

  const deps: CheckoutDeps = {
    async getCallerUserId() {
      return options.userId === undefined ? "user-1" : options.userId;
    },
    async getVariant(productId, variantId) {
      return options.variants?.[`${productId}/${variantId}`] ?? null;
    },
    async getSubscriptionOption(productId, durationDays) {
      return options.subscriptionOptions?.[`${productId}/${durationDays}`] ?? null;
    },
    async getAddress(_addressId) {
      return options.address === undefined
        ? {
          flatHouse: "Flat 1",
          building: null,
          street: null,
          landmark: null,
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        }
        : options.address;
    },
    async createOrder(params) {
      calls.createOrder.push(params);
      calls.order.push("createOrder");
      return "order-1";
    },
    async supersedeStalePendingOrders(userId) {
      calls.supersede.push({ userId });
      calls.order.push("supersede");
    },
    async persistRazorpayOrderId(orderId, razorpayOrderId) {
      calls.persistRazorpayOrderId.push({ orderId, razorpayOrderId });
    },
    razorpay: {
      createOrder(params) {
        calls.razorpayCreateOrder.push(params);
        if (options.razorpayThrows) {
          return Promise.reject(new RazorpayError("simulated failure"));
        }
        return Promise.resolve({ id: "order_rzp_1" });
      },
    },
    razorpayKeyId: "rzp_test_key",
    async fetchOrderWithItems(orderId) {
      return { id: orderId, items: [] };
    },
  };

  return { deps, calls };
}

Deno.test("checkout returns 401 when there is no authenticated caller", async () => {
  const { deps } = makeDeps({ userId: null });
  const input: CheckoutInput = { addressId: "addr-1", items: [] };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 401);
});

Deno.test("checkout returns 400 when addressId or items are missing", async () => {
  const { deps } = makeDeps();
  const result = await handleCheckout(deps, { addressId: "", items: [] });
  assertEquals(result.status, 400);
});

Deno.test("checkout returns 400 when the address is not found", async () => {
  const { deps } = makeDeps({ address: null });
  const input: CheckoutInput = {
    addressId: "addr-missing",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 400);
});

Deno.test("checkout returns 409 with insufficient_stock when a one_time item exceeds stock", async () => {
  const { deps } = makeDeps({
    variants: { "p1/v1": { price: 2.99, stockQuantity: 1, maxQuantityPerOrder: 100 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 5, deliveryType: "one_time" }],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 409);
  if (result.status === 409) {
    assertEquals(result.body.rejectedItems[0].reason, "insufficient_stock");
  }
});

Deno.test("checkout returns 409 with quantity_limit_exceeded and the allowed max", async () => {
  const { deps } = makeDeps({
    variants: { "p1/v1": { price: 2.99, stockQuantity: 1000, maxQuantityPerOrder: 10 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 20, deliveryType: "one_time" }],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 409);
  if (result.status === 409) {
    assertEquals(result.body.rejectedItems[0].reason, "quantity_limit_exceeded");
    assertEquals(result.body.rejectedItems[0].maxQuantityPerOrder, 10);
  }
});

Deno.test("checkout does not call createOrder when any item fails validation", async () => {
  const { deps, calls } = makeDeps({
    variants: {
      "p1/v1": { price: 2.99, stockQuantity: 0, maxQuantityPerOrder: 100 },
      "p2/v2": { price: 1.0, stockQuantity: 100, maxQuantityPerOrder: 100 },
    },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [
      { productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" },
      { productId: "p2", variantId: "v2", quantity: 1, deliveryType: "one_time" },
    ],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 409);
  assertEquals(calls.createOrder.length, 0);
});

Deno.test("checkout returns 400 for an invalid subscription plan", async () => {
  const { deps } = makeDeps({
    variants: { "p1/v1": { price: 2.99, stockQuantity: 100, maxQuantityPerOrder: 100 } },
    subscriptionOptions: {},
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [
      {
        productId: "p1",
        variantId: "v1",
        quantity: 1,
        deliveryType: "subscription",
        subscriptionDurationDays: 30,
        subscriptionFrequency: "daily",
      },
    ],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 400);
});

Deno.test("checkout records the razorpay payment method the caller selected", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 2.0, stockQuantity: 100, maxQuantityPerOrder: 100 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
    paymentMethod: "razorpay",
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  // The method rides on createOrder itself -- there is no separate UPDATE that
  // could leave the row briefly at the column default.
  assertEquals((calls.createOrder[0] as { paymentMethod: string }).paymentMethod, "razorpay");
});

Deno.test("checkout defaults to cod when the caller omits a payment method", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 2.0, stockQuantity: 100, maxQuantityPerOrder: 100 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  assertEquals((calls.createOrder[0] as { paymentMethod: string }).paymentMethod, "cod");
});

Deno.test("checkout returns 400 for an unrecognised payment method", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 2.0, stockQuantity: 100, maxQuantityPerOrder: 100 } },
  });
  const input = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
    paymentMethod: "bitcoin",
  } as unknown as CheckoutInput;
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 400);
  // Rejected before any order row is written.
  assertEquals(calls.createOrder.length, 0);
});

Deno.test("checkout computes subtotal and a flat delivery fee under the free-delivery threshold", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 2.0, stockQuantity: 100, maxQuantityPerOrder: 100 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [{ productId: "p1", variantId: "v1", quantity: 3, deliveryType: "one_time" }],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  const createOrderCall = calls.createOrder[0] as { subtotal: number; deliveryFee: number; total: number };
  assertEquals(createOrderCall.subtotal, 6);
  assertEquals(createOrderCall.deliveryFee, 5.0);
  assertEquals(createOrderCall.total, 11.0);
});

Deno.test("checkout computes a subscription line using duration and discount, and waives the delivery fee above the threshold", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 3.0, stockQuantity: 100, maxQuantityPerOrder: 100 } },
    subscriptionOptions: {
      "p1/30": { enabled: true, frequencies: ["daily"], discountPercent: 10 },
    },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    items: [
      {
        productId: "p1",
        variantId: "v1",
        quantity: 1,
        deliveryType: "subscription",
        subscriptionDurationDays: 30,
        subscriptionFrequency: "daily",
        subscriptionStartDate: "2026-08-01",
      },
    ],
  };
  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  const createOrderCall = calls.createOrder[0] as { subtotal: number; deliveryFee: number; total: number };
  // 3.00 * 1 * 30 deliveries * (1 - 10%) = 81
  assertEquals(createOrderCall.subtotal, 81);
  assertEquals(createOrderCall.deliveryFee, 0);
  assertEquals(createOrderCall.total, 81);
});

Deno.test("cod checkout decrements stock at creation", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    paymentMethod: "cod",
    items: [{ productId: "p1", variantId: "v1", quantity: 2, deliveryType: "one_time" }],
  };

  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  assertEquals((calls.createOrder[0] as { decrementStock: boolean }).decrementStock, true);
  assertEquals(calls.razorpayCreateOrder.length, 0);
});

Deno.test("razorpay checkout defers the stock decrement", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    paymentMethod: "razorpay",
    items: [{ productId: "p1", variantId: "v1", quantity: 2, deliveryType: "one_time" }],
  };

  const result = await handleCheckout(deps, input);
  assertEquals(result.status, 200);
  assertEquals((calls.createOrder[0] as { decrementStock: boolean }).decrementStock, false);
});

Deno.test("razorpay checkout sends the SERVER-computed total in paise", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 1.99, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  const input: CheckoutInput = {
    addressId: "addr-1",
    paymentMethod: "razorpay",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  };

  await handleCheckout(deps, input);
  // 1.99 subtotal + 5.00 delivery fee = 6.99 -> 699 paise, not 698.
  assertEquals((calls.razorpayCreateOrder[0] as { amountPaise: number }).amountPaise, 699);
});

Deno.test("razorpay checkout returns the razorpay order id and key id", async () => {
  const { deps } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  const result = await handleCheckout(deps, {
    addressId: "addr-1",
    paymentMethod: "razorpay",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  });

  assertEquals(result.status, 200);
  const body = result.body as Record<string, unknown>;
  assertEquals(body.razorpayOrderId, "order_rzp_1");
  assertEquals(body.razorpayKeyId, "rzp_test_key");
});

Deno.test("razorpay checkout supersedes stale pending attempts first", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  await handleCheckout(deps, {
    addressId: "addr-1",
    paymentMethod: "razorpay",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  });

  assertEquals(calls.supersede.length, 1);
  assertEquals((calls.supersede[0] as { userId: string }).userId, "user-1");

  // Ordering is the whole point, not just that both ran. The sweep filters on
  // payment_method = 'razorpay'; if it ran after createOrder it would be a
  // self-sweep of the row just created, and worse, a CONCURRENT checkout's sweep
  // could slip into the gap and miss this order entirely -- leaving two live
  // payable razorpay orders that each decrement stock on confirm. This assertion
  // must fail if anyone reorders these two calls.
  const supersedeIndex = calls.order.indexOf("supersede");
  const createIndex = calls.order.indexOf("createOrder");
  assertEquals(supersedeIndex, 0);
  assertEquals(createIndex, 1);
  assertEquals(supersedeIndex < createIndex, true);
});

// COD must never trigger the sweep: a pending COD order is legitimately
// awaiting collection, not an abandoned payment.
Deno.test("cod checkout does NOT supersede pending orders", async () => {
  const { deps, calls } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
  });
  await handleCheckout(deps, {
    addressId: "addr-1",
    paymentMethod: "cod",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  });

  assertEquals(calls.supersede.length, 0);
});

Deno.test("a razorpay API failure returns 502", async () => {
  const { deps } = makeDeps({
    variants: { "p1/v1": { price: 10, stockQuantity: 5, maxQuantityPerOrder: 10 } },
    razorpayThrows: true,
  });
  const result = await handleCheckout(deps, {
    addressId: "addr-1",
    paymentMethod: "razorpay",
    items: [{ productId: "p1", variantId: "v1", quantity: 1, deliveryType: "one_time" }],
  });

  assertEquals(result.status, 502);
});
