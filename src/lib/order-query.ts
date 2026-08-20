import type { OrderFilterState } from "@/components/orders/orderFilterTypes";
import { ACTIVE_STATUSES, CANCELLED_STATUSES } from "@/lib/order-filters";

export const ORDERS_PAGE_SIZE = 10;

/**
 * A keyset cursor. Pagination is ordered by (created_at desc, id desc) rather
 * than a numeric offset: created_at is NOT unique -- bulk-seeded rows and two
 * orders placed in the same second both collide -- and an offset shifts under
 * any insert, which silently skips or duplicates rows across page boundaries.
 */
export interface OrderCursor {
  createdAt: string;
  id: string;
}

export interface OrderStatusFilterPlan {
  /** Statuses to match, or null when the filter admits every status. */
  statuses: string[] | null;
}

/** Which order.status values a status tab admits, mirroring filterOrders. */
export function statusesForFilter(filter: OrderFilterState["status"]): string[] | null {
  if (filter === "active") return ACTIVE_STATUSES;
  if (filter === "delivered") return ["delivered"];
  if (filter === "cancelled") return CANCELLED_STATUSES;
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * Translate a date preset into an absolute ISO range.
 *
 * `now` is injected so this stays a pure function and the presets are testable
 * without freezing the clock.
 */
export function dateRangeForFilter(filters: OrderFilterState, now: number): DateRange {
  const { datePreset } = filters;
  if (datePreset === "all") return {};

  if (datePreset === "custom") {
    const range: DateRange = {};
    if (filters.customFrom) range.from = new Date(filters.customFrom).toISOString();
    // The custom `to` is a calendar day, and orders placed later that same day
    // must still match -- so the bound is the end of that day, not its midnight.
    if (filters.customTo)
      range.to = new Date(new Date(filters.customTo).getTime() + DAY_MS - 1).toISOString();
    return range;
  }

  const days = datePreset === "7d" ? 7 : datePreset === "30d" ? 30 : 90;
  return { from: new Date(now - days * DAY_MS).toISOString() };
}

/**
 * Rows after this cursor in (created_at desc, id desc) order, expressed as a
 * PostgREST `or` filter: created_at < c OR (created_at = c AND id < cursorId).
 */
export function keysetFilter(cursor: OrderCursor): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

/** The cursor for the next page, or null when the list is exhausted. */
export function nextCursor<T extends { created_at: string; id: string }>(
  page: T[],
  pageSize: number = ORDERS_PAGE_SIZE,
): OrderCursor | null {
  if (page.length < pageSize) return null;
  const last = page[page.length - 1];
  return { createdAt: last.created_at, id: last.id };
}
