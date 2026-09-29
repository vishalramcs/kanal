import { Bricolage_Grotesque, Nunito } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { isAllowedEmail } from "@/lib/auth/domain";
import { createUserClient } from "@/lib/supabase/server";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "800"], variable: "--font-bricolage", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--font-nunito", display: "swap" });

export const metadata = {
  title: "ADAPT · AI Study Planner",
  description: "Plan, study, track and adapt: a study plan that changes with your real progress.",
};

export const viewport = { themeColor: "#ffd12b" };

/** Verified on the server, so the first paint already knows who is signed in. Only non-sensitive fields go to the browser. */
async function currentUser() {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user || !isAllowedEmail(user.email)) return null;
  const meta = user.user_metadata || {};
  return { id: user.id, email: user.email, name: meta.full_name || meta.name || user.email.split("@")[0], avatar: meta.avatar_url || meta.picture || null };
}

export default async function RootLayout({ children }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${bricolage.variable} ${nunito.variable}`}>
      <body>
        <AuthProvider initialUser={user}>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
