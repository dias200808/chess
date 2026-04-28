"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Field, SelectField } from "@/components/ui";
import { getGuestSession } from "@/lib/storage";

const ERROR_RESET_MS = 10_000;

function normalizeUsernameInput(value: string) {
  return value.replace(/\s+/g, "_");
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, authMode } = useAuth();
  const [form, setForm] = useState(() => ({
    role: "student" as "student" | "teacher",
    fullName: "",
    email: "",
    username: getGuestSession()?.username ?? "",
    password: "",
    confirmPassword: "",
    age: "",
    schoolName: "",
    city: "",
    country: "",
  }));
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

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        role: form.role,
        fullName: form.fullName,
        email: form.email,
        username: form.username,
        password: form.password,
        age: form.age ? Number(form.age) : null,
        schoolName: form.schoolName,
        city: form.city,
        country: form.country,
      });
      router.push(form.role === "teacher" ? "/classroom" : "/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="rounded-[2.5rem] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <Badge>Create Account</Badge>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Create your chess account</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Use one account for games, puzzles, analysis, and classroom progress. Teachers also
              get class management, student tracking, and lesson assignments.
            </p>
          </div>
          <div className="rounded-3xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Auth mode: <span className="font-semibold text-foreground">{authMode}</span>
          </div>
        </div>

        <form className="mt-6 grid gap-5" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Account type"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as "student" | "teacher",
                }))
              }
            >
              <option value="student">I am a Student</option>
              <option value="teacher">I am a Teacher</option>
            </SelectField>
            <Field
              label="Full name"
              value={form.fullName}
              onChange={(event) =>
                setForm((current) => ({ ...current, fullName: event.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="you@example.com"
              required
            />
            <Field
              label="Username"
              value={form.username}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  username: normalizeUsernameInput(event.target.value),
                }))
              }
              placeholder="chess_student"
              required
            />
          </div>

          {form.role === "student" ? (
            <Field
              label="Age (optional)"
              type="number"
              value={form.age}
              onChange={(event) =>
                setForm((current) => ({ ...current, age: event.target.value }))
              }
            />
          ) : (
            <Field
              label="School / academy"
              value={form.schoolName}
              onChange={(event) =>
                setForm((current) => ({ ...current, schoolName: event.target.value }))
              }
              placeholder="My Chess Academy"
              required
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="City"
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
              required
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(event) =>
                setForm((current) => ({ ...current, country: event.target.value }))
              }
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
              minLength={8}
            />
            <Field
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              required
              minLength={8}
            />
          </div>

          <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Password must be at least 8 characters. Username can use letters, numbers, and
            underscores.
          </div>

          {error ? (
            <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
