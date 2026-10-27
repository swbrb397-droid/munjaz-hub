import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Shell } from "../components/site/Shell";
import { LangProvider, useLang } from "../lib/lang";
import { Button } from "@/components/ui/button";
import { Home, FileQuestion } from "lucide-react";
import { ViewModeProvider } from "../lib/view-mode";
import { NotifyProvider } from "../lib/notify";
import { Toaster } from "@/components/ui/sonner";
import { GlobalErrorBoundary, BrandedFallback } from "@/components/site/GlobalErrorBoundary";
import { ErrorBoundary } from "@/components/site/ErrorBoundary";


import { supabase } from "@/lib/cloud-client";
import { cleanupLegacyStorage } from "@/lib/storage-cleanup";
import { captureReferralFromUrl } from "@/lib/referral-capture";
import { finishGoogleSignIn } from "@/lib/google-auth";



function NotFoundComponent() {
  return <LangProvider><NotFoundContent /></LangProvider>;
}

function NotFoundContent() {
  const { lang, tr } = useLang();
  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-dvh items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md text-center">
        <p className="mb-8 text-2xl font-black text-primary" dir="rtl">المُنجِز</p>
        <FileQuestion aria-hidden="true" className="mx-auto mb-4 size-10 text-muted-foreground" />
        <p className="text-7xl font-black leading-none text-primary" dir="ltr">404</p>
        <h1 className="mt-6 text-xl font-bold text-foreground">{tr("الصفحة غير موجودة", "Page not found")}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {tr("قد يكون الرابط غير صحيح أو تم نقل الصفحة.", "The link may be incorrect, or the page may have moved.")}
        </p>
        <div className="mt-7">
          <Button asChild size="lg" className="min-h-11 max-w-full px-5">
            <Link to="/">
              <Home aria-hidden="true" />
              {tr("العودة إلى الرئيسية", "Back to home")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error('[Root Crash Captured]:', error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  void router;
  void reset;
  return <BrandedFallback message={(error as Error).message} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Al-Munjaz" },
      { name: "theme-color", content: "#0B0F19" },
      { name: "application-name", content: "مُنجَز | Almunjaz Hub" },
      { name: "google-site-verification", content: "j52cZizrSH7NVvYjSyZrmbXEDb5CwLT4LThNJoH77X4" },
      { property: "og:site_name", content: "مُنجَز | Almunjaz Hub" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;600;800&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=2" },
      { rel: "alternate icon", href: "/favicon.ico?v=2" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  // Client-only rendering for the whole tree: no server render, no hydration mismatch.
  ssr: false,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Purge legacy/demo client storage on mount; Supabase auth tokens are preserved.
  useEffect(() => {
    cleanupLegacyStorage();
    // Capture ?ref=CODE so the referral survives until the visitor signs up.
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Google sign-in return: finish referral attachment and land on the dashboard.
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void finishGoogleSignIn().then((go) => {
          if (go) void router.navigate({ to: "/dashboard", replace: true });
        });
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ViewModeProvider>
          <NotifyProvider>
          <Shell>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <ErrorBoundary label="page">
              <Outlet />
            </ErrorBoundary>
          </Shell>
          <Toaster position="top-center" richColors />
          </NotifyProvider>
        </ViewModeProvider>
      </LangProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );

}



