import { notifyOrderEvent, type OrderEmailEvent } from "@/lib/order-email.functions";

/**
 * Fire-and-forget order email. Never awaited by callers and never throws,
 * so a mail outage can't block or roll back the order action itself.
 */
export function fireOrderEmail(orderId: string | null | undefined, event: OrderEmailEvent) {
  if (!orderId) return;
  void notifyOrderEvent({ data: { orderId, event } }).catch((e) => {
    console.warn("order email skipped", e);
  });
}
