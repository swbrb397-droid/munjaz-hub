import coverDesign from "@/assets/cover-design.jpg";
import coverCode from "@/assets/cover-code.jpg";
import coverCourse from "@/assets/cover-course.jpg";
import coverProduct from "@/assets/cover-product.jpg";
import coverGaming from "@/assets/cover-gaming.jpg";
import coverVideo from "@/assets/cover-video.jpg";
import { useLang, type Lang } from "@/lib/lang";

export type Service = {
  id: string;
  title: string;
  seller: string;
  category: "freelance" | "course" | "product" | "gaming" | "nft";
  price: number;
  rating: number;
  orders: number;
  verified: boolean;
  tag: string;
  cover: string;
};

export type Nft = { id: string; name: string; collection: string; price: number; hue: number };

export function buildMock(lang: Lang) {
  const p = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const services: Service[] = [
    { id: "s1", title: p("تصميم هوية بصرية متكاملة", "Complete brand identity design"), seller: p("استوديو نُون", "Noon Studio"), category: "freelance", price: 320, rating: 4.9, orders: 214, verified: true, tag: p("تصميم", "Design"), cover: coverDesign },
    { id: "s2", title: p("تطوير متجر إلكتروني Next.js", "Next.js e-commerce development"), seller: p("م. خالد", "Eng. Khaled"), category: "freelance", price: 850, rating: 5.0, orders: 96, verified: true, tag: p("برمجة", "Development"), cover: coverCode },
    { id: "s3", title: p("دورة: احتراف العقود الذكية", "Course: Mastering smart contracts"), seller: p("أكاديمية بلوك", "Block Academy"), category: "course", price: 120, rating: 4.8, orders: 1320, verified: true, tag: p("تعليم", "Learning"), cover: coverCourse },
    { id: "s4", title: p("حزمة قوالب لوحات تحكم", "Dashboard templates bundle"), seller: "Pixel Vault", category: "product", price: 45, rating: 4.7, orders: 780, verified: false, tag: p("منتج رقمي", "Digital product"), cover: coverProduct },
    { id: "s5", title: p("جلسة تدريب Valorant احترافية", "Pro Valorant coaching session"), seller: "Coach Zaid", category: "gaming", price: 25, rating: 4.9, orders: 430, verified: true, tag: p("قيمنق", "Gaming"), cover: coverGaming },
    { id: "s6", title: p("مونتاج فيديو سينمائي", "Cinematic video editing"), seller: p("دار الإطار", "Frame House"), category: "freelance", price: 190, rating: 4.6, orders: 152, verified: false, tag: p("فيديو", "Video"), cover: coverVideo },
    { id: "s7", title: p("دورة تسويق أداء متقدمة", "Advanced performance marketing course"), seller: p("منصة رقم", "Raqam Platform"), category: "course", price: 95, rating: 4.7, orders: 640, verified: true, tag: p("تعليم", "Learning"), cover: coverCourse },
    { id: "s8", title: p("مكتبة أيقونات نيون 800+", "800+ neon icon library"), seller: "Neon Labs", category: "product", price: 30, rating: 4.9, orders: 1105, verified: true, tag: p("منتج رقمي", "Digital product"), cover: coverProduct },
  ];

  const nfts: Nft[] = [
    { id: "n1", name: "Desert Protocol #012", collection: "Munjaz Genesis", price: 1450, hue: 165 },
    { id: "n2", name: "Neon Falcon #204", collection: "Falcons", price: 890, hue: 205 },
    { id: "n3", name: "Cipher Mask #077", collection: "Ciphers", price: 2100, hue: 300 },
    { id: "n4", name: "Oasis Grid #305", collection: "Munjaz Genesis", price: 640, hue: 185 },
    { id: "n5", name: "Sand Ronin #018", collection: "Ronin", price: 3200, hue: 320 },
    { id: "n6", name: "Pulse Key #451", collection: "Keys", price: 410, hue: 150 },
  ];

  const tickers = [
    { pair: "USDT/USD", value: "1.0002", change: "+0.01%" },
    { pair: "USDT/SAR", value: "3.7506", change: "-0.02%" },
    { pair: "USDT/AED", value: "3.6731", change: "+0.00%" },
    { pair: "USDT/EUR", value: "0.9184", change: "+0.12%" },
    { pair: p("TRC-20 رسوم", "TRC-20 fee"), value: "0.00 USDT", change: p("داخلي", "Internal") },
    { pair: p("BEP-20 رسوم", "BEP-20 fee"), value: "0.12 USDT", change: p("شبكة", "Network") },
  ];

  const transactions = [
    { id: "t1", type: p("إيداع", "Deposit"), network: "TRC-20", amount: 1200, status: p("مكتمل", "Completed"), date: "2026-08-04" },
    { id: "t2", type: p("أرباح طلب", "Order earnings"), network: p("داخلي", "Internal"), amount: 320, status: p("مكتمل", "Completed"), date: "2026-08-03" },
    { id: "t3", type: p("سحب", "Withdrawal"), network: "BEP-20", amount: -450, status: p("قيد المعالجة", "Processing"), date: "2026-08-02" },
    { id: "t4", type: p("عمولة إحالة", "Referral commission"), network: p("داخلي", "Internal"), amount: 62.5, status: p("مكتمل", "Completed"), date: "2026-08-01" },
    { id: "t5", type: p("ضمان محجوز", "Escrow hold"), network: p("داخلي", "Internal"), amount: -850, status: p("محجوز", "Held"), date: "2026-07-30" },
  ];

  const orders = [
    { id: "#MJ-9412", title: p("تطوير متجر إلكتروني", "E-commerce development"), client: p("شركة أفق", "Ufuq Co."), value: 850, progress: 65, state: p("قيد التنفيذ", "In progress") },
    { id: "#MJ-9388", title: p("هوية بصرية متكاملة", "Full brand identity"), client: p("مقهى رمل", "Raml Cafe"), value: 320, progress: 100, state: p("بانتظار الاستلام", "Awaiting acceptance") },
    { id: "#MJ-9350", title: p("جلسات تدريب قيمنق", "Gaming coaching sessions"), client: "Rakan", value: 75, progress: 40, state: p("قيد التنفيذ", "In progress") },
  ];

  const disputes = [
    { id: "D-1041", order: "#MJ-9412", reason: p("تأخر التسليم", "Late delivery"), risk: p("متوسط", "Medium"), ai: p("لصالح المشتري جزئياً", "Partially for the buyer") },
    { id: "D-1039", order: "#MJ-9290", reason: p("جودة المخرجات", "Deliverable quality"), risk: p("منخفض", "Low"), ai: p("لصالح البائع", "For the seller") },
    { id: "D-1035", order: "#MJ-9188", reason: p("ابتزاز تقييم", "Review blackmail"), risk: p("مرتفع", "High"), ai: p("تصعيد بشري", "Escalate to human") },
  ];

  const kycQueue = [
    { id: "U-8821", name: p("سارة الحربي", "Sarah Alharbi"), tier: p("الطبقة 2", "Tier 2"), docs: p("هوية + سيلفي", "ID + selfie"), submitted: p("قبل ساعتين", "2 hours ago") },
    { id: "U-8817", name: "Omar Nasser", tier: p("الطبقة 2", "Tier 2"), docs: p("جواز سفر", "Passport"), submitted: p("قبل 5 ساعات", "5 hours ago") },
    { id: "U-8802", name: p("ليان العتيبي", "Layan Alotaibi"), tier: p("الطبقة 2", "Tier 2"), docs: p("هوية", "ID"), submitted: p("أمس", "Yesterday") },
  ];

  const chatThread = [
    { id: 1, from: "buyer", name: p("شركة أفق", "Ufuq Co."), text: "مرحباً، هل يمكن إضافة صفحة تتبع الطلبات؟", en: "Hi, can we add an order tracking page?", time: "10:02" },
    { id: 2, from: "seller", name: p("م. خالد", "Eng. Khaled"), text: "أكيد، سأضيفها ضمن المرحلة الثانية بدون تكلفة إضافية.", en: "Sure, I'll add it in milestone 2 at no extra cost.", time: "10:06" },
    { id: 3, from: "buyer", name: p("شركة أفق", "Ufuq Co."), text: "ممتاز. متى التسليم المتوقع؟", en: "Great. What's the expected delivery?", time: "10:08" },
    { id: 4, from: "seller", name: p("م. خالد", "Eng. Khaled"), text: "خلال 4 أيام عمل، وسأرفع ملفات المعاينة اليوم.", en: "Within 4 business days, preview files today.", time: "10:11" },
  ];

  return { services, nfts, tickers, transactions, orders, disputes, kycQueue, chatThread };
}

export function useMock() {
  const { lang } = useLang();
  return buildMock(lang);
}

const arMock = buildMock("ar");
export const services = arMock.services;
export const nfts = arMock.nfts;
export const tickers = arMock.tickers;
export const transactions = arMock.transactions;
export const orders = arMock.orders;
export const disputes = arMock.disputes;
export const kycQueue = arMock.kycQueue;
export const chatThread = arMock.chatThread;
