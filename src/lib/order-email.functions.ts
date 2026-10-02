import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrderEmailEvent = "order_placed" | "deliverable_submitted" | "dispute_opened";

const COPY: Record<OrderEmailEvent, { title: string; body: (t: string) => string }> = {
  order_placed: {
    title: "طلب جديد على خدمتك",
    body: (t) => `وصلك طلب جديد «${t}» والمبلغ محجوز في الضمان. ابدأ العمل من مساحة العمل.`,
  },
  deliverable_submitted: {
    title: "تم تسليم ملفات طلبك",
    body: (t) => `قام البائع برفع تسليم جديد للطلب «${t}». راجعه ثم أكّد الاستلام أو اطلب تعديلاً.`,
  },
  dispute_opened: {
    title: "تم فتح نزاع على طلب",
    body: (t) => `فُتح نزاع رسمي على الطلب «${t}» وتم تجميد مبلغ الضمان حتى قرار الإدارة.`,
  },
};

/**
 * Sends lifecycle emails for one order event. Caller must be a party to the order.
 * Every failure is swallowed (and logged) — email never blocks order flows.
 */
export const notifyOrderEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        event: z.enum(["order_placed", "deliverable_submitted", "dispute_opened"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { data: o } = await context.supabase
        .from("orders")
        .select("id,title,buyer_id,seller_id,status")
        .eq("id", data.orderId)
        .maybeSingle();
      if (!o || (o.buyer_id !== context.userId && o.seller_id !== context.userId)) return { sent: 0 };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let recipients: string[] = [];
      let link = "/workspace";
      if (data.event === "order_placed") {
        if (context.userId !== o.buyer_id) return { sent: 0 };
        recipients = [o.seller_id];
      } else if (data.event === "deliverable_submitted") {
        if (context.userId !== o.seller_id) return { sent: 0 };
        recipients = [o.buyer_id];
      } else {
        if (o.status !== "disputed") return { sent: 0 };
        const other = context.userId === o.buyer_id ? o.seller_id : o.buyer_id;
        const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        recipients = [other, ...(admins ?? []).map((a) => a.user_id)];
        link = "/admin/disputes";
      }

      const { sendPlatformEmail, notificationEmailHtml } = await import("./resend.server");
      const copy = COPY[data.event];
      const body = copy.body(o.title);
      let sent = 0;
      for (const uid of Array.from(new Set(recipients))) {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          const email = u.user?.email;
          if (!email) continue;
          const isAdminCopy = data.event === "dispute_opened" && uid !== o.buyer_id && uid !== o.seller_id;
          const r = await sendPlatformEmail({
            to: email,
            subject: `مُنجِز — ${copy.title}`,
            html: notificationEmailHtml(copy.title, body, isAdminCopy ? link : "/workspace"),
            text: `${copy.title}\n\n${body}`,
            idempotencyKey: `${data.event}-${o.id}-${uid}`,
            actorId: context.userId,
          });
          if (r.delivered) sent++;
        } catch (e) {
          console.error("order email failed", data.event, e);
        }
      }
      return { sent };
    } catch (e) {
      console.error("notifyOrderEvent failed", e);
      return { sent: 0 };
    }
  });
