"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username must be 20 characters or less.")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only use letters, numbers, and underscores.",
    ),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

type AuthMode = "login" | "signup";
type AuthFormState = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

interface AuthFormProps {
  mode: AuthMode;
  nextPath?: string;
  notice?: string;
}

export function AuthForm({ mode, nextPath = "/board", notice }: AuthFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<AuthFormState>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AuthFormState, string>>
  >({});
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>(notice ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";

  const submitLabel = isLogin ? "Sign in" : "Create account";
  const title = isLogin ? "Access Investigation Board" : "Join the Investigation";
  const description = isLogin
    ? "Sign in with your email and continue your case."
    : "Create an account to start resolving ideas on a board.";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(notice ?? "");

    const schema = isLogin ? signInSchema : signUpSchema;
    const validation = schema.safeParse(form);

    if (!validation.success) {
      const nextErrors: Partial<Record<keyof AuthFormState, string>> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (
          field === "username" ||
          field === "email" ||
          field === "password" ||
          field === "confirmPassword"
        ) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (isLogin) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

        if (loginError) {
          setError(loginError.message);
          return;
        }

        router.replace(nextPath);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setSuccess("Account created. Check your email to confirm access, then sign in.");
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Authentication failed unexpectedly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/70 bg-card/90 backdrop-blur-md animate-rise-in">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Case Auth
        </p>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Authentication error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        <form className="space-y-4" onSubmit={onSubmit}>
          {!isLogin ? (
            <div className="space-y-2">
              <Label htmlFor={`${mode}-username`}>Username</Label>
              <Input
                id={`${mode}-username`}
                type="text"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
                autoComplete="username"
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.username)}
              />
              {fieldErrors.username ? (
                <p className="text-xs text-destructive">{fieldErrors.username}</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${mode}-email`}>Email</Label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-password`}>Password</Label>
            <Input
              id={`${mode}-password`}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              autoComplete={isLogin ? "current-password" : "new-password"}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password ? (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
          </div>
          {!isLogin ? (
            <div className="space-y-2">
              <Label htmlFor={`${mode}-confirm-password`}>Confirm password</Label>
              <Input
                id={`${mode}-confirm-password`}
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
              />
              {fieldErrors.confirmPassword ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.confirmPassword}
                </p>
              ) : null}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : submitLabel}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Need an account?" : "Already have an account?"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isLogin ? "Create one" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
