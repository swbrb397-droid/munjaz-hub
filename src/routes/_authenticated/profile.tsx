import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  Lock,
  Percent,
  ShieldCheck,
  Timer,
  Upload,
  X,
} from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "الملف الشخصي وتوثيق الهوية | الـمُـنْـجِـز" },
      {
        name: "description",
        content: "أدر ملفك الشخصي، وثّق هويتك (KYC) عبر ثلاث خطوات، واضبط محفظة السحب والتنبيهات والمصادقة الثنائية.",
      },
      { property: "og:title", content: "الملف الشخصي وتوثيق الهوية | الـمُـنْـجِـز" },
      { property: "og:description", content: "توثيق KYC، دورة الضمان، عمولة الباقة، وإعدادات الأمان في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Kyc = "unverified" | "review" | "verified";
type Tier = "free" | "pro" | "corp";

const TIER_META: Record<Tier, { name: string; escrow: string; fee: string }> = {
  free: { name: "الباقة المجانية · 0 USDT", escrow: "36 ساعة", fee: "10%" },
  pro: { name: "باقة المحترفين · 10 USDT", escrow: "12 ساعة (مع KYC)", fee: "5%" },
  corp: { name: "باقة الشركات · 49 USDT", escrow: "6 ساعات", fee: "2.5%" },
};

const NATIONALITIES = ["فلسطين", "السعودية", "الإمارات", "مصر", "الأردن", "المغرب", "الكويت", "قطر", "أخرى"];

function ProfilePage() {
  const { tr } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState<"kyc" | "settings">("kyc");
  const [kyc, setKyc] = useState<Kyc>("unverified");
  const [tier] = useState<Tier>("pro");
  const [twoFa, setTwoFa] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const meta = TIER_META[tier];
  const handle = user?.email ? `@${user.email.split("@")[0]}` : "@seller_pro_99";

  return (
    <div className="overflow-x-hidden">
      <Section
        title={tr("الملف الشخصي والتوثيق", "Profile & verification")}
        subtitle={tr("هويتك، توثيقك، وإعدادات الأمان والسحب.", "Identity, KYC and security settings.")}
      >
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative shrink-0">
              <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-border bg-secondary text-xl font-black">
                {avatar ? <img src={avatar} alt="صورة الملف الشخصي" className="size-full object-cover" /> : handle.slice(1, 3).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                aria-label="تغيير الصورة الشخصية"
                className="absolute -bottom-2 -left-2 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <Camera className="size-4" />
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) {
                    toast.error("الحد الأقصى 10MB");
                    return;
                  }
                  setAvatar(URL.createObjectURL(f));
                  toast.success("تم تحديث الصورة الشخصية");
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black">{handle}</h2>
              <p className="text-xs text-muted-foreground">عضو منذ مارس 2026</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <KycBadge state={kyc} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                  <Crown className="size-3.5" /> {meta.name}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric icon={<Timer className="size-4" />} label="حالة الضمان المعتمدة" value={meta.escrow} />
            <Metric icon={<Percent className="size-4" />} label="عمولة المبيعات المطبقة" value={meta.fee} />
            <Metric
              icon={<Lock className="size-4" />}
              label="حالة مصادقة الأمان"
              value={twoFa ? "2FA مفعّل" : "2FA غير مفعّل"}
              tone={twoFa ? "ok" : "warn"}
            />
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            { id: "kyc" as const, label: "توثيق الهوية (KYC)" },
            { id: "settings" as const, label: "إعدادات الحساب والأمان" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "kyc" ? <KycWizard state={kyc} onSubmitted={() => setKyc("review")} /> : <SettingsPanel twoFa={twoFa} setTwoFa={setTwoFa} />}
        </div>
      </Section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "ok" }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon} {label}
      </p>
      <p className={`mt-1 truncate text-sm font-black ${tone === "warn" ? "text-destructive" : "text-primary"}`}>{value}</p>
    </div>
  );
}

function KycBadge({ state }: { state: Kyc }) {
  if (state === "verified")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
        <ShieldCheck className="size-3.5" /> موثق معتمد
      </span>
    );
  if (state === "review")
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
        <Loader2 className="size-3.5 animate-spin" /> قيد المراجعة
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive">
      <AlertTriangle className="size-3.5" /> غير موثق
    </span>
  );
}

type Doc = { name: string; url: string };

