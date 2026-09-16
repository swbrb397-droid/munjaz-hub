import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PhoneOff, Video, X } from "lucide-react";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";

type JitsiApi = { dispose: () => void };
type JitsiCtor = new (
  domain: string,
  options: {
    roomName: string;
    parentNode: HTMLElement;
    width: string;
    height: string;
    configOverwrite?: Record<string, unknown>;
    interfaceConfigOverwrite?: Record<string, unknown>;
  },
) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiCtor;
  }
}

const SCRIPT_SRC = "https://meet.jit.si/external_api.js";

/** Injects the Jitsi external API script once and resolves when it is ready. */
function loadJitsi(): Promise<JitsiCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("NO_WINDOW"));
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const tag = existing ?? document.createElement("script");
    const onReady = () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error("JITSI_UNAVAILABLE"));
    };
    tag.addEventListener("load", onReady, { once: true });
    tag.addEventListener("error", () => reject(new Error("JITSI_SCRIPT_FAILED")), { once: true });
    if (!existing) {
      tag.src = SCRIPT_SRC;
      tag.async = true;
      document.body.appendChild(tag);
    } else if (window.JitsiMeetExternalAPI) {
      onReady();
    }
  });
}

type CallRow = {
  video_call_status: string;
  video_call_caller_id: string | null;
  video_call_room_id: string | null;
};

export function VideoCallPanel({
  orderId,
  orderNumber,
  userId,
  open,
  onClose,
}: {
  orderId: string;
  orderNumber: number | string;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { tr } = useLang();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  const call = useQuery({
    queryKey: ["order-call", orderId],
    enabled: open && !!orderId,
    refetchInterval: open ? 4000 : false,
    queryFn: async (): Promise<CallRow> => {
      const { data, error } = await supabase
        .from("orders")
        .select("video_call_status, video_call_caller_id, video_call_room_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return (
        (data as CallRow | null) ?? {
          video_call_status: "idle",
          video_call_caller_id: null,
          video_call_room_id: null,
        }
      );
    },
  });

  // Live push updates so the other party sees ring/accept instantly.
  useEffect(() => {
    if (!open || !orderId) return;
    const channel = supabase
      .channel(`order-call-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => void qc.invalidateQueries({ queryKey: ["order-call", orderId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, orderId, qc]);

  const setCall = useMutation({
    mutationFn: async (patch: Partial<CallRow>) => {
      const { error } = await supabase
        .from("orders")
        .update({ ...patch, video_call_updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["order-call", orderId] }),
  });

  const status = call.data?.video_call_status ?? "idle";
  const callerId = call.data?.video_call_caller_id ?? null;
  const roomId = call.data?.video_call_room_id ?? `almunjaz-${orderId}`;
  const isCaller = callerId === userId;
  const live = status === "accepted" || status === "active";

  // Ring the other party as soon as the panel is opened from an idle state.
  const invited = useRef(false);
  useEffect(() => {
    if (!open) {
      invited.current = false;
      return;
    }
    if (call.isLoading || invited.current) return;
    if (status === "idle" || status === "declined" || status === "ended") {
      invited.current = true;
      setCall.mutate({
        video_call_status: "pending",
        video_call_caller_id: userId,
        video_call_room_id: `almunjaz-${orderId}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, call.isLoading, status]);

  // Mount / dispose the Jitsi iframe strictly with the accepted state.
  useEffect(() => {
    if (!open || !live) return;
    let cancelled = false;
    setMountError(null);
    void loadJitsi()
      .then((Ctor) => {
        if (cancelled || !containerRef.current || apiRef.current) return;
        apiRef.current = new Ctor("meet.jit.si", {
          roomName: roomId,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          configOverwrite: { startWithAudioMuted: false, prejoinPageEnabled: false },
        });
      })
      .catch(() => {
        if (!cancelled) setMountError(tr("تعذّر تحميل غرفة الاجتماع.", "Could not load the meeting room."));
      });
    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [open, live, roomId, tr]);

  const end = () => {
    apiRef.current?.dispose();
    apiRef.current = null;
    setCall.mutate({ video_call_status: "idle", video_call_caller_id: null, video_call_room_id: null });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0B0F17]" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <p className="min-w-0 truncate text-sm font-black">
          {tr("مكالمة فيديو مشفّرة داخل المنصة", "Encrypted in-app video call")} · MJ-{orderNumber}
        </p>
        <button
          type="button"
          onClick={end}
          aria-label={tr("إنهاء المكالمة", "End call")}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-700 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-[520px] h-[75vh] w-full overflow-hidden rounded-lg bg-background">
        {live ? (
          <div ref={containerRef} className="absolute inset-0 size-full" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {call.isLoading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : status === "pending" && isCaller ? (
              <div className="grid justify-items-center gap-3">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {tr(
                    "تم إرسال دعوة لمكالمة فيديو... بانتظار موافقة الطرف الآخر (الطرف الآخر لم يقبل الدعوة أو لم يدخل على المكالمة بعد)",
                    "Video call invitation sent... waiting for the other party to accept (they have not accepted or joined yet).",
                  )}
                </p>
                <button
                  type="button"
                  onClick={end}
                  className="inline-flex items-center gap-2 rounded-xl border border-destructive/60 px-4 py-2.5 text-sm font-bold text-destructive"
                >
                  <PhoneOff className="size-4" /> {tr("إلغاء الدعوة", "Cancel invitation")}
                </button>
              </div>
            ) : status === "pending" ? (
              <div className="grid justify-items-center gap-3">
                <Video className="size-7 text-primary" />
                <p className="text-sm font-bold">
                  {tr("لديك دعوة مكالمة فيديو من الطرف الآخر", "You have an incoming video call")}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCall.mutate({ video_call_status: "accepted" })}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    {tr("قبول المكالمة", "Accept call")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCall.mutate({ video_call_status: "declined" });
                      onClose();
                    }}
                    className="rounded-xl border border-destructive/60 px-4 py-2.5 text-sm font-bold text-destructive"
                  >
                    {tr("رفض الدعوة", "Decline")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {mountError ?? tr("المكالمة غير نشطة حالياً.", "The call is not active.")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
