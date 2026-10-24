import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
            <Users aria-hidden className="size-5 text-primary-bright" />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/crear"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold whitespace-nowrap text-white shadow-[0_0_20px_rgb(220_38_38/0.35)] hover:bg-primary-hover"
            >
              Armar plan
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-16">{children}</main>
    </>
  );
}
