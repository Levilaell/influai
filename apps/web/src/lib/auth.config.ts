// Config edge-safe (usada pelo middleware — sem pg/bcrypt aqui).
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true, // atrás do proxy do Vercel (necessário pro OAuth/Google)
  session: { strategy: "jwt" },
  providers: [], // Credentials entra só no auth.ts (runtime node)
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" || // landing page
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot") ||
        pathname.startsWith("/reset") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/termos") ||
        pathname.startsWith("/privacidade") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks") || // webhooks externos (Stripe)
        pathname.startsWith("/api/preview") || // prévia da landing (sem login)
        pathname.startsWith("/api/files"); // assinatura HMAC própria
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.userId = (user as any).id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) (session.user as any).id = token.userId as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