function Dropzone({ label, hint, doc, onPick }: { label: string; hint: string; doc: Doc | null; onPick: (d: Doc) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 10MB");
      return;
    }
    if (!/(jpe?g|png|pdf)$/i.test(f.type) && !/\.(jpe?g|png|pdf)$/i.test(f.name)) {
      toast.error("الصيغ المسموحة: JPG, PNG, PDF");
      return;
    }
    onPick({ name: f.name, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "" });
  };

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files);
      }}
      className={`grid cursor-pointer place-items-center rounded-xl border border-dashed p-5 text-center transition-colors ${
        drag ? "border-primary bg-primary/10" : doc ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      {doc?.url ? (
        <img src={doc.url} alt={label} className="mb-2 h-24 w-full rounded-lg object-cover" />
      ) : (
        <Upload className="size-6 text-primary" />
      )}
      <p className="mt-1 text-sm font-bold">{doc ? doc.name : label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <input
        ref={ref}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function KycWizard({ state, onSubmitted }: { state: Kyc; onSubmitted: () => void }) {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [nat, setNat] = useState(NATIONALITIES[0]!);
  const [idNumber, setIdNumber] = useState("");
  const [docType, setDocType] = useState<"id" | "passport">("id");
  const [front, setFront] = useState<Doc | null>(null);
  const [back, setBack] = useState<Doc | null>(null);
  const [selfie, setSelfie] = useState<Doc | null>(null);
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);

  const step1Valid = fullName.trim().split(/\s+/).length >= 4 && !!dob && idNumber.trim().length >= 6;
  const step2Valid = !!front && (docType === "passport" || !!back);
  const step3Valid = !!selfie && agree;

  if (state === "review")
    return (
      <Card>
        <p className="flex items-start gap-2 text-sm font-bold text-accent">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          تم استلام طلب التوثيق وهو قيد المراجعة — عادةً خلال 24 ساعة عمل.
        </p>
      </Card>
    );

  return (
    <Card>
      <p className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-xs font-bold leading-relaxed text-accent">
        <BadgeCheck className="mt-0.5 size-4 shrink-0" />
        توثيق الهوية (KYC) إلزامي لتفعيل فترة الضمان السريعة (12 ساعة) لباقة Pro وسحب الأرباح دون قيود، امتثالاً لقواعد الأمان ومكافحة الاحتيال.
      </p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {["البيانات الشخصية", "رفع الوثائق الرسمية", "الصورة الشخصية للتحقق"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-accent/20 text-accent ring-2 ring-accent/50" : "border border-border text-muted-foreground"
              }`}
            >
              {step > i + 1 ? <CheckCircle2 className="size-4" /> : i + 1}
            </span>
            <span className={`min-w-0 truncate text-xs font-bold ${step === i + 1 ? "text-accent" : "text-muted-foreground"}`}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الرباعي الرسمي المطابق للوثيقة" value={fullName} onChange={setFullName} placeholder="الاسم الأول واسم الأب والجد والعائلة" className="sm:col-span-2" />
          <div>
            <label className="block text-xs font-bold">تاريخ الميلاد</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-bold">الجنسية</label>
            <select value={nat} onChange={(e) => setNat(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">
              {NATIONALITIES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <Field label="رقم الهوية الوطنية أو جواز السفر" value={idNumber} onChange={setIdNumber} placeholder="مثال: 401234567" className="sm:col-span-2" />
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "id" as const, label: "بطاقة هوية وطنية" },
              { id: "passport" as const, label: "جواز سفر ساري المفعول" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDocType(d.id)}
                className={`rounded-lg px-4 py-2 text-xs font-bold ${docType === d.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Dropzone label="الوجه الأمامي للوثيقة" hint="JPG / PNG / PDF — حتى 10MB" doc={front} onPick={setFront} />
            {docType === "id" && <Dropzone label="الوجه الخلفي للوثيقة" hint="JPG / PNG / PDF — حتى 10MB" doc={back} onPick={setBack} />}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 grid gap-3">
          <Dropzone label="صورة شخصية أثناء حمل الوثيقة" hint="صورة واضحة للوجه مع الوثيقة — حتى 10MB" doc={selfie} onPick={setSelfie} />
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
            أقر بأن جميع البيانات والوثائق المرفوعة صحيحة وتعود لي شخصياً وتحت طائلة المسؤولية وإلغاء الحساب.
          </label>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold">
            السابق
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 ? !step1Valid : !step2Valid}
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            التالي
          </button>
        ) : (
          <button
            type="button"
            disabled={!step3Valid || sending}
            onClick={() => {
              setSending(true);
              setTimeout(() => {
                setSending(false);
                onSubmitted();
                toast.success("تم إرسال طلب التوثيق للمراجعة");
              }, 700);
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            إرسال طلب التوثيق للمراجعة
          </button>
        )}
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function SettingsPanel({ twoFa, setTwoFa }: { twoFa: boolean; setTwoFa: (v: boolean) => void }) {
  const { tr } = useLang();
  const [network, setNetwork] = useState<"TRC-20" | "BEP-20">("TRC-20");
  const [address, setAddress] = useState("");
  const [notif, setNotif] = useState({ delivery: true, escrow: true, referral: false });
  const [pwOpen, setPwOpen] = useState(false);

  const pattern = network === "TRC-20" ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/ : /^0x[a-fA-F0-9]{40}$/;
  const invalid = address.length > 0 && !pattern.test(address.trim());

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="text-sm font-black">محفظة السحب المعتمدة</h3>
        <div className="mt-3 flex gap-1.5">
          {(["TRC-20", "BEP-20"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${network === n ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={network === "TRC-20" ? "T..." : "0x..."}
          className={`mt-3 w-full rounded-xl border bg-surface px-3 py-2.5 text-sm outline-none ${invalid ? "border-destructive" : "border-input focus:border-primary"}`}
        />
        {invalid && <p className="mt-1 text-[11px] font-bold text-destructive">عنوان المحفظة غير مطابق لصيغة شبكة {network}</p>}
        <button
          type="button"
          disabled={!address || invalid}
          onClick={() => toast.success("تم حفظ عنوان السحب")}
          className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          حفظ عنوان السحب
        </button>
      </Card>

      <Card>
        <h3 className="text-sm font-black">التنبيهات</h3>
        <div className="mt-3 grid gap-2">
          {([
            ["delivery", "تسليم الطلبات"],
            ["escrow", "تحرير مبالغ الضمان"],
            ["referral", "أرباح الإحالات"],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm">
              <span className="min-w-0 truncate font-bold">{label}</span>
              <input
                type="checkbox"
                checked={notif[k]}
                onChange={(e) => setNotif({ ...notif, [k]: e.target.checked })}
                className="size-4 shrink-0 accent-primary"
              />
            </label>
          ))}
        </div>
      </Card>

      <PayoutSecurityCard className="lg:col-span-2" />

      <Card className="lg:col-span-2">
        <h3 className="text-sm font-black">إعدادات الخصوصية</h3>
        <div className="mt-3 rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <Ghost className="size-4 shrink-0 text-violet" />
              <span className="min-w-0">وضع التخفي وحماية الخصوصية (Ghost Mode)</span>
            </p>
            <Toggle
              checked={ghost.enabled}
              label="وضع التخفي"
              onChange={(v) => {
                ghost.toggle(v);
                toast.success(v ? "تم تفعيل وضع التخفي" : "تم إيقاف وضع التخفي");
              }}
            />
          </div>
          {ghost.enabled && (
            <p className="mt-3 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-[11px] leading-relaxed text-violet">
              يتم إخفاء هويتك ومعرفاتك في لوحة المتصدرين وسجلات الصفقات العامة واستبدالها بمعرف رقمي مشفر:{" "}
              <span className="font-mono font-bold">{ghostTag(user?.id)}</span>
            </p>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="text-sm font-black">كلمة المرور والمصادقة الثنائية</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
          >
            <KeyRound className="size-4" /> تغيير كلمة المرور
          </button>
          <button
            type="button"
            onClick={() => {
              setTwoFa(!twoFa);
              toast.success(twoFa ? "تم تعطيل المصادقة الثنائية" : "تم تفعيل المصادقة الثنائية");
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${twoFa ? "border border-destructive/50 text-destructive" : "bg-primary text-primary-foreground"}`}
          >
            <Lock className="size-4" /> {twoFa ? "تعطيل 2FA" : "تفعيل 2FA"}
          </button>
        </div>
      </Card>

      {pwOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">تغيير كلمة المرور</h2>
              <button type="button" onClick={() => setPwOpen(false)} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <input type="password" placeholder="كلمة المرور الحالية" className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <input type="password" placeholder="كلمة المرور الجديدة" className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <button
                type="button"
                onClick={() => {
                  setPwOpen(false);
                  toast.success("تم تحديث كلمة المرور");
                }}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
