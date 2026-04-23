import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 case-grid animate-grid-drift opacity-20" />
      <div className="pointer-events-none absolute -top-16 -left-20 h-72 w-72 rounded-full bg-rose-900/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <span>Case</span>
          <Link href="/" className="hover:text-foreground">
            Back to site
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
