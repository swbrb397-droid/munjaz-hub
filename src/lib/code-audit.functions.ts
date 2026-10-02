import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUDIT_PROMPT = `You are a strict security auditor for a digital marketplace that sells source code, scripts and smart contracts.
Inspect the seller payload below for: malware or backdoors, obfuscated/eval-based droppers, hidden wallet drainers or owner-only withdrawal functions in smart contracts, reentrancy or unchecked external calls, malicious or phishing URLs, and leaked credentials (API keys, private keys, seed phrases, passwords).
Respond with STRICT JSON only: {"passed": boolean, "findings": string[], "summary": string}.
"passed" is true only when you found no material risk. Keep "summary" to two short Arabic sentences. Each finding is one short Arabic line.`;

const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|sol|vy|py|rs|go|php|rb|java|kt|swift|c|cc|cpp|h|cs|sh|json|yml|yaml|toml|txt|md|html|css|sql)$/i;
const MAX_CHARS = 60_000;

export const requestCodeAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id,owner_id,description,title_ar,title_en")
      .eq("id", data.listingId)
      .maybeSingle();
    if (error || !listing || listing.owner_id !== userId) throw new Error("NOT_FOUND");

    // Cost guard: max 3 Gemini audits per user per hour (persisted in rate_limit_events).
    const rl = await supabase.rpc("check_rate_limit", { _action: "code_audit", _max: 3, _window: "1 hour" });
    if (rl.error) {
      if (rl.error.message.includes("RATE_LIMITED"))
        throw new Error("RATE_LIMITED: تجاوزت الحد المسموح (3 طلبات فحص في الساعة). يُرجى المحاولة لاحقاً.");
      throw new Error("AUDIT_UNAVAILABLE");
    }

    const { data: payload } = await supabase
      .from("listing_instant_delivery")
      .select("content,file_path,file_name")
      .eq("listing_id", data.listingId)
      .maybeSingle();

    let body = `TITLE: ${listing.title_en || listing.title_ar}\nDESCRIPTION:\n${listing.description ?? ""}\n`;
    if (payload?.content) body += `\nPAYLOAD TEXT:\n${payload.content}\n`;
    if (payload?.file_path && TEXT_EXT.test(payload.file_name ?? payload.file_path)) {
      const dl = await supabase.storage.from("digital-deliverables").download(payload.file_path);
      if (dl.data && dl.data.size <= 2 * 1024 * 1024) body += `\nFILE ${payload.file_name}:\n${await dl.data.text()}\n`;
    } else if (payload?.file_path) {
      body += `\nATTACHED BINARY/ARCHIVE FILE (not inspectable): ${payload.file_name}\n`;
    }
    body = body.slice(0, MAX_CHARS);

    const { geminiGenerate } = await import("./gemini-pool.server");
    const raw = await geminiGenerate("chat", [{ text: `${AUDIT_PROMPT}\n\n----- PAYLOAD -----\n${body}` }], { json: true });
    if (!raw) throw new Error("AUDIT_UNAVAILABLE");

    let verdict: { passed: boolean; findings: string[]; summary: string };
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
      verdict = {
        passed: parsed.passed === true,
        findings: Array.isArray(parsed.findings) ? parsed.findings.map(String).slice(0, 20) : [],
        summary: String(parsed.summary ?? "").slice(0, 600),
      };
    } catch {
      throw new Error("AUDIT_UNAVAILABLE");
    }

    const report = [verdict.summary, ...verdict.findings.map((f) => `• ${f}`)].join("\n").slice(0, 4000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("listings")
      .update({
        is_code_audited: verdict.passed,
        audit_status: verdict.passed ? "passed" : "failed",
        audit_report: report,
      })
      .eq("id", data.listingId);
    if (updErr) throw new Error("AUDIT_SAVE_FAILED");
    return { passed: verdict.passed, report };
  });
