import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";

/** A user is "online" when active within this window. */
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 4 * 60 * 1000;

/** Sends a throttled activity heartbeat while the signed-in tab is visible. */
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => {
      if (document.visibilityState === "visible") void supabase.rpc("touch_presence");
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled]);
}

/** Live last-active timestamps (null when hidden by the user). */
export function usePresence(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["presence", key],
    enabled: key.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_presence", { _ids: key });
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const r of data ?? []) map[r.id] = r.last_active_at;
      return map;
    },
  });
}

export function relativeAgo(iso: string, ar: boolean): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return ar ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return ar ? `منذ ${h} ساعة` : `${h}h ago`;
  const d = Math.round(h / 24);
  return ar ? `منذ ${d} يوم` : `${d}d ago`;
}

/** Green dot when online; otherwise "last seen". Renders nothing when hidden. */
export function PresenceBadge({ lastActive, className = "" }: { lastActive: string | null | undefined; className?: string }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  if (!lastActive) return null;
  const online = Date.now() - new Date(lastActive).getTime() < ONLINE_WINDOW_MS;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${online ? "text-primary" : "text-muted-foreground"} ${className}`}>
      <span className={`size-2 shrink-0 rounded-full ${online ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted-foreground/50"}`} />
      {online ? (ar ? "متصل الآن" : "Online now") : (ar ? `آخر ظهور ${relativeAgo(lastActive, ar)}` : `Last seen ${relativeAgo(lastActive, ar)}`)}
    </span>
  );
}
