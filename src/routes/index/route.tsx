import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/index")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  head: () => ({
    meta: [
      { title: "المنجز | الصفحة الرئيسية" },
      { name: "description", content: "الانتقال إلى الصفحة الرئيسية لمنصة المنجز." },
      { property: "og:title", content: "المنجز | الصفحة الرئيسية" },
      { property: "og:description", content: "سوق المنجز للخدمات والمنتجات الرقمية بضمان USDT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});