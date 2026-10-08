import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import type { Tables } from "@/integrations/supabase/types";

export type Project = Tables<"projects">;
export type Proposal = Tables<"project_proposals">;

export const PROJECT_CATEGORIES = [
  { key: "development", ar: "برمجة وتطوير", en: "Development" },
  { key: "design", ar: "تصميم", en: "Design" },
  { key: "writing", ar: "كتابة وترجمة", en: "Writing & translation" },
  { key: "marketing", ar: "تسويق", en: "Marketing" },
  { key: "video", ar: "فيديو وصوتيات", en: "Video & audio" },
  { key: "ai", ar: "ذكاء اصطناعي", en: "AI" },
  { key: "other", ar: "أخرى", en: "Other" },
] as const;

export const categoryLabel = (key: string, ar: boolean) => {
  const c = PROJECT_CATEGORIES.find((x) => x.key === key);
  return c ? (ar ? c.ar : c.en) : key;
};

export const usd = (n: number | string | null | undefined) => Number(n ?? 0).toFixed(2);

/** Maps backend guard codes to readable messages. */
export function projectError(e: unknown, ar: boolean): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const map: Record<string, [string, string]> = {
    CONTACT_INFO_BLOCKED: ["يُمنع وضع أرقام هواتف أو بريد أو روابط تواصل خارجية — التواصل داخل المنصة يحمي حقك في الضمان.", "Phone numbers, emails and external contact links are not allowed — staying on-platform protects your escrow."],
    PROPOSAL_DAILY_LIMIT: ["وصلت إلى الحد اليومي للعروض حسب مستواك. يرتفع الحد مع إكمال الطلبات.", "You reached today's proposal limit for your level. It grows as you complete orders."],
    PROJECT_DAILY_LIMIT: ["الحد الأقصى 5 مشاريع جديدة خلال 24 ساعة.", "Maximum 5 new projects per 24 hours."],
    SELF_PROPOSAL: ["لا يمكنك التقديم على مشروعك.", "You cannot bid on your own project."],
    ALREADY_PROPOSED: ["قدّمت عرضاً على هذا المشروع مسبقاً.", "You already submitted a proposal."],
    PROJECT_NOT_OPEN: ["المشروع لم يعد مفتوحاً.", "This project is no longer open."],
    ACCOUNT_FROZEN: ["حسابك مجمّد أو معطّل.", "Your account is frozen or deactivated."],
    INSUFFICIENT_FUNDS: ["رصيدك المتاح لا يغطي قيمة العرض. اشحن محفظتك أولاً.", "Your available balance doesn't cover this proposal. Top up first."],
    FREELANCER_UNAVAILABLE: ["حساب المستقل غير متاح حالياً.", "This freelancer's account is unavailable."],
    MIN_AMOUNT: ["الحد الأدنى 3 USDT.", "Minimum is 3 USDT."],
    INVALID_TITLE: ["العنوان بين 10 و120 حرفاً.", "Title must be 10–120 characters."],
    INVALID_DESCRIPTION: ["الوصف بين 50 و4000 حرف.", "Description must be 50–4000 characters."],
    INVALID_COVER: ["خطاب التقديم بين 30 و2500 حرف.", "Cover letter must be 30–2500 characters."],
    PROJECT_HAS_ESCROW: ["لا يمكن تعديل مشروع عليه ضمان جارٍ أو مكتمل.", "Projects with active or completed escrow cannot be moderated."],
    FINANCIAL_HALT: ["العمليات المالية متوقفة مؤقتاً.", "Financial operations are temporarily halted."],
    FORBIDDEN: ["غير مصرّح.", "Not allowed."],
  };
  for (const [code, [a, en]] of Object.entries(map)) if (m.includes(code)) return ar ? a : en;
  return ar ? "تعذّر إتمام العملية، حاول مجدداً." : "Could not complete the action, try again.";
}

export function useOpenProjects(category: string) {
  return useQuery({
    queryKey: ["projects", "open", category],
    queryFn: async () => {
      let q = supabase.from("projects").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100);
      if (category !== "all") q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** RLS returns: all proposals for the owner, only own proposal for a freelancer. */
export function useProjectProposals(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["project-proposals", projectId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_proposals")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyProjects(userId: string | undefined) {
  return useQuery({
    queryKey: ["projects", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("owner_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProposalQuota(enabled: boolean) {
  return useQuery({
    queryKey: ["proposal-quota"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_proposal_quota");
      if (error) throw error;
      return data?.[0] ?? { used: 0, cap: 10 };
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["project"] });
    void qc.invalidateQueries({ queryKey: ["project-proposals"] });
    void qc.invalidateQueries({ queryKey: ["proposal-quota"] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
  };
}

export function useCreateProject() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { title: string; description: string; category: string; min: number; max: number; days: number }) => {
      const { data, error } = await supabase.rpc("create_project", {
        _title: v.title, _description: v.description, _category: v.category,
        _budget_min: v.min, _budget_max: v.max, _delivery_days: v.days,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: inv,
  });
}

export function useSubmitProposal() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { projectId: string; amount: number; days: number; cover: string }) => {
      const { error } = await supabase.rpc("submit_project_proposal", {
        _project_id: v.projectId, _amount: v.amount, _delivery_days: v.days, _cover: v.cover,
      });
      if (error) throw error;
    },
    onSuccess: inv,
  });
}

export function useProjectAction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { kind: "accept" | "withdraw" | "close"; id: string }) => {
      if (v.kind === "accept") {
        const { data, error } = await supabase.rpc("accept_project_proposal", { _proposal_id: v.id });
        if (error) throw error;
        return data as string;
      }
      const { error } = v.kind === "withdraw"
        ? await supabase.rpc("withdraw_project_proposal", { _proposal_id: v.id })
        : await supabase.rpc("close_own_project", { _project_id: v.id });
      if (error) throw error;
      return null;
    },
    onSuccess: inv,
  });
}
