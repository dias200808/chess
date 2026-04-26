"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Field } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", city: "", password: "" });
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await register(form);
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-3xl font-black">Create your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Registration creates a 1200-rated local profile with stats and puzzle progress.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Field label="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
          <Field label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          <Field label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          {error ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit">Register</Button>
        </form>
      </Card>
    </div>
  );
}
