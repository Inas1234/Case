import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Blocks,
  Brain,
  ClipboardCheck,
  Compass,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { CaseDropDemo } from "@/components/marketing/case-drop-demo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const flowItems = ["Dump", "Organize", "Challenge", "Compress", "Verdict"];

const featureCards = [
  {
    title: "Board-first thinking",
    copy: "Your ideas stay spatial. AI acts on cards and structure, not long chat threads.",
    icon: <Blocks className="size-4" />,
  },
  {
    title: "Decision pressure",
    copy: "Skeptic, Scientist, and Market Analyst roles create useful tension where it matters.",
    icon: <ShieldAlert className="size-4" />,
  },
  {
    title: "Compression loops",
    copy: "The board narrows to top risk, open questions, and one concrete next move.",
    icon: <ClipboardCheck className="size-4" />,
  },
];

export default function LandingPage() {
  return (
    <main className="relative">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Case
            </span>
            <Badge variant="outline" className="border-border/70 bg-card/60 text-[10px]">
              investigative workspace
            </Badge>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#workflow" className="hover:text-foreground">
              Workflow
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Log in
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="case-hero-glow relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid min-h-[80svh] w-full max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-[1.06fr_1fr]">
          <div className="space-y-6 animate-rise-in">
            <Badge variant="outline" className="border-border/70 bg-card/60">
              Decision-first idea board
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              Solve what matters before your board becomes noise.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Case turns messy ideas into structured cases. Organize evidence, challenge assumptions,
              surface contradictions, and land on a real decision.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
                Open your first case
                <ArrowRight />
              </Link>
              <Link
                href="/board"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Explore board
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {flowItems.map((item) => (
                <Badge key={item} variant="secondary" className="border border-border/60">
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <div className="animate-float-slow">
            <CaseDropDemo />
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Core Features</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Built for solvable cases</h2>
          </div>
          <Badge variant="outline" className="border-border/70">
            no autonomous agent sprawl
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <Card
              key={feature.title}
              className="case-panel border-border/70 animate-rise-in"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <CardHeader className="space-y-2">
                <span className="text-muted-foreground">{feature.icon}</span>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{feature.copy}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-14 md:grid-cols-2">
          <Card className="case-panel border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">How teams use Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowRow
                icon={<Search className="size-4" />}
                title="1. Dump raw context"
                copy="Add notes, screenshots, links, concerns, and half-formed ideas on one board."
              />
              <WorkflowRow
                icon={<Brain className="size-4" />}
                title="2. Challenge weak logic"
                copy="Run role-based AI actions to expose unsupported claims and hidden contradictions."
              />
              <WorkflowRow
                icon={<Compass className="size-4" />}
                title="3. Resolve to a move"
                copy="Compress to one risk, one test, and one verdict direction."
              />
            </CardContent>
          </Card>
          <Card className="case-panel border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">What you leave with</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>- A clear thesis and explicit top risk.</p>
              <p>- Fewer unresolved questions, prioritized by decision impact.</p>
              <p>- A concrete next test instead of another brainstorming branch.</p>
              <p>- A board status that moves toward verdict rather than endless expansion.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Start free, then scale usage</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="$0"
            points={["Personal boards", "Core AI actions", "JSON/Markdown export"]}
          />
          <PriceCard
            name="Pro"
            price="$19"
            points={["More boards", "Longer case history", "Priority model options"]}
            featured
          />
          <PriceCard
            name="Team"
            price="Custom"
            points={["Shared templates", "Audit-ready logs", "Enterprise auth path"]}
          />
        </div>
      </section>

      <section className="border-t border-border/70 bg-card/35">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Ready to investigate?</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight">
              Turn your next idea into a solvable case.
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Create account
              <Sparkles />
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background/95">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Case</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              A spatial workspace for pressure-testing ideas and moving to decisions.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Product</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-foreground">
                  Workflow
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Account</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <Link href="/signup" className="hover:text-foreground">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/board" className="hover:text-foreground">
                  Open board
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}

function WorkflowRow({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background/45 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  points,
  featured = false,
}: {
  name: string;
  price: string;
  points: string[];
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        "case-panel border-border/70",
        featured && "ring-2 ring-ring/60 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <p className="text-3xl font-semibold">{price}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {points.map((point) => (
          <p key={`${name}-${point}`}>- {point}</p>
        ))}
      </CardContent>
    </Card>
  );
}
