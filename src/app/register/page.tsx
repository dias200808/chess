"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Field } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }
    try {
      await register({
        email: form.email,
        username: form.username,
        password: form.password,
      });
      router.push("/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось зарегистрироваться.");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-3xl font-black">Регистрация</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Создайте аккаунт, чтобы сохранить рейтинг, статистику и прогресс по задачам.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Field label="Имя пользователя" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
          <Field label="Пароль" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
          <Field label="Повторите пароль" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required minLength={8} />
          {error ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit">Создать аккаунт</Button>
        </form>
      </Card>
    </div>
  );
}
