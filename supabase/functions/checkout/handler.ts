import { RazorpayError, toPaise, type RazorpayClient } from "../_shared/razorpay.ts";
import { isValidDeliverySlot } from "../_shared/delivery-slots.ts";

export type DeliveryType = "one_time" | "subscription";
export type SubscriptionFrequency = "daily" | "alternate";

export interface CheckoutItemInput {
  productId: string;
  variantId: string;
  quantity: number;
  deliveryType: DeliveryType;
  subscriptionDurationDays?: number;
  subscriptionFrequency?: SubscriptionFrequency;
  subscriptionStartDate?: string;
}

export type PaymentMethod = "cod" | "razorpay";

export interface CheckoutInput {
  addressId: string;
  items: CheckoutItemInput[];
  paymentMethod?: PaymentMethod;
  /** 24-hour "HH:MM"; must be one of the allowlisted delivery slots. */
  deliverySlot?: string;
}

export interface RejectedItem {
  productId: string;
  variantId: string;
  reason: "insufficient_stock" | "quantity_limit_exceeded";
  maxQuantityPerOrder?: number;
}

export interface AddressRecord {
  flatHouse: string;
  building: string | null;
  street: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface CheckoutDeps {
  getCallerUserId(): Promise<string | null>;
  getVariant(
    productId: string,
    variantId: string,
  ): Promise<{ price: number; stockQuantity: number; maxQuantityPerOrder: number } | null>;
  getSubscriptionOption(
    productId: string,
    durationDays: number,
  ): Promise<{ enabled: boolean; frequencies: string[]; discountPercent: number } | null>;
  getAddress(addressId: string): Promise<AddressRecord | null>;
  createOrder(params: {
    userId: string;
    addressId: string;
    deliveryAddress: string;
    items: Array<{
      product_id: string;
      variant_id: string;
      quantity: number;
      unit_price: number;
      delivery_type: DeliveryType;
      subscription_duration_days?: number;
      subscription_frequency?: SubscriptionFrequency;
      subscription_start_date?: string;
      discount_percent?: number;
    }>;
    subtotal: number;
    deliveryFee: number;
    total: number;
    decrementStock: boolean;
    paymentMethod: PaymentMethod;
    deliverySlot?: string;
  }): Promise<string>;
  /**
   * Marks the caller's existing pending *razorpay* orders as failed.
   *
   * Scoped to razorpay deliberately: a pending COD order is awaiting collection
   * and is perfectly healthy. Only an abandoned online attempt is dead.
   */
  supersedeStalePendingOrders(userId: string): Promise<void>;
  persistRazorpayOrderId(orderId: string, razorpayOrderId: string): Promise<void>;
  razorpay: RazorpayClient;
  razorpayKeyId: string;
  fetchOrderWithItems(orderId: string): Promise<Record<string, unknown>>;
}

export type CheckoutResult =
  | { status: 401; body: { error: string } }
  | { status: 400; body: { error: string } }
  | { status: 409; body: { error: string; rejectedItems: RejectedItem[] } }
  | { status: 422; body: { error: string; code: "address_not_serviceable" } }
  | { status: 502; body: { error: string } }
  | { status: 200; body: Record<string, unknown> };

export function buildDeliveryAddress(address: AddressRecord): string {
  return [
    address.flatHouse,
    address.building,
    address.street,
    address.landmark,
    address.city,
    `${address.state} ${address.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function handleCheckout(deps: CheckoutDeps, input: CheckoutInput): Promise<CheckoutResult> {
  const userId = await deps.getCallerUserId();
  if (!userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!input.addressId || !Array.isArray(input.items) || input.items.length === 0) {
    return { status: 400, body: { error: "addressId and at least one item are required" } };
  }

  // Defaults to cod so existing clients that omit the field keep working.
  const paymentMethod: PaymentMethod = input.paymentMethod ?? "cod";
  if (paymentMethod !== "cod" && paymentMethod !== "razorpay") {
    return { status: 400, body: { error: "paymentMethod must be 'cod' or 'razorpay'" } };
  }

  // The slot is interpolated into a `time` column by create_order. Validate it
  // against the fixed allowlist rather than trusting the client: an arbitrary
  // string here would reach SQL, and a merely well-formed one ("03:15") would
  // still schedule a delivery outside any shift we actually run.
  if (input.deliverySlot !== undefined && !isValidDeliverySlot(input.deliverySlot)) {
    return { status: 400, body: { error: "deliverySlot is not an available delivery time" } };
  }

  const address = await deps.getAddress(input.addressId);
  if (!address) {
    return { status: 400, body: { error: "Address not found" } };
  }

  const rejectedItems: RejectedItem[] = [];
  const resolvedItems: Array<{ input: CheckoutItemInput; unitPrice: number; discountPercent?: number }> = [];

  for (const item of input.items) {
    const variant = await deps.getVariant(item.productId, item.variantId);
    if (!variant) {
      return {
        status: 400,
        body: { error: `Unknown product/variant: ${item.productId}/${item.variantId}` },
      };
    }

    if (variant.stockQuantity < item.quantity) {
      rejectedItems.push({ productId: item.productId, variantId: item.variantId, reason: "insufficient_stock" });
      continue;
    }

    if (item.quantity > variant.maxQuantityPerOrder) {
      rejectedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "quantity_limit_exceeded",
        maxQuantityPerOrder: variant.maxQuantityPerOrder,
      });
      continue;
    }

    let discountPercent: number | undefined;
    if (item.deliveryType === "subscription") {
      if (!item.subscriptionDurationDays || !item.subscriptionFrequency) {
        return {
          status: 400,
          body: { error: "subscriptionDurationDays and subscriptionFrequency are required for subscription items" },
        };
      }
      const option = await deps.getSubscriptionOption(item.productId, item.subscriptionDurationDays);
      if (!option || !option.enabled || !option.frequencies.includes(item.subscriptionFrequency)) {
        return { status: 400, body: { error: `Invalid subscription plan for product ${item.productId}` } };
      }
      discountPercent = option.discountPercent;
    }

    resolvedItems.push({ input: item, unitPrice: variant.price, discountPercent });
  }

  if (rejectedItems.length > 0) {
    return { status: 409, body: { error: "One or more items failed validation", rejectedItems } };
  }

  const subtotal = round2(
    resolvedItems.reduce((sum, r) => {
      if (r.input.deliveryType === "subscription") {
        const durationDays = r.input.subscriptionDurationDays ?? 0;
        return sum + r.unitPrice * r.input.quantity * durationDays * (1 - (r.discountPercent ?? 0) / 100);
      }
      return sum + r.unitPrice * r.input.quantity;
    }, 0),
  );
  const deliveryFee = subtotal > 50 ? 0 : 5.0;
  const total = round2(subtotal + deliveryFee);
  const deliveryAddress = buildDeliveryAddress(address);

  // Retrying after an abandoned payment must not leave a trail of pending rows
  // that are indistinguishable from healthy COD orders. Sweep before creating.
  if (paymentMethod === "razorpay") {
    await deps.supersedeStalePendingOrders(userId);
  }

  let orderId: string;
  try {
    orderId = await deps.createOrder({
      userId,
      addressId: input.addressId,
      deliveryAddress,
      items: resolvedItems.map((r) => ({
        product_id: r.input.productId,
        variant_id: r.input.variantId,
        quantity: r.input.quantity,
        unit_price: r.unitPrice,
        delivery_type: r.input.deliveryType,
        subscription_duration_days: r.input.subscriptionDurationDays,
        subscription_frequency: r.input.subscriptionFrequency,
        subscription_start_date: r.input.subscriptionStartDate,
        discount_percent: r.discountPercent,
      })),
      subtotal,
      deliveryFee,
      total,
      // COD orders are real on placement. Razorpay orders exist before payment,
      // so their stock moves only once the webhook confirms money arrived.
      deliverySlot: input.deliverySlot,
      decrementStock: paymentMethod === "cod",
      // Set in the same INSERT as the row, not in a follow-up UPDATE. The sweep
      // above filters on payment_method, so a row that is briefly 'cod' before
      // becoming 'razorpay' is invisible to a concurrent checkout's sweep, and two
      // live payable orders would each get their stock decremented on confirm.
      paymentMethod,
    });
  } catch (error) {
    // create_order raises P0001 'address not serviceable' BEFORE it writes
    // anything, so there is no order row, no reserved stock and no
    // subscription_deliveries to clean up here.
    //
    // Matched on the message rather than the code because supabase-js flattens
    // a Postgres exception into a plain Error by the time index.ts rethrows it.
    // Narrow deliberately: every other failure must keep bubbling to the
    // catch-all in index.ts, so a genuine database fault is never mis-reported
    // to the customer as an out-of-area address.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("address not serviceable")) {
      return {
        status: 422,
        body: {
          error: "We don't deliver to this address yet.",
          code: "address_not_serviceable",
        },
      };
    }
    throw error;
  }

  if (paymentMethod === "cod") {
    const order = await deps.fetchOrderWithItems(orderId);
    return { status: 200, body: order };
  }

  let razorpayOrderId: string;
  try {
    // `total` is the server's own figure, computed from server-side prices. The
    // client supplies only ids and quantities and can never influence it.
    const rzpOrder = await deps.razorpay.createOrder({
      amountPaise: toPaise(total),
      receipt: orderId,
      notes: { local_order_id: orderId },
    });
    razorpayOrderId = rzpOrder.id;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[checkout] razorpay order creation failed:", detail);
    if (error instanceof RazorpayError) {
      // The local order survives as pending. It holds no stock, so it is inert,
      // and the next attempt supersedes it.
      return { status: 502, body: { error: "Could not start payment. Please try again." } };
    }
    throw error;
  }

  await deps.persistRazorpayOrderId(orderId, razorpayOrderId);

  const order = await deps.fetchOrderWithItems(orderId);
  return {
    status: 200,
    body: { ...order, razorpayOrderId, razorpayKeyId: deps.razorpayKeyId },
  };
}
