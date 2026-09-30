// Share previews for listing links. The app stays a pure SPA; only social
// scrapers get a tiny HTML page with per-listing Open Graph tags.
const BOT_RE = /whatsapp|telegrambot|twitterbot|facebookexternalhit|facebot|discordbot|googlebot|linkedinbot|slackbot|bingbot/i;
const PATH_RE = /^\/(?:listing|store)\/([0-9a-f-]{36})\/?$/i;
const SITE = "https://almunjazhub.com";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function maybeListingPreview(request: Request): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const ua = request.headers.get("user-agent") ?? "";
  if (!BOT_RE.test(ua)) return null;
  const m = PATH_RE.exec(new URL(request.url).pathname);
  if (!m) return null;
  const id = m[1]!.toLowerCase();

  const base = process.env["SUPABASE_URL"] ?? "https://sjinvzfdeupgwwhkqoai.supabase.co";
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "sb_publishable__2bANscYRnfh8nJKcw1XrQ_6AsgY1hZ";
  try {
    const res = await fetch(
      `${base}/rest/v1/listings?id=eq.${id}&is_published=eq.true&select=title_ar,tag_ar,price_usdt,cover_url&limit=1`,
      { headers: { apikey: key, accept: "application/json" } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ title_ar: string; tag_ar: string; price_usdt: number; cover_url: string | null }>;
    const l = rows[0];
    if (!l) return null;
    const url = `${SITE}/listing/${id}`;
    const title = `${l.title_ar} | مُنجَز`;
    const desc = `${l.tag_ar || "خدمة رقمية بضمان الوساطة"} - السعر: ${Number(l.price_usdt).toFixed(2)} USDT`;
    const img = l.cover_url && /^https:\/\//.test(l.cover_url) ? l.cover_url : "";
    const tags = [
      `<meta property="og:type" content="product" />`,
      `<meta property="og:site_name" content="مُنجَز" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:url" content="${url}" />`,
      img && `<meta property="og:image" content="${esc(img)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(desc)}" />`,
      img && `<meta name="twitter:image" content="${esc(img)}" />`,
    ].filter(Boolean).join("\n");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${esc(title)}</title><meta name="description" content="${esc(desc)}" /><link rel="canonical" href="${url}" />\n${tags}</head><body><a href="${url}">${esc(title)}</a></body></html>`;
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" },
    });
  } catch {
    return null;
  }
}
