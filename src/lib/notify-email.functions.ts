import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Emails the signed-in user a copy of one of their own order notifications via Resend. */
export const emailNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: n, error } = await context.supabase
      .from("notifications")
      .select("id,title,body,link,user_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !n) return { sent: false };
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false };
    const { sendPlatformEmail, notificationEmailHtml } = await import("./resend.server");
    const r = await sendPlatformEmail({
      to: email,
      subject: `مُنجِز — ${n.title}`,
      html: notificationEmailHtml(n.title, n.body ?? "", n.link),
      text: `${n.title}\n\n${n.body ?? ""}`,
      idempotencyKey: `notif-${n.id}`,
      actorId: context.userId,
    });
    return { sent: r.delivered };
  });
