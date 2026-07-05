import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getPool } from "@influa/core/db/client";
import { grantCredits } from "@influa/core/credits/ledger";
import { authConfig } from "./auth.config";

const providers: any[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").toLowerCase().trim();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const { rows } = await getPool().query(
        "select id, email, password_hash, display_name from users where email = $1",
        [email]
      );
      const user = rows[0];
      if (!user || !user.password_hash) return null;
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.display_name };
    },
  }),
];

// Google só entra quando as credenciais estão setadas (não quebra sem elas).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true, // liga por email (Google já verifica o email)
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // No login com Google, cria/vincula o usuário no nosso banco e usa o NOSSO id.
    async jwt({ token, user, account }: any) {
      if (account?.provider === "google" && user?.email) {
        const { rows } = await getPool().query(
          `insert into users (email, display_name, email_verified_at, password_hash)
           values ($1, $2, now(), null)
           on conflict (email) do update set display_name = coalesce(users.display_name, excluded.display_name)
           returning id, (xmax = 0) as inserted`,
          [String(user.email).toLowerCase(), user.name ?? user.email]
        );
        token.userId = rows[0].id;
        // usuário NOVO via Google ganha o mesmo bônus de boas-vindas do cadastro por email
        if (rows[0].inserted) {
          const bonus = Number(process.env.SIGNUP_BONUS_CREDITS ?? "300");
          if (bonus > 0) await grantCredits({ userId: rows[0].id, amount: bonus, note: "bônus de boas-vindas" }).catch(() => {});
        }
      } else if (user) {
        token.userId = (user as any).id;
      }
      return token;
    },
  },
});

/** Sessão obrigatória — retorna o userId ou lança (usar em actions/pages do app). */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = (session?.user as any)?.id;
  if (!id) throw new Error("Não autenticado");
  return id;
}
