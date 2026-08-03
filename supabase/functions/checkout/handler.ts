export type DeliveryType = "one_time" | "subscription";
export type SubscriptionFrequency = "daily" | "alternate" | "every_3rd";

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
  }): Promise<string>;
  applyPaymentResult(orderId: string, paymentStatus: string, paymentMethod: string): Promise<void>;
  fetchOrderWithItems(orderId: string): Promise<Record<string, unknown>>;
}

export type CheckoutResult =
  | { status: 401; body: { error: string } }
  | { status: 400; body: { error: string } }
  | { status: 409; body: { error: string; rejectedItems: RejectedItem[] } }
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

// Payment stand-in (spec Section 8): records which method the customer chose, but
// collects nothing. Both methods therefore leave the order awaiting payment —
// "razorpay" means "online payment intended", not "money received". Capturing an
// online payment is the gateway integration that replaces this function later.
export function processPayment(
  _order: { id: string },
  paymentMethod: PaymentMethod,
): { paymentStatus: string; paymentMethod: PaymentMethod } {
  return { paymentStatus: "pending", paymentMethod };
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

  const orderId = await deps.createOrder({
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
  });

  const paymentResult = processPayment({ id: orderId }, paymentMethod);
  await deps.applyPaymentResult(orderId, paymentResult.paymentStatus, paymentResult.paymentMethod);

  const order = await deps.fetchOrderWithItems(orderId);
  return { status: 200, body: order };
}
