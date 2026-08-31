import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/lib/queries";

type Msg = { id: string; role: "ai" | "user"; text: string };

const WELCOME =
  "مرحباً بك في منصة المنجز! كيف يمكنني مساعدتك اليوم بخصوص خدماتك، الضمان المالي، أو حسابك؟";

const QUICK = [
  "كيف يعمل حجز الضمان؟",
  "شروط عمولة الإحالة",
  "طلب تصعيد المشكلة للإدارة",
] as const;

// Mock answer engine — swap with supabase.functions.invoke('support-ai') later.
async function getSupportReply(question: string): Promise<{ text: string; escalate: boolean }> {
  const q = question.trim();
  await new Promise((r) => setTimeout(r, 900));

  if (q.includes("تصعيد") || q.includes("الإدارة") || q.includes("شكوى")) {
    return {
      text: "تم فتح تذكرة تصعيد لفريق الدعم المتقدم. سيتم التواصل معك خلال مدة أقصاها 12 ساعة، ويبقى مبلغ الطلب محفوظاً في الضمان حتى صدور القرار.",
      escalate: true,
    };
  }
  if (q.includes("ضمان") || q.includes("Escrow") || q.includes("اسكرو")) {
    return {
      text: "عند تمويل الطلب يُحجز مبلغ USDT في الضمان ولا يصل للبائع إلا بعد قبولك للتسليم. مدة الحجز: 36 ساعة للمجاني، 12 ساعة لـ Pro، و6 ساعات للشركات، ثم يُحرَّر تلقائياً إن لم يكن هناك نزاع.",
      escalate: false,
    };
  }
  if (q.includes("إحالة") || q.includes("عمولة") || q.includes("affiliate")) {
    return {
      text: "برنامج الإحالة: 20% من صافي ربح المنصة خلال أول 30 يوماً، ثم 10% لبقية الـ 12 شهراً. الارتباط بالمشتري دائم، والإحالات الذاتية محظورة.",
      escalate: false,
    };
  }
  if (q.includes("سحب") || q.includes("محفظة") || q.includes("USDT")) {
    return {
      text: "السحب يتم بعملة USDT عبر TRC-20 أو BEP-20 أو Polygon، بلا رسوم داخلية. مدة المعالجة 48 ساعة للمجاني و12 ساعة لباقة Pro.",
      escalate: false,
    };
  }
  if (q.includes("توثيق") || q.includes("KYC")) {
    return {
      text: "التوثيق يتم عبر ثلاث خطوات: بيانات أساسية، وثيقة هوية، ثم صورة حية. بعد الاعتماد تحصل على شارة موثق وتقل مدة حجز الضمان.",
      escalate: false,
    };
  }
  return {
    text: "شكراً لتواصلك. يمكنني مساعدتك في: حجز الضمان، عمولات الإحالة، السحب بالـ USDT، والتوثيق KYC. اكتب سؤالك بتفصيل أكبر أو اطلب تصعيد المشكلة للإدارة.",
    escalate: false,
  };
}

/** True while a soft keyboard is up or a form control is focused on small screens. */
function useKeyboardAware() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const isSmall = () => window.innerWidth < 768;
    const check = () => {
      if (!isSmall()) return setHidden(false);
      const vv = window.visualViewport;
      const keyboard = !!vv && vv.height < window.innerHeight - 120;
      const el = document.activeElement;
      const focused =
        !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.closest("[data-support-widget]");
      setHidden(keyboard || focused);
    };

    check();
    window.visualViewport?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      window.visualViewport?.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  return hidden;
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: "w", role: "ai", text: WELCOME }]);
  const listRef = useRef<HTMLDivElement>(null);
  const keyboardHidden = useKeyboardAware();

  const { isAuthenticated } = useAuth();
  const profile = useProfile();
  const tier = profile.data?.account_tier;
  const badge = !isAuthenticated
    ? "زائر"
    : tier === "corporate"
      ? "حساب شركات ⭐"
      : tier === "pro"
        ? "بائع Pro ⭐"
        : "مستخدم عادي";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text || typing) return;
    setInput("");
    setMsgs((m) => [...m, { id: `${Date.now()}-u`, role: "user", text }]);
    setTyping(true);
    const reply = await getSupportReply(text);
    setTyping(false);
    setMsgs((m) => [...m, { id: `${Date.now()}-a`, role: "ai", text: reply.text }]);
    if (reply.escalate) toast.success("تم تحويل الطلب للدعم المتقدم");
  };

  const collapsed = keyboardHidden && !open;

  return (
    <div data-support-widget className="pointer-events-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="المساعد الذكي"
        aria-expanded={open}
        className={`pointer-events-auto fixed bottom-6 left-6 z-40 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all duration-200 hover:scale-105 ${
          collapsed ? "size-9 opacity-40" : "size-14 opacity-100"
        }`}
        style={{ boxShadow: "0 0 0 0 oklch(0.76 0.17 165 / 0.6)", animation: "pulse 2.4s ease-in-out infinite" }}
      >
        {open ? <X className="size-5" /> : <Bot className={collapsed ? "size-4" : "size-6"} />}
      </button>

      <div
        className={`fixed bottom-24 left-4 z-40 flex h-[520px] max-h-[85vh] w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md transition-all duration-200 sm:w-[400px] ${
          open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        role="dialog"
        aria-hidden={!open}
      >
        <div className="flex items-center gap-3 border-b border-border py-4 pe-4 ps-3">
          <div className="order-2 min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2 truncate font-bold">
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              المساعد الذكي لمنصة المنجز
            </p>
            <span className="mt-1 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              {badge}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            className="order-1 grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === "user"
                  ? "ms-auto bg-primary text-primary-foreground"
                  : "me-auto border border-border bg-secondary/60 text-foreground"
              }`}
            >
              {m.text}
            </div>
          ))}
          {typing && (
            <div className="me-auto flex w-16 items-center justify-center gap-1 rounded-2xl border border-border bg-secondary/60 px-3 py-3">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-3">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="اكتب استفسارك هنا..."
            className="max-h-24 min-w-0 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={!input.trim() || typing}
            aria-label="إرسال"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </>
  );
}
