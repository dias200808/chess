import { Brain, ChartNoAxesCombined, Crown, Puzzle, ShieldCheck, Trophy } from "lucide-react";
import { HeroBoard } from "@/components/hero-board";
import { Badge, Card, LinkButton } from "@/components/ui";

const benefits = [
  { icon: ShieldCheck, title: "Полные правила шахмат", text: "Рокировка, взятие на проходе, превращение пешки, мат, пат и запрет нелегальных ходов." },
  { icon: Brain, title: "AI-тренер", text: "Быстрый разбор ошибок и лучших моментов после каждой сохранённой партии." },
  { icon: Trophy, title: "Рост рейтинга", text: "Стартуйте с 1200, получайте очки за победы и поднимайтесь в таблице лидеров." },
  { icon: Puzzle, title: "Тактические задачи", text: "Тренируйте маты, вилки, связки, выигрыш материала и эндшпили." },
];

export default function Home() {
  return (
    <div className="grid gap-10">
      <section className="relative grid min-h-[72vh] items-center gap-8 overflow-hidden rounded-[2.5rem] border bg-card/40 p-5 shadow-2xl shadow-black/10 sm:p-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="pointer-events-none absolute -left-24 top-14 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative z-10">
          <Badge className="border-primary/30 bg-primary/10 text-primary">Шахматный MVP</Badge>
          <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">
            Полноценная шахматная платформа, а не просто доска.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Knightly объединяет локальные партии, игру с ботом, задачи, историю, анализ,
            профиль игрока, рейтинг и готовый интерфейс на Next.js.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/play">Играть</LinkButton>
            <LinkButton href="/bot" variant="secondary">Играть с ботом</LinkButton>
            <LinkButton href="/puzzles" variant="secondary">Решать задачи</LinkButton>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="rounded-3xl border bg-background/55 p-4 backdrop-blur">
              <p className="font-mono text-2xl font-black">800+</p>
              <p className="text-xs text-muted-foreground">Рейтинг задач</p>
            </div>
            <div className="rounded-3xl border bg-background/55 p-4 backdrop-blur">
              <p className="font-mono text-2xl font-black">200-2400</p>
              <p className="text-xs text-muted-foreground">Лестница ботов</p>
            </div>
            <div className="rounded-3xl border bg-background/55 p-4 backdrop-blur">
              <p className="font-mono text-2xl font-black">Готово</p>
              <p className="text-xs text-muted-foreground">Под Supabase</p>
            </div>
          </div>
        </div>

        <Card className="relative z-10 overflow-hidden p-5 sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative">
            <HeroBoard />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">1200</p>
                <p className="text-sm text-muted-foreground">Стартовый рейтинг</p>
              </div>
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">13</p>
                <p className="text-sm text-muted-foreground">Elo-ботов</p>
              </div>
              <div className="rounded-3xl bg-muted p-4">
                <p className="font-mono text-3xl font-black">без лимита</p>
                <p className="text-sm text-muted-foreground">Локальных партий</p>
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
          <h2 className="mt-4 text-3xl font-black">AI-тренер и анализ ошибок</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Сохранённые партии получают быстрый анализ с пометками лучших ходов, неточностей,
            ошибок, зевков и рекомендациями для тренировки. При желании можно подключить
            углублённый разбор Stockfish.
          </p>
        </Card>
        <Card>
          <ChartNoAxesCombined className="h-7 w-7 text-primary" />
          <h2 className="mt-4 text-3xl font-black">Прогресс рейтинга</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Профиль отслеживает партии, победы, поражения, ничьи, винрейт и изменение рейтинга.
          </p>
        </Card>
      </section>

      <section className="rounded-[2rem] border bg-foreground p-8 text-background">
        <Crown className="h-8 w-8 text-accent" />
        <h2 className="mt-4 text-3xl font-black">Pro-план готов к монетизации</h2>
        <p className="mt-3 max-w-2xl text-background/75">
          Уже есть тарифы, сравнение планов, CTA на апгрейд и состояние &quot;Скоро&quot;. Позже
          можно подключить реальные платежи через Stripe.
        </p>
        <LinkButton href="/pricing" className="mt-6 bg-accent text-accent-foreground">
          Открыть Pro
        </LinkButton>
      </section>
    </div>
  );
}
