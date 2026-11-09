import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EK Stock Control Program" },
      { name: "description", content: "Kitchen Creator Pro designs kitchens using modular components and custom branding." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "EK Stock Control Program" },
      { property: "og:description", content: "Kitchen Creator Pro designs kitchens using modular components and custom branding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "EK Stock Control Program" },
      { name: "twitter:description", content: "Kitchen Creator Pro designs kitchens using modular components and custom branding." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/042f596d-cd43-4727-aede-7bde13ec6c05/id-preview-7c49719e--975b1b1e-8764-4070-88ce-d6e13e1121a1.lovable.app-1777895086337.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/042f596d-cd43-4727-aede-7bde13ec6c05/id-preview-7c49719e--975b1b1e-8764-4070-88ce-d6e13e1121a1.lovable.app-1777895086337.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  useEffect(() => {
    if (typeof window === "undefined") return;

    const RELOAD_KEY = "__chunk_reload_at";
    const isChunkError = (msg: unknown): boolean => {
      const text = typeof msg === "string" ? msg : (msg as Error)?.message ?? "";
      return (
        /Failed to fetch dynamically imported module/i.test(text) ||
        /Importing a module script failed/i.test(text) ||
        /error loading dynamically imported module/i.test(text) ||
        /ChunkLoadError/i.test(text)
      );
    };

    const triggerReload = () => {
      // Throttle so we never get into an infinite reload loop.
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
      const now = Date.now();
      if (now - last < 5000) return;
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message) || isChunkError(e.error)) triggerReload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) triggerReload();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
