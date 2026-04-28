"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field } from "@/components/ui";

const ERROR_RESET_MS = 10_000;

export default function LoginPage() {
  const router = useRouter();
  const { login, authMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(""), ERROR_RESET_MS);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="rounded-[2.5rem] p-5 sm:p-7">
        <Badge>Sign in</Badge>
        <h1 className="mt-3 text-3xl font-black">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in to continue with games, analysis, classroom progress, and saved history.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Auth mode: <span className="font-semibold text-foreground">{authMode}</span>
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          No account yet?{" "}
          <Link className="font-semibold text-primary" href="/register">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
