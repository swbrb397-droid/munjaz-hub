import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import {
  Shield,
  Scale,
  AlertTriangle,
  Lock,
  Ban,
  UserCheck,
  FileText,
  Wallet,
  Globe,
  Gavel,
} from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "الشروط والأحكام وسياسة إخلاء المسؤولية | المُنجَز" },
      { name: "description", content: "الشروط والأحكام وسياسة إخلاء المسؤولية لمنصة المُنجَز — منصة الخدمات الرقمية ووسيط الضمان بعملة USDT." },
      { property: "og:title", content: "الشروط والأحكام وسياسة إخلاء المسؤولية | المُنجَز" },
      { property: "og:description", content: "اقرأ الشروط الكاملة التي تحكم استخدام منصة المُنجَز، والتعاملات المالية بـ USDT، ونظام الضمان، والنزاعات، والملكية الفكرية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { tr, lang } = useLang();
  const lastUpdated = "9 August 2026";

  return (
    <Section
      title={tr("الشروط والأحكام وسياسة إخلاء المسؤولية", "Terms of Service & Disclaimer")}
      subtitle={tr(
        "يُرجى قراءة هذه الشروط بعناية قبل استخدام منصة المُنجَز. استخدامك للمنصة يعني موافقتك الكاملة والمسبقة على جميع البنود أدناه.",
        "Please read these terms carefully before using Al-Munjaz. By accessing or using the platform, you agree to be bound by all provisions below.",
      )}
    >
      <p className="mb-8 text-xs text-muted-foreground">
        {tr("آخر تحديث:", "Last updated:")} {lastUpdated} · {lang === "ar" ? "هذه الوثيقة نموذج قانوني يجب مراجعتها من محامٍ مُرخّص قبل النشر النهائي." : "This document is a legal template and should be reviewed by licensed counsel before final publication."}
      </p>

      <div className="grid gap-6">
        <Clause
          icon={<Shield className="size-5 text-primary" />}
          title={tr("1. صفة المنصة كوسيط تقني", "1. Platform Identity & Technical Intermediary Role")}
          body={tr(
            `تعمل منصة المُنجَز كوسيط تقني إلكتروني فحسب، تربط بين البائعين (مُقدّمي الخدمات والمنتجات الرقمية) والمشترين. لا تُعدّ المُنجَز طرفاً في أي عقد مباشر، ولا توظّف المستقلين أو المُدرّبين أو مُنشئي المحتوى، ولا تضمن جودة أي عمل أو خدمة أو منتج رقمي أو NFT. كل المحتوى والعروض والتقييمات منشأة من المستخدمين، ولا تُمثّل توصية أو اعتماداً من منصة المُنجَز. المنصة غير مسؤولة عن أي خلاف ينشأ بين المستخدمين، باستثناء تطبيق آليات الضمان والنزاعات المُعلنة في هذه الشروط.`,
            `Al-Munjaz operates solely as a technical electronic intermediary connecting sellers (service providers, digital product creators, and NFT sellers) with buyers. Al-Munjaz is not a party to any direct contract, does not employ freelancers, trainers, or content creators, and does not guarantee the quality of any work, service, digital product, or NFT. All content, listings, and reviews are user-generated and do not constitute an endorsement or recommendation by Al-Munjaz. The platform is not liable for disputes arising between users, except as provided through the escrow and dispute mechanisms described herein.`,
          )}
        />

        <Clause
          icon={<Wallet className="size-5 text-accent" />}
          title={tr("2. إخلاء المسؤولية المالية والبلوكتشين", "2. Blockchain & USDT Financial Disclaimer")}
          body={tr(
            `المستخدم وحده مسؤول عن إدخال عناوين محافظ USDT الصحيحة واختيار الشبكة المتوافقة (TRC-20 أو BEP-20 أو Polygon). لا تتحمّل المُنجَز أي مسؤولية عن فقدان الأموال نتيجة اختيار شبكة خاطئ، أو خطأ في العنوان، أو انقطاع خدمة المحفظة الخارجية. المُنجَز ليست بنكاً أو مؤسسة مالية، ولا تضمن سرعة تأكيدات الشبكات الخارجية أو تقلّبات رسوم الغاز (gas fees) أو تغيّر الأنظمة التنظيمية للعملات الرقمية في اختصاص المستخدم. لا يتم تقديم أي مشورة مالية أو استثمارية عبر المنصة.`,
            `The user is solely responsible for entering correct USDT wallet addresses and selecting the compatible network (TRC-20, BEP-20, or Polygon). Al-Munjaz is not liable for any loss of funds resulting from incorrect network selection, wrong addresses, or failure of an external wallet service. Al-Munjaz is not a bank or financial institution, does not guarantee confirmation speeds on external networks, gas fee fluctuations, or regulatory changes regarding cryptocurrencies in the user's jurisdiction. No financial or investment advice is provided through the platform.`,
          )}
        />

        <Clause
          icon={<Scale className="size-5 text-violet" />}
          title={tr("3. نظام الضمان وإلزامية قرارات الذكاء الاصطناعي", "3. Escrow System & Binding AI Rulings")}
          body={tr(
            `عند إنشاء طلب، يتم تجميد رصيد المشتري في حساب الضمان الداخلي حتى يتم اعتماد التسليم أو حل النزاع. إذا لم يعترض المشتري خلال فترة المراجعة (72 ساعة افتراضياً) بعد تسليم البائع، يتم إطلاق الأموال للبائع تلقائياً. في النزاعات، يتم تفعيل وكيل الذكاء الاصطناعي لتحليل الأدلة والتواصل والبنود المتفق عليها، ثم يُصدر حكماً نهائياً. باستخدام المنصة، توافق صراحةً على أن أحكام وكيل الذكاء الاصطناعي نهائية ومُلزمة وغير قابلة للاستئناف، ويتم تطبيقها على الفور (تحرير الأموال أو استردادها). يحتفظ فريق الإدارة بحق التدخل اليدوي في حالات الاحتيال الواضح أو عدم توفّر بيانات كافية.`,
            `When an order is created, the buyer's funds are locked in internal escrow until delivery is approved or the dispute is resolved. If the buyer does not object during the review window (default 72 hours) after the seller delivers, funds are automatically released to the seller. In disputes, the AI Dispute Resolution Agent analyzes evidence, communications, and agreed terms, then issues a final verdict. By using the platform, you explicitly agree that AI agent rulings are final, binding, and non-appealable, and are applied immediately (release or refund of funds). The admin team reserves the right to manually intervene in cases of obvious fraud or insufficient evidence.`,
          )}
        />

        <Clause
          icon={<Lock className="size-5 text-rose" />}
          title={tr("4. سياسة المنتجات الرقمية والتنزيل المباشر", "4. Non-Refundable Digital Goods & LMS")}
          body={tr(
            `جميع عمليات بيع المنتجات الرقمية الفورية، وشراء NFT، والوصول إلى الدورات والمحتوى التعليمي (LMS) غير قابلة للاسترداد بمجرد التسليم أو الدخول أو التنزيل، إلا في حالة وجود عيب تقني قاتل يمنع الاستخدام تماماً، ويُثبّت من قبل فريق إدارة المنصة. يقع على المشتري مسؤولية التحقق من وصف المنتج والمتطلبات التقنية قبل الشراء. لا يُعتبر عدم رضا المشتري عن النتيجة سبباً للاسترداد بالنسبة للخدمات المخصّصة أو المنتجات الرقمية المُستخدمة.`,
            `All instant digital product sales, NFT purchases, and LMS course accesses are strictly non-refundable once delivered, accessed, or downloaded, unless a fatal technical flaw prevents all use and is verified by platform administrators. The buyer is responsible for verifying product descriptions and technical requirements before purchase. Buyer dissatisfaction with outcome is not grounds for a refund for custom services or consumed digital products.`,
          )}
        />

        <Clause
          icon={<Lock className="size-5 text-amber" />}
          title={tr("4.1 اشتراكات Pro و Corporate غير قابلة للاسترداد", "4.1 Pro & Corporate Subscriptions — Non-Refundable")}
          body={tr(
            `اشتراكات Pro و Corporate غير قابلة للاسترداد بنسبة 100% تحت أي ظرف من الظروف بمجرد إتمام الدفع. لا يُمنح أي استرداد كلي أو جزئي عند الإلغاء المبكر، أو عدم استخدام المزايا، أو تعليق الحساب نتيجة مخالفة الشروط، أو تغيّر حدود المقاعد. يستمر الاشتراك حتى نهاية الدورة المدفوعة ثم يتوقف التجديد إن ألغاه المستخدم.`,
            `Pro & Corporate Subscriptions are strictly 100% NON-REFUNDABLE under any circumstances upon payment. No full or partial refund is granted for early cancellation, unused features, account suspension due to terms violations, or seat-cap changes. The subscription remains active until the end of the paid cycle and simply does not renew if cancelled.`,
          )}
        />


        <Clause
          icon={<Ban className="size-5 text-destructive" />}
          title={tr("5. منع التعاملات الخارجية", "5. Strict Anti-Off-Platform Prohibition")}
          body={tr(
            `يُحظر تماماً على جميع المستخدمين إجراء تواصل أو دفع خارج منصة المُنجَز بهدف تجاوز رسوم المنصة أو نظام الضمان. يشمل الحظر مشاركة أرقام هواتف، عناوين بريد إلكتروني، حسابات وسائل التواصل، أو روابط محافظ خارجية داخل مساحة الطلب أو المراسلة. أي محاولة للتعامل الخارجي تُعدّ خرقاً جوهرياً، ويترتب عليه: تعليق الحساب نهائياً، ومصادرة أي عمولات إحالة معلّقة، وسحب شارة التوثيق، وإلغاء جميع الحمايات والضمانات. تحتفظ المنصة بحق متابعة المستخدم مخالفاً للتعويضات القانونية.`,
            `All users are strictly prohibited from communicating or making payments outside the Al-Munjaz platform to bypass platform fees or escrow. This includes sharing phone numbers, email addresses, social media accounts, or external wallet links inside order workspaces or chat. Any off-platform attempt is a material breach, resulting in: permanent account suspension, forfeiture of all pending affiliate commissions, revocation of verified badge status, and loss of all protections and escrow guarantees. The platform reserves the right to pursue legal remedies against violating users.`,
          )}
        />

        <Clause
          icon={<UserCheck className="size-5 text-emerald" />}
          title={tr("6. التوثيق (KYC) ومكافحة غسيل الأموال", "6. KYC & Anti-Money Laundering")}
          body={tr(
            `تخضع جميع عمليات السحب والتعاملات المالية لحدود KYC المصمّمة: المستوى 0 للتصفح، المستوى 1 للحسابات الأساسية، المستوى 2 للسحوبات المتوسطة، والمستوى 3 للحسابات ذات الحجم المرتفع. تحتفظ المُنجَز بالحق—دون سابق إنذار—في تعليق الحساب، وتجميد السحوبات، وطلب مستندات توثيق إضافية (Tier 2+) في حال اكتشاف نشاط مالي مشبوه، أو تلاعب في الإحالات، أو محاولات غسيل أموال، أو احتيال. قد يتم الإبلاغ عن الحالات المشبوهة للجهات التنظيمية المختصة. يتحمل المستخدم مسؤولية صحة جميع المستندات المُرفقة.`,
            `All withdrawals and financial activity are subject to tiered KYC limits: Tier 0 for browsing, Tier 1 for basic accounts, Tier 2 for medium withdrawals, and Tier 3 for high-volume accounts. Al-Munjaz reserves the right—without prior notice—to freeze accounts, withhold withdrawals, and request additional KYC documentation (Tier 2+) if suspicious financial activity, referral manipulation, money laundering, or fraud is detected. Suspicious cases may be reported to relevant regulatory authorities. The user is responsible for the accuracy of all submitted documents.`,
          )}
        />

        <Clause
          icon={<FileText className="size-5 text-cyan" />}
          title={tr("7. الملكية الفكرية وإخلاء المسؤولية عن NFT", "7. Intellectual Property & NFT Liability Waiver")}
          body={tr(
            `يُقرّ البائع بأنه يملك 100% من الحقوق القانونية للأصول والمحتويات والمنتجات والـ NFT المعروضة، أو أنه حاصل على ترخيص صريح لبيعها أو استخدامها تجارياً. المُنجَز لا تتحقّق من صحة الملكية الفكرية لكل عرض بشكل فردي، ولا تتحمل أي مسؤولية عن انتهاك حقوق الطبع أو العلامة التجارية أو سرّية تجارية من قبل البائع. في حال تلقّي إشعار تعدٍ صحيح (DMCA)، سيتم إزالة العرض المعنيّ فوراً وقد يُعلق حساب البائع. المشتري يتحمل مخاطر شراء الأصول الرقمية، ولا يجوز إعادة بيعها أو توزيعها إذا نصّت الرخصة على ذلك.`,
            `The seller represents that they own 100% of the legal rights to the assets, content, products, and NFTs listed, or have explicit licensing to sell or use them commercially. Al-Munjaz does not individually verify the intellectual property rights of every listing and assumes no liability for seller copyright, trademark, or trade-secret infringement. Upon receipt of a valid takedown notice (DMCA), the affected listing will be removed immediately and the seller's account may be suspended. The buyer assumes the risk of purchasing digital assets and may not resell or redistribute them if the license prohibits it.`,
          )}
        />

        <Clause
          icon={<AlertTriangle className="size-5 text-amber" />}
          title={tr("8. تحديد المسؤولية والتعويض", "8. Limitation of Liability & Indemnification")}
          body={tr(
            `إلى الحد الأقصى المسموح به بموجب القانون، لا تكون المُنجَز أو مؤسسوها أو مشغّلوها أو شركاؤها أو مزوّدو خدماتها مسؤولين عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو تبعية أو خسارة أرباح أو فساد بيانات أو انقطاع أعمال، ينشأ عن استخدام المنصة أو عدم القدرة على استخدامها، أو عن انقطاع خدمات الطرف الثالث (مثل Supabase أو Gemini أو WebRTC أو مزوّدي البلوكتشين). يوافق المستخدم على تعويض المُنجَز والدفاع عنها ضد أي مطالبات أو خسائر أو تكاليف تنشأ عن استخدامه للمنصة أو خرقه لهذه الشروط. لا تتجاوز مسؤولية المُنجَز المباشرة — إذا ثبتت — قيمة الرسوم المدفوعة للمنصة في المعاملة التي تسببت في الضرر.`,
            `To the maximum extent permitted by law, Al-Munjaz, its founders, operators, partners, and service providers shall not be liable for any direct, indirect, incidental, consequential, or special damages, lost profits, data corruption, or business interruption arising from use of or inability to use the platform, or from third-party service outages (such as Supabase, Gemini, WebRTC, or blockchain providers). The user agrees to indemnify, defend, and hold Al-Munjaz harmless against any claims, losses, or costs arising from their use of the platform or breach of these terms. Al-Munjaz's direct liability—if proven—shall not exceed the platform fees paid for the specific transaction giving rise to the damage.`,
          )}
        />

        <Clause
          icon={<Gavel className="size-5 text-foreground" />}
          title={tr("9. الحسابات والقبول والقانون المُطبّق", "9. Accounts, Acceptance & Governing Law")}
          body={tr(
            `يجب أن يكون المستخدم عمره 18 عاماً على الأقل. يتحمل المستخدم مسؤولية سرية بيانات دخوله، ويُخطر المنصة فوراً بأي استخدام غير مُصرّح به. يُعدّ استخدام المنصة موافقة على هذه الشروط وعلى سياسة الخصوصية. تحتفظ المُنجَز بحق تعديل هذه الشروط في أي وقت، مع نشر النسخة المُحدّثة على هذه الصفحة. تُطبّق هذه الشروط وتُفسر وفقاً للقانون الساري في اختصاص تشغيل المنصة، وتُحال النزاعات إلى المحاكم المختصة في ذات الاختصاص. لإرسال إشعارات قانونية، يُستخدم البريد الرسمي المُعلن من قبل المنصة.`,
            `Users must be at least 18 years old. Users are responsible for maintaining the confidentiality of their login credentials and must notify the platform immediately of any unauthorized use. Use of the platform constitutes acceptance of these terms and the Privacy Policy. Al-Munjaz reserves the right to modify these terms at any time by posting the updated version on this page. These terms are governed by and interpreted in accordance with the laws of the jurisdiction in which the platform operates, and disputes are subject to the exclusive jurisdiction of the courts in that jurisdiction. Legal notices should be sent via the official email published by the platform.`,
          )}
        />

        <Clause
          icon={<Globe className="size-5 text-primary" />}
          title={tr("10. إشعار تواصل قانوني", "10. Legal Contact Notice")}
          body={tr(
            `للاستفسارات القانونية أو إرسال إشعارات التعدي (DMCA) أو الشكاوى التنظيمية، يُرجى التواصل مع فريق المُنجَز عبر القنوات الرسمية المُعلنة في صفحة "اتصل بنا" أو التذاكر الداخلية. لا يُعتبر التواصل عبر وسائل غير رسمية إشعاراً قانونياً صحيحاً.`,
            `For legal inquiries, DMCA takedown notices, or regulatory complaints, please contact the Al-Munjaz team through the official channels listed on the Contact page or internal support tickets. Communications through unofficial channels are not considered valid legal notices.`,
          )}
        />
      </div>

      <Card className="mt-8 border-primary/20 bg-primary/5">
        <p className="text-sm leading-relaxed text-foreground">
          {tr(
            "باستخدامك لمنصة المُنجَز، فإنك تؤكد أنك قرأت هذه الشروط وفهمتها ووافقت عليها. إذا لم توافق على أي جزء منها، يجب أن تتوقف عن استخدام المنصة فوراً.",
            "By using Al-Munjaz, you confirm that you have read, understood, and agree to these terms. If you do not agree with any part of them, you must stop using the platform immediately.",
          )}
        </p>
      </Card>
    </Section>
  );
}

function Clause({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="mt-2 leading-relaxed text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </Card>
  );
}
