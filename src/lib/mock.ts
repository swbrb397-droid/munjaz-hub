import coverDesign from "@/assets/cover-design.jpg";
import coverCode from "@/assets/cover-code.jpg";
import coverCourse from "@/assets/cover-course.jpg";
import coverProduct from "@/assets/cover-product.jpg";
import coverGaming from "@/assets/cover-gaming.jpg";
import coverVideo from "@/assets/cover-video.jpg";

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

export const services: Service[] = [
  { id: "s1", title: "تصميم هوية بصرية متكاملة", seller: "استوديو نُون", category: "freelance", price: 320, rating: 4.9, orders: 214, verified: true, tag: "تصميم", cover: coverDesign },
  { id: "s2", title: "تطوير متجر إلكتروني Next.js", seller: "م. خالد", category: "freelance", price: 850, rating: 5.0, orders: 96, verified: true, tag: "برمجة", cover: coverCode },
  { id: "s3", title: "دورة: احتراف العقود الذكية", seller: "أكاديمية بلوك", category: "course", price: 120, rating: 4.8, orders: 1320, verified: true, tag: "تعليم", cover: coverCourse },
  { id: "s4", title: "حزمة قوالب لوحات تحكم", seller: "Pixel Vault", category: "product", price: 45, rating: 4.7, orders: 780, verified: false, tag: "منتج رقمي", cover: coverProduct },
  { id: "s5", title: "جلسة تدريب Valorant احترافية", seller: "Coach Zaid", category: "gaming", price: 25, rating: 4.9, orders: 430, verified: true, tag: "قيمنق", cover: coverGaming },
  { id: "s6", title: "مونتاج فيديو سينمائي", seller: "دار الإطار", category: "freelance", price: 190, rating: 4.6, orders: 152, verified: false, tag: "فيديو", cover: coverVideo },
  { id: "s7", title: "دورة تسويق أداء متقدمة", seller: "منصة رقم", category: "course", price: 95, rating: 4.7, orders: 640, verified: true, tag: "تعليم", cover: coverCourse },
  { id: "s8", title: "مكتبة أيقونات نيون 800+", seller: "Neon Labs", category: "product", price: 30, rating: 4.9, orders: 1105, verified: true, tag: "منتج رقمي", cover: coverProduct },
];

export type Nft = { id: string; name: string; collection: string; price: number; hue: number };

export const nfts: Nft[] = [
  { id: "n1", name: "Desert Protocol #012", collection: "Munjaz Genesis", price: 1450, hue: 165 },
  { id: "n2", name: "Neon Falcon #204", collection: "Falcons", price: 890, hue: 205 },
  { id: "n3", name: "Cipher Mask #077", collection: "Ciphers", price: 2100, hue: 300 },
  { id: "n4", name: "Oasis Grid #305", collection: "Munjaz Genesis", price: 640, hue: 185 },
  { id: "n5", name: "Sand Ronin #018", collection: "Ronin", price: 3200, hue: 320 },
  { id: "n6", name: "Pulse Key #451", collection: "Keys", price: 410, hue: 150 },
];

export const tickers = [
  { pair: "USDT/USD", value: "1.0002", change: "+0.01%" },
  { pair: "USDT/SAR", value: "3.7506", change: "-0.02%" },
  { pair: "USDT/AED", value: "3.6731", change: "+0.00%" },
  { pair: "USDT/EUR", value: "0.9184", change: "+0.12%" },
  { pair: "TRC-20 رسوم", value: "0.00 USDT", change: "داخلي" },
  { pair: "BEP-20 رسوم", value: "0.12 USDT", change: "شبكة" },
];

export const transactions = [
  { id: "t1", type: "إيداع", network: "TRC-20", amount: 1200, status: "مكتمل", date: "2026-08-04" },
  { id: "t2", type: "أرباح طلب", network: "داخلي", amount: 320, status: "مكتمل", date: "2026-08-03" },
  { id: "t3", type: "سحب", network: "BEP-20", amount: -450, status: "قيد المعالجة", date: "2026-08-02" },
  { id: "t4", type: "عمولة إحالة", network: "داخلي", amount: 62.5, status: "مكتمل", date: "2026-08-01" },
  { id: "t5", type: "ضمان محجوز", network: "داخلي", amount: -850, status: "محجوز", date: "2026-07-30" },
];

export const orders = [
  { id: "#MJ-9412", title: "تطوير متجر إلكتروني", client: "شركة أفق", value: 850, progress: 65, state: "قيد التنفيذ" },
  { id: "#MJ-9388", title: "هوية بصرية متكاملة", client: "مقهى رمل", value: 320, progress: 100, state: "بانتظار الاستلام" },
  { id: "#MJ-9350", title: "جلسات تدريب قيمنق", client: "Rakan", value: 75, progress: 40, state: "قيد التنفيذ" },
];

export const disputes = [
  { id: "D-1041", order: "#MJ-9412", reason: "تأخر التسليم", risk: "متوسط", ai: "لصالح المشتري جزئياً" },
  { id: "D-1039", order: "#MJ-9290", reason: "جودة المخرجات", risk: "منخفض", ai: "لصالح البائع" },
  { id: "D-1035", order: "#MJ-9188", reason: "ابتزاز تقييم", risk: "مرتفع", ai: "تصعيد بشري" },
];

export const kycQueue = [
  { id: "U-8821", name: "سارة الحربي", tier: "الطبقة 2", docs: "هوية + سيلفي", submitted: "قبل ساعتين" },
  { id: "U-8817", name: "Omar Nasser", tier: "الطبقة 2", docs: "جواز سفر", submitted: "قبل 5 ساعات" },
  { id: "U-8802", name: "ليان العتيبي", tier: "الطبقة 2", docs: "هوية", submitted: "أمس" },
];

export const chatThread = [
  { id: 1, from: "buyer", name: "شركة أفق", text: "مرحباً، هل يمكن إضافة صفحة تتبع الطلبات؟", en: "Hi, can we add an order tracking page?", time: "10:02" },
  { id: 2, from: "seller", name: "م. خالد", text: "أكيد، سأضيفها ضمن المرحلة الثانية بدون تكلفة إضافية.", en: "Sure, I'll add it in milestone 2 at no extra cost.", time: "10:06" },
  { id: 3, from: "buyer", name: "شركة أفق", text: "ممتاز. متى التسليم المتوقع؟", en: "Great. What's the expected delivery?", time: "10:08" },
  { id: 4, from: "seller", name: "م. خالد", text: "خلال 4 أيام عمل، وسأرفع ملفات المعاينة اليوم.", en: "Within 4 business days, preview files today.", time: "10:11" },
];
