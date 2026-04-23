import { AuthForm } from "@/components/auth/auth-form";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/board";

  return (
    <AuthForm mode="login" nextPath={nextPath} notice={params.message} />
  );
}
