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
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppFooter } from "@/components/ai-disclaimer";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle, themeInitScript } from "@/components/theme-toggle";
import { BrandLockup } from "@/components/brand-mark";
import { FloatingField } from "@/components/floating-field";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Catalytic Private Test — Enterprise AI Workspace" },
      { name: "description", content: "Draft emails, summarize meetings, and plan your day with AI." },
      { property: "og:title", content: "Catalytic Private Test — Enterprise AI Workspace" },
      { property: "og:description", content: "Draft emails, summarize meetings, and plan your day with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Catalytic Private Test — Enterprise AI Workspace" },
      { name: "twitter:description", content: "Draft emails, summarize meetings, and plan your day with AI." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/623296fe-dcf3-40a9-ad19-532f505c5fdc" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/623296fe-dcf3-40a9-ad19-532f505c5fdc" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: `${import.meta.env.BASE_URL}favicon.png` },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <FloatingField />
        <div className="flex min-h-screen w-full font-sans">
          <AppSidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <header className="hairline-bottom sticky top-0 z-20 flex h-14 items-center gap-3 bg-background/60 px-4 backdrop-blur-xl">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <BrandLockup compact />
              <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                / Enterprise AI
              </span>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:inline-flex">
                  <span className="status-dot" />
                  Systems nominal
                </span>
                <ThemeToggle />
              </div>
            </header>
            <main className="grid-field ambient-glow flex-1">
              <Outlet />
            </main>
            <AppFooter />
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
