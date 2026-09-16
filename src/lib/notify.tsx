import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/cloud-client";

export type NotifyChannel = "sales" | "escrow" | "disputes" | "delivery" | "referral";

export type NotifyPrefs = Record<NotifyChannel, boolean>;

export type NotifyEvent = {
  id: string;
  channel: NotifyChannel;
  message: string;
  at: number;
};

const DEFAULT_PREFS: NotifyPrefs = {
  sales: true,
  escrow: true,
  disputes: true,
  delivery: true,
  referral: false,
};

const STORAGE_KEY = "munjaz-notify-prefs";

type Ctx = {
  prefs: NotifyPrefs;
  setPref: (channel: NotifyChannel, value: boolean) => void;
  events: NotifyEvent[];
  /** Dispatch a notification: silenced instantly when its channel is disabled. */
  notify: (channel: NotifyChannel, message: string, kind?: "success" | "error" | "info") => boolean;
  clear: () => void;
};

const NotifyContext = createContext<Ctx>({
  prefs: DEFAULT_PREFS,
  setPref: () => {},
  events: [],
  notify: () => false,
  clear: () => {},
});

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS);
  const [events, setEvents] = useState<NotifyEvent[]>([]);
  const prefsRef = useRef<NotifyPrefs>(DEFAULT_PREFS);
  prefsRef.current = prefs;

  // Hydrate from localStorage first (offline-safe), then reconcile with the
  // signed-in user's profile row so preferences follow them across devices.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifyPrefs>) };
        prefsRef.current = parsed;
        setPrefs(parsed);
      }
    } catch {
      /* ignore malformed storage */
    }
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;
      const { data } = await supabase.from("profiles").select("notification_preferences").eq("id", uid).maybeSingle();
      const remote = (data as { notification_preferences?: Partial<NotifyPrefs> } | null)?.notification_preferences;
      if (remote && !cancelled) {
        const merged = { ...DEFAULT_PREFS, ...remote };
        prefsRef.current = merged;
        setPrefs(merged);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback((channel: NotifyChannel, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [channel]: value };
      prefsRef.current = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      // Optimistic remote sync — falls back silently for signed-out users.
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        await supabase.from("profiles").update({ notification_preferences: next }).eq("id", uid);
      })();
      return next;
    });
  }, []);

  const notify = useCallback<Ctx["notify"]>(
    (channel, message, kind = "info") => {
      if (!prefsRef.current[channel]) return false;
      setEvents((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, channel, message, at: Date.now() }, ...prev].slice(0, 20));
      if (kind === "success") toast.success(message);
      else if (kind === "error") toast.error(message);
      else toast(message);
      return true;
    },
    [],
  );

  const clear = useCallback(() => setEvents([]), []);

  const value = useMemo(() => ({ prefs, setPref, events, notify, clear }), [prefs, setPref, events, notify, clear]);

  return <NotifyContext.Provider value={value}>{children}</NotifyContext.Provider>;
}

export function useNotify() {
  return useContext(NotifyContext);
}
