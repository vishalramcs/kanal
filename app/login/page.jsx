import { allowedDomain } from "@/lib/auth/domain";
import LoginCard from "@/components/auth/LoginCard";

export const metadata = { title: "Sign in · ADAPT" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === "string" ? params.next : "/dashboard";
  const error = typeof params?.error === "string" ? params.error : params?.signedout ? "signedout" : null;
  const reason = typeof params?.reason === "string" ? params.reason.slice(0, 200) : null;
  return <LoginCard domain={allowedDomain()} next={next} error={error} reason={reason} />;
}
