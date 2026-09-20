import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Crown,
  Loader2,
  Percent,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useLang } from "@/lib/lang";
import { useNotify } from "@/lib/notify";
import { useAuth } from "@/hooks/use-auth";
import { SecurityPanel } from "@/components/site/SecurityPanel";
import { EXECUTABLE_REJECTION, isDangerousFile } from "@/lib/file-guard";
import { NameChangeControl } from "@/components/site/NameChangeCard";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "الملف الشخصي | المنجز" },
      {
        name: "description",
        content:
          "أدر ملفك الشخصي، واضبط محفظة السحب والتنبيهات والمصادقة الثنائية.",
      },
      { property: "og:title", content: "الملف الشخصي | المنجز" },
      {
        property: "og:description",
        content: "إعدادات الأمان، عمولة الباقة، وإعدادات الحساب في مكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Kyc = "verified" | "review" | "rejected" | "unverified";
type Tier = "free" | "pro" | "corp";

const TIER_META: Record<
  Tier,
  { name: [string, string]; escrow: [string, string]; fee: string }
> = {
  free: { name: ["الباقة المجانية", "Free Tier"], escrow: ["48 ساعة", "48 hours"], fee: "10%" },
  pro: {
    name: ["باقة المحترفين · 10 USDT", "Pro Tier · 10 USDT"],
    escrow: ["24 ساعة (مع KYC)", "24 hours (with KYC)"],
    fee: "5%",
  },
  corp: {
    name: ["باقة الشركات · 49 USDT", "Corporate Tier · 49 USDT"],
    escrow: ["12–16 ساعة", "12–16 hours"],
    fee: "2.5%",
  },
};

function ProfilePage() {
  const { tr } = useLang();
  const { user } = useAuth();
  const { profile: liveProfile } = useUserProfile();
  const isVerified = liveProfile?.is_verified === true;
  // Tier is decoupled from the admin role: only a live, unexpired paid plan
  // on the profile row may show Pro/Corporate.
  const planActive =
    !liveProfile?.plan_expires_at || new Date(liveProfile.plan_expires_at).getTime() > Date.now();
  const dbTier = liveProfile?.account_tier;
  const tier: Tier = !planActive ? "free" : dbTier === "pro" ? "pro" : dbTier === "corporate" ? "corp" : "free";
  const [avatar, setAvatar] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // KYC status is read-only in the profile view. Full verification submission
  // lives on the dedicated /kyc route and is reviewed in the admin KYC panel.
  const kyc: Kyc = isVerified
    ? "verified"
    : liveProfile?.kyc_status === "pending"
      ? "review"
      : liveProfile?.kyc_status === "rejected"
        ? "rejected"
        : "unverified";

  const meta = TIER_META[tier];
  // Clean text only — no leading "@" anywhere in the profile header.
  const handle = (
    liveProfile?.display_name || user?.email?.split("@")[0] || "user"
  ).replace(/^@+/, "");

  return (
    <div className="overflow-x-hidden">
      <Section
        title={tr("الملف الشخصي", "Profile")}
        subtitle={tr(
          "إدارة الحساب، الأمان، والتفضيلات.",
          "Account, security, and preferences.",
        )}
      >
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative shrink-0">
              <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-xl font-black">
                {avatar ? (
                  <img src={avatar} alt="صورة الملف الشخصي" className="size-full object-cover" />
                ) : (
                  handle.slice(0, 2).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                aria-label="تغيير الصورة الشخصية"
                className="absolute bottom-0 right-0 grid size-8 translate-x-1/4 translate-y-1/4 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg"
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
                  if (isDangerousFile(f.name)) {
                    toast.error(EXECUTABLE_REJECTION);
                    return;
                  }
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
              <h2 className="flex items-center gap-1.5 truncate text-lg font-black">
                {handle}
                {liveProfile?.is_verified && <VerifiedBadge />}
              </h2>
              {liveProfile?.created_at && (
                <p className="text-xs text-muted-foreground">
                  عضو منذ{" "}
                  {new Date(liveProfile.created_at).toLocaleDateString("ar", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/kyc" className="inline-flex">
                  <KycBadge state={kyc} />
                </Link>
                <NameChangeControl profile={liveProfile} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                  <Crown className="size-3.5" /> {tr(meta.name[0], meta.name[1])}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric
              icon={<Timer className="size-4" />}
              label={tr("حالة الضمان المعتمدة", "Escrow hold period")}
              value={tr(meta.escrow[0], meta.escrow[1])}
            />
            <Metric
              icon={<Percent className="size-4" />}
              label={tr("عمولة المبيعات المطبقة", "Applied sales commission")}
              value={meta.fee}
            />
          </div>
        </Card>

        <div className="mt-4">
          <SettingsPanel />
        </div>
      </Section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "ok",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon} {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-black ${tone === "warn" ? "text-destructive" : "text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}

function KycBadge({ state }: { state: Kyc }) {
  const { tr } = useLang();
  if (state === "verified")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
        <ShieldCheck className="size-3.5" /> {tr("موثق معتمد", "Verified Account")}
      </span>
    );
  if (state === "review")
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-500">
        <Loader2 className="size-3.5 animate-spin" /> {tr("قيد المراجعة", "Under review")}
      </span>
    );
  if (state === "rejected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-400">
        <AlertTriangle className="size-3.5" /> {tr("مرفوض", "Rejected")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive">
      <AlertTriangle className="size-3.5" /> {tr("حساب غير موثق", "Unverified account")}
    </span>
  );
}

function SettingsPanel() {
  const { prefs: notif, setPref, notify } = useNotify();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="text-sm font-black">تفضيلات التنبيهات</h3>
        <div className="mt-3 grid gap-2">
          {(
            [
              [
                "sales",
                "إشعارات المبيعات والطلبات الفورية",
                "تنبيه لحظي عند شراء خدمة أو أصل رقمي",
              ],
              [
                "escrow",
                "تنبيهات عداد الضمان (Escrow Countdown)",
                "تنبيهات انتهاء مهل التسليم وتحرير المبالغ",
              ],
              [
                "disputes",
                "تنبيهات النزاعات والدعم الفني",
                "إشعارات فورية عند فتح تذكرة أو طلب وساطة",
              ],
              ["delivery", "تسليم الطلبات", "إشعار عند تسليم أو اعتماد التسليم"],
              ["referral", "أرباح الإحالات", "إشعار عند احتساب عمولة إحالة جديدة"],
            ] as const
          ).map(([k, label, hint]) => (
            <label
              key={k}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm hover:border-primary/50"
            >
              <span className="min-w-0">
                <span className="block font-bold text-foreground">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {hint}
                </span>
              </span>
              <span className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={notif[k]}
                  onChange={(e) => {
                    setPref(k, e.target.checked);
                    if (e.target.checked) notify(k, `تم تفعيل: ${label}`, "success");
                    else toast(`تم إيقاف: ${label}`);
                  }}
                  className="peer sr-only"
                />
                <span className="block h-6 w-11 rounded-full border border-border bg-muted transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
                <span className="absolute top-1 start-1 size-4 rounded-full bg-foreground transition-transform peer-checked:translate-x-5 peer-checked:bg-primary-foreground rtl:peer-checked:-translate-x-5" />
              </span>
            </label>
          ))}
        </div>
      </Card>

      <SecurityPanel className="lg:col-span-2" />
    </div>
  );
}
