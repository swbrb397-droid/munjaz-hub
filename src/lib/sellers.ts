export type SellerListingKind = "service" | "course" | "nft";

export type SellerListing = {
  id: string;
  kind: SellerListingKind;
  title_ar: string;
  title_en: string;
  price_usdt: number;
  thumbnail_url: string;
};

export type SellerProfile = {
  username: string;
  name_ar: string;
  name_en: string;
  headline_ar: string;
  headline_en: string;
  bio_ar: string;
  bio_en: string;
  avatar_url: string;
  cover_url: string;
  verified: boolean;
  country_ar: string;
  country_en: string;
  member_since: string;
  /** Meritocratic metrics — ranking uses only these numbers. */
  total_rating: number;
  completion_rate: number;
  total_sales: number;
  response_minutes: number;
  listings: SellerListing[];
};

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const SELLERS: SellerProfile[] = [
  {
    username: "noon-studio",
    name_ar: "استوديو نُون",
    name_en: "Noon Studio",
    headline_ar: "هوية بصرية وتصميم واجهات",
    headline_en: "Brand identity & UI design",
    bio_ar: "استوديو تصميم متخصص في بناء هويات بصرية متكاملة وواجهات منتجات رقمية للشركات الناشئة والمؤسسات.",
    bio_en: "A design studio building complete brand identities and product interfaces for startups and enterprises.",
    avatar_url: img("photo-1544005313-94ddf0286df2", 240),
    cover_url: img("photo-1558655146-9f40138edfeb", 1400),
    verified: true,
    country_ar: "السعودية",
    country_en: "Saudi Arabia",
    member_since: "2023-04-11",
    total_rating: 4.94,
    completion_rate: 99.2,
    total_sales: 1412,
    response_minutes: 18,
    listings: [
      { id: "l1", kind: "service", title_ar: "هوية بصرية متكاملة", title_en: "Complete brand identity", price_usdt: 320, thumbnail_url: img("photo-1626785774573-4b799315345d") },
      { id: "l2", kind: "course", title_ar: "دورة أساسيات الهوية", title_en: "Brand foundations course", price_usdt: 89, thumbnail_url: img("photo-1522202176988-66273c2fd55f") },
      { id: "l3", kind: "nft", title_ar: "Desert Protocol #012", title_en: "Desert Protocol #012", price_usdt: 1450, thumbnail_url: img("photo-1618005182384-a83a8bd57fbe") },
    ],
  },
  {
    username: "eng-khaled",
    name_ar: "م. خالد",
    name_en: "Eng. Khaled",
    headline_ar: "مطوّر واجهات وأنظمة تجارة إلكترونية",
    headline_en: "Frontend & e-commerce engineer",
    bio_ar: "أبني متاجر إلكترونية عالية الأداء بـ Next.js وأنظمة دفع متكاملة مع تقارير تشغيلية.",
    bio_en: "I build high-performance Next.js storefronts with integrated payments and operational reporting.",
    avatar_url: img("photo-1500648767791-00dcc994a43e", 240),
    cover_url: img("photo-1461749280684-dccba630e2f6", 1400),
    verified: true,
    country_ar: "الأردن",
    country_en: "Jordan",
    member_since: "2022-11-02",
    total_rating: 4.98,
    completion_rate: 97.5,
    total_sales: 903,
    response_minutes: 25,
    listings: [
      { id: "l4", kind: "service", title_ar: "تطوير متجر Next.js", title_en: "Next.js store development", price_usdt: 850, thumbnail_url: img("photo-1517180102446-f3ece451e9d8") },
      { id: "l5", kind: "course", title_ar: "دورة React احترافية", title_en: "Professional React course", price_usdt: 120, thumbnail_url: img("photo-1633356122544-f134324a6cee") },
    ],
  },
  {
    username: "block-academy",
    name_ar: "أكاديمية بلوك",
    name_en: "Block Academy",
    headline_ar: "تدريب على العقود الذكية والويب3",
    headline_en: "Smart contracts & Web3 training",
    bio_ar: "أكاديمية تدريب عملية تقدم مسارات معتمدة في العقود الذكية وتدقيق الأمان.",
    bio_en: "Hands-on academy offering certified tracks in smart contracts and security auditing.",
    avatar_url: img("photo-1519085360753-af0119f7cbe7", 240),
    cover_url: img("photo-1639762681485-074b7f938ba0", 1400),
    verified: true,
    country_ar: "الإمارات",
    country_en: "UAE",
    member_since: "2021-08-19",
    total_rating: 4.86,
    completion_rate: 98.8,
    total_sales: 2210,
    response_minutes: 42,
    listings: [
      { id: "l6", kind: "course", title_ar: "احتراف العقود الذكية", title_en: "Mastering smart contracts", price_usdt: 120, thumbnail_url: img("photo-1516116216624-53e697fedbea") },
      { id: "l7", kind: "nft", title_ar: "Cipher Mask #077", title_en: "Cipher Mask #077", price_usdt: 2100, thumbnail_url: img("photo-1620321023374-d1a68fbc720d") },
    ],
  },
  {
    username: "pixel-vault",
    name_ar: "بيكسل فولت",
    name_en: "Pixel Vault",
    headline_ar: "قوالب ومنتجات رقمية جاهزة",
    headline_en: "Templates & ready digital products",
    bio_ar: "مكتبة قوالب لوحات تحكم وأنظمة تصميم قابلة للتخصيص بترخيص تجاري.",
    bio_en: "A library of dashboard templates and design systems with commercial licensing.",
    avatar_url: img("photo-1494790108377-be9c29b29330", 240),
    cover_url: img("photo-1451187580459-43490279c0fa", 1400),
    verified: false,
    country_ar: "مصر",
    country_en: "Egypt",
    member_since: "2023-01-27",
    total_rating: 4.71,
    completion_rate: 95.4,
    total_sales: 1780,
    response_minutes: 60,
    listings: [
      { id: "l8", kind: "service", title_ar: "تخصيص قالب لوحة تحكم", title_en: "Dashboard template customization", price_usdt: 145, thumbnail_url: img("photo-1551288049-bebda4e38f71") },
      { id: "l9", kind: "nft", title_ar: "Oasis Grid #305", title_en: "Oasis Grid #305", price_usdt: 640, thumbnail_url: img("photo-1634973357973-f2ed2657db3c") },
    ],
  },
  {
    username: "frame-house",
    name_ar: "دار الإطار",
    name_en: "Frame House",
    headline_ar: "مونتاج وإنتاج فيديو سينمائي",
    headline_en: "Cinematic editing & video production",
    bio_ar: "فريق مونتاج يقدم محتوى إعلاني وسينمائي مع تصحيح ألوان احترافي.",
    bio_en: "An editing team delivering commercial and cinematic content with professional color grading.",
    avatar_url: img("photo-1507003211169-0a1dd7228f2d", 240),
    cover_url: img("photo-1492691527719-9d1e07e534b4", 1400),
    verified: false,
    country_ar: "المغرب",
    country_en: "Morocco",
    member_since: "2024-02-05",
    total_rating: 4.62,
    completion_rate: 93.1,
    total_sales: 512,
    response_minutes: 75,
    listings: [
      { id: "l10", kind: "service", title_ar: "مونتاج فيديو سينمائي", title_en: "Cinematic video editing", price_usdt: 190, thumbnail_url: img("photo-1485846234645-a62644f84728") },
      { id: "l11", kind: "course", title_ar: "دورة مونتاج للمبتدئين", title_en: "Editing course for beginners", price_usdt: 65, thumbnail_url: img("photo-1574717024653-61fd2cf4d44d") },
    ],
  },
  {
    username: "neon-labs",
    name_ar: "نيون لابز",
    name_en: "Neon Labs",
    headline_ar: "أيقونات وأصول رسومية",
    headline_en: "Icons & graphic assets",
    bio_ar: "مكتبات أيقونات وأصول واجهات بأسلوب حديث تُحدَّث شهرياً.",
    bio_en: "Modern icon and UI asset libraries updated every month.",
    avatar_url: img("photo-1534528741775-53994a69daeb", 240),
    cover_url: img("photo-1502691876148-a84978e59af8", 1400),
    verified: true,
    country_ar: "الكويت",
    country_en: "Kuwait",
    member_since: "2022-06-14",
    total_rating: 4.9,
    completion_rate: 96.7,
    total_sales: 1320,
    response_minutes: 33,
    listings: [
      { id: "l12", kind: "service", title_ar: "تصميم حزمة أيقونات", title_en: "Custom icon pack design", price_usdt: 210, thumbnail_url: img("photo-1545235617-9465d2a55698") },
      { id: "l13", kind: "nft", title_ar: "Neon Falcon #204", title_en: "Neon Falcon #204", price_usdt: 890, thumbnail_url: img("photo-1643101807331-21a4a3f081d5") },
    ],
  },
];

export type LeaderboardMetric = "total_rating" | "completion_rate" | "total_sales";

/** Pure meritocratic ranking: numeric sort only, no boosting or pinning. */
export function rankSellers(metric: LeaderboardMetric, sellers: SellerProfile[] = SELLERS) {
  return [...sellers].sort((a, b) => b[metric] - a[metric]);
}

export function findSeller(username: string) {
  return SELLERS.find((s) => s.username === username);
}
