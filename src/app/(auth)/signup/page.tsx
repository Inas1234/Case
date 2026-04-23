import { AuthForm } from "@/components/auth/auth-form";

interface SignupPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/board";

  return <AuthForm mode="signup" nextPath={nextPath} />;
}
