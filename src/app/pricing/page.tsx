import { Check, Crown } from "lucide-react";
import { Badge, Card, LinkButton } from "@/components/ui";

const free = ["Play against bot", "Limited analyses", "Limited puzzles", "Basic rating"];
const pro = ["Unlimited analysis", "Advanced AI Coach", "Custom themes", "More puzzles", "Advanced statistics"];

export default function PricingPage() {
  return (
    <div className="grid gap-6">
      <Card>
        <Badge>Coming Soon</Badge>
        <h1 className="mt-2 text-4xl font-black">Pro upgrade</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Real payments are intentionally not enabled in the MVP. This page is ready for a future
          Stripe checkout flow.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black">Free</h2>
          <p className="mt-2 text-muted-foreground">For casual play and learning.</p>
          <p className="mt-6 font-mono text-5xl font-black">$0</p>
          <ul className="mt-6 grid gap-3">
            {free.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <LinkButton href="/play" className="mt-6">Start free</LinkButton>
        </Card>

        <Card className="border-primary bg-primary text-primary-foreground">
          <Crown className="h-8 w-8" />
          <h2 className="mt-4 text-2xl font-black">Pro</h2>
          <p className="mt-2 text-primary-foreground/75">For ambitious improvement.</p>
          <p className="mt-6 font-mono text-5xl font-black">$9</p>
          <ul className="mt-6 grid gap-3">
            {pro.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-4 w-4" />
                {item}
              </li>
            ))}
          </ul>
          <button className="mt-6 h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground">
            Upgrade to Pro - Coming Soon
          </button>
        </Card>
      </div>
    </div>
  );
}
