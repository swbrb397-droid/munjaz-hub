import { useEffect, useState } from "react";
import { FileDown, KeyRound, Timer } from "lucide-react";
import { useLang } from "@/lib/lang";
import {
  formatCountdown,
  issueDownloadToken,
  isTokenValid,
  tokenRemaining,
  type DownloadToken,
} from "@/lib/download-token";

/**
 * Protected digital-asset download gated behind a signed, 15-minute token.
 * The link only becomes active after a token is issued, and it self-expires so
 * a copied URL cannot be replayed or shared.
 */
export function SecureDownload({
  target,
  href,
  userId,
  onDownload,
  compact,
}: {
  target: string;
  href?: string | undefined;
  userId: string | null;
  onDownload?: (token: DownloadToken) => void;
  compact?: boolean;
}) {
  const { tr } = useLang();
  const [token, setToken] = useState<DownloadToken | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [token]);

  const valid = isTokenValid(token) && now <= (token?.expiresAt ?? 0);
  const remaining = tokenRemaining(token);

  if (!valid) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setToken(issueDownloadToken(target, userId));
            setNow(Date.now());
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
        >
          <KeyRound className="size-3" />
          {token ? tr("انتهت صلاحية الرابط — إصدار رابط جديد", "Link expired — issue a new one") : tr("إصدار رابط تنزيل آمن 🔐", "Issue secure download link 🔐")}
        </button>
        {!compact && (
          <span className="text-[10px] text-muted-foreground">
            {tr("صالح لمدة 15 دقيقة فقط ويمنع إعادة استخدام الرابط.", "Valid for 15 minutes only; replay and link sharing are blocked.")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => onDownload?.(token!)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
      >
        <FileDown className="size-3" /> {tr("تنزيل الملف الآن", "Download now")}
      </a>
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-1 font-mono text-[10px] font-bold text-accent" dir="ltr">
        <Timer className="size-3" /> {formatCountdown(remaining)}
      </span>
      <span className="max-w-full truncate rounded-full border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground" dir="ltr">
        {token!.token}
      </span>
    </div>
  );
}
