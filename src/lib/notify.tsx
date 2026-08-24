import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
