import { Brain, ChartNoAxesCombined, Crown, Puzzle, ShieldCheck, Trophy } from "lucide-react";
import { Badge, Card, LinkButton } from "@/components/ui";

const benefits = [
  { icon: ShieldCheck, title: "Full legal rules", text: "Castling, en passant, promotion, checkmate, stalemate, and illegal move blocking." },
  { icon: Brain, title: "AI Coach", text: "Approximate mistake review with best and worst moments after every saved game." },
  { icon: Trophy, title: "Rating loop", text: "Start at 1200, gain points for wins, and compete on the leaderboard." },
  { icon: Puzzle, title: "Tactics trainer", text: "Practice mate patterns, forks, pins, material wins, and endgames." },
];

export default function Home() {
  return (
    <div className="grid gap-10">
      <section className="grid min-h-[70vh] items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Badge className="border-primary/30 bg-primary/10 text-primary">Chess.com-style MVP</Badge>
          <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
            A real chess platform, not just a board.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Knightly brings together local games, bot play, puzzles, saved history, analysis,
            profile stats, ratings, and a product-ready interface built with Next.js.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/play">Play</LinkButton>
            <LinkButton href="/bot" variant="secondary">Play vs Bot</LinkButton>
            <LinkButton href="/puzzles" variant="secondary">Solve Puzzles</LinkButton>
          </div>
        </div>

        <Card className="relative overflow-hidden p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative">
            <div className="grid grid-cols-4 overflow-hidden rounded-3xl border shadow-2xl">
              {Array.from({ length: 64 }).map((_, index) => (
                <div
                  key={index}
                  className={`aspect-square ${Math.floor(index / 8) % 2 === index % 2 ? "bg-[#e8d4aa]" : "bg-[#58764a]"}`}
                />
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">1200</p>
                <p className="text-sm text-muted-foreground">Starting rating</p>
              </div>
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">13</p>
                <p className="text-sm text-muted-foreground">Elo bots</p>
              </div>
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">unlimited</p>
                <p className="text-sm text-muted-foreground">Local games</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item) => (
          <Card key={item.title}>
            <item.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-4 text-lg font-black">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Brain className="h-7 w-7 text-accent" />
          <h2 className="mt-4 text-3xl font-black">AI Coach and mistake analysis</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Saved games receive an MVP analysis pass that labels best moves, inaccuracies,
            mistakes, blunders, and training focus. It is intentionally lightweight now and
            now backed by optional Stockfish deep analysis.
          </p>
        </Card>
        <Card>
          <ChartNoAxesCombined className="h-7 w-7 text-primary" />
          <h2 className="mt-4 text-3xl font-black">Rating growth</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Profiles track games, wins, losses, draws, win rate, and MVP rating changes.
          </p>
        </Card>
      </section>

      <section className="rounded-[2rem] border bg-foreground p-8 text-background">
        <Crown className="h-8 w-8 text-accent" />
        <h2 className="mt-4 text-3xl font-black">Pro plan is ready for monetization</h2>
        <p className="mt-3 max-w-2xl text-background/75">
          Pricing, plan comparison, upgrade CTA, and &quot;Coming Soon&quot; state are included. Real
          payments can be connected later with Stripe.
        </p>
        <LinkButton href="/pricing" className="mt-6 bg-accent text-accent-foreground">
          View Pro
        </LinkButton>
      </section>
    </div>
  );
}
