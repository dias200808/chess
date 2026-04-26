"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { login, authMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-3xl font-black">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {authMode === "supabase"
            ? "Supabase Auth is active."
            : "Local MVP auth is active until Supabase env vars are configured."}
        </p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {authMode === "supabase" ? (
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          ) : null}
          {error ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit">Log in</Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          No account? <Link className="font-semibold text-primary" href="/register">Register</Link>
        </p>
      </Card>
    </div>
  );
}
