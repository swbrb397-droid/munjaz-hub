// Server-only Resend sender for app emails (order notifications etc.).
export const MUNJAZ_SENDER = "منصة مُنجِز <noreply@almunjazhub.com>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}): Promise<{ id: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": resendKey,
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: MUNJAZ_SENDER,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend send failed [${res.status}]: ${body}`);
    throw new Error(`Resend send failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id: string };
}

/**
 * Primary: Resend. On 429 / 403 / network failure the send is silently handed
 * to the failover path and recorded for administrators; users never see it.
 */
export async function sendPlatformEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  actorId?: string | null;
}): Promise<{ delivered: boolean; via: "resend" | "failover" }> {
  try {
    await sendResendEmail(opts);
    return { delivered: true, via: "resend" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /\[(\d{3})\]/.exec(msg)?.[1];
    const retryable = !status || status === "429" || status === "403" || status.startsWith("5");
    if (!retryable) throw err;
    // Failover: one delayed retry on Resend, then log for admin follow-up.
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await sendResendEmail(opts);
      return { delivered: true, via: "resend" };
    } catch {
      /* fall through */
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (opts.actorId) {
        await supabaseAdmin.from("audit_logs").insert({
          admin_id: opts.actorId,
          action_type: "email_failover",
          target_table: "notifications",
          target_id: null,
          meta: { status: status ?? "network", subject: opts.subject.slice(0, 120) },
        });
      }
    } catch (e) {
      console.error("email failover log failed", e);
    }
    return { delivered: false, via: "failover" };
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function notificationEmailHtml(title: string, body: string, link?: string | null) {
  const cta = link
    ? `<p style="margin:24px 0"><a href="https://almunjazhub.com${esc(link)}" style="background:#0ea5e9;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">فتح في مُنجِز</a></p>`
    : "";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="background:#ffffff;font-family:Tahoma,Arial,sans-serif;margin:0;padding:24px">
<div style="max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;padding:24px;text-align:right">
<h2 style="margin:0 0 6px;color:#0f172a">مُنجِز</h2>
<h3 style="margin:16px 0 8px;color:#0f172a">${esc(title)}</h3>
<p style="color:#334155;line-height:1.8">${esc(body)}</p>${cta}
<p style="color:#94a3b8;font-size:12px;margin-top:24px">هذه رسالة آلية من منصة مُنجِز — لا ترد عليها.</p>
</div></body></html>`;
}
