import { Check, Crown, GraduationCap, Sparkles } from "lucide-react";
import { Badge, Card, LinkButton } from "@/components/ui";

const playerFree = [
  "Play against bot",
  "Limited analyses",
  "Limited puzzles",
  "Basic rating tracking",
];

const playerPro = [
  "Unlimited analysis",
  "Advanced AI Coach",
  "More puzzles and rush modes",
  "Advanced statistics",
  "Premium board themes",
];

const teacherFree = [
  "1 class",
  "Up to 5 students",
  "5 assignments per month",
  "Basic student activity view",
  "Class code join flow",
];

const teacherPro = [
  "5 classes",
  "Up to 50 students",
  "Unlimited assignments",
  "Full AI student reports",
  "Class leaderboard and progress insights",
  "Priority classroom tools and future tournaments",
];

function FeatureList({
  items,
  tone = "dark",
}: {
  items: string[];
  tone?: "dark" | "light";
}) {
  return (
    <ul className="mt-6 grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-3">
          <Check className={`h-4 w-4 ${tone === "light" ? "text-primary-foreground" : "text-primary"}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <div className="grid gap-6">
      <Card className="rounded-[2.5rem]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Badge>Coming Soon</Badge>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Plans for players and teachers</h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Knightly is not only for normal play. The teacher plan unlocks the classroom system,
              student tracking, assignments, and AI learning reports for chess schools and coaches.
            </p>
          </div>
          <div className="rounded-3xl border bg-muted px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Payments
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Real Stripe checkout is not enabled in the MVP yet, but pricing and upgrade structure
              are ready.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            <div>
              <h2 className="text-2xl font-black">Player Plans</h2>
              <p className="text-sm text-muted-foreground">For normal play, puzzles, and improvement.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-muted p-5">
              <p className="text-2xl font-black">Free</p>
              <p className="mt-1 text-sm text-muted-foreground">Casual play and learning.</p>
              <p className="mt-5 font-mono text-5xl font-black">$0</p>
              <FeatureList items={playerFree} />
              <LinkButton href="/play" className="mt-6">
                Start free
              </LinkButton>
            </div>

            <div className="rounded-[2rem] bg-primary p-5 text-primary-foreground">
              <Crown className="h-7 w-7" />
              <p className="mt-4 text-2xl font-black">Pro</p>
              <p className="mt-1 text-sm text-primary-foreground/75">For ambitious improvement.</p>
              <p className="mt-5 font-mono text-5xl font-black">$9</p>
              <p className="mt-1 text-sm text-primary-foreground/75">per month</p>
              <FeatureList items={playerPro} tone="light" />
              <button className="mt-6 h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground">
                Upgrade to Pro - Coming Soon
              </button>
            </div>
          </div>
        </Card>

        <Card className="border-primary/30">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" />
            <div>
              <h2 className="text-2xl font-black">Teacher Plans</h2>
              <p className="text-sm text-muted-foreground">
                For coaches, academies, and school chess programs.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-muted p-5">
              <p className="text-2xl font-black">Free Teacher</p>
              <p className="mt-1 text-sm text-muted-foreground">Good for testing one small class.</p>
              <p className="mt-5 font-mono text-5xl font-black">$0</p>
              <FeatureList items={teacherFree} />
              <div className="mt-6 rounded-2xl border bg-background/70 p-4 text-sm text-muted-foreground">
                Best for one coach trying the classroom feature with a few students.
              </div>
            </div>

            <div className="rounded-[2rem] bg-[#6cc98f] p-5 text-[#0d2214]">
              <Badge className="border-[#0d2214]/15 bg-white/30 text-[#0d2214]">Best For Coaches</Badge>
              <p className="mt-4 text-2xl font-black">Pro Teacher</p>
              <p className="mt-1 text-sm text-[#0d2214]/75">
                Built for serious teaching, tracking, and student growth.
              </p>
              <p className="mt-5 font-mono text-5xl font-black">$19</p>
              <p className="mt-1 text-sm text-[#0d2214]/75">per month</p>
              <FeatureList items={teacherPro} />
              <div className="mt-6 rounded-2xl bg-white/35 p-4 text-sm">
                Bonus: better classroom insights, stronger AI recommendations, and room for a real
                academy workflow.
              </div>
              <button className="mt-6 h-11 rounded-full bg-[#f2b949] px-5 text-sm font-bold text-[#271500]">
                Upgrade to Pro Teacher - Coming Soon
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-2xl font-black">What Pro Teacher gives</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-muted p-5">
            <p className="text-lg font-black">More classroom capacity</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run multiple groups instead of only one class, with far more active students.
            </p>
          </div>
          <div className="rounded-3xl bg-muted p-5">
            <p className="text-lg font-black">AI student reports</p>
            <p className="mt-2 text-sm text-muted-foreground">
              See weaknesses, repeated mistakes, and recommended training for each student.
            </p>
          </div>
          <div className="rounded-3xl bg-muted p-5">
            <p className="text-lg font-black">Unlimited assignments</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Assign puzzles, games, reviews, and opening practice without monthly caps.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
