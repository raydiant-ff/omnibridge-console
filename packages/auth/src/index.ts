import type { NextAuthOptions } from "next-auth";
import { getServerSession as nextAuthGetServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { prisma, type Role } from "@omnibridge/db";

export type { Role } from "@omnibridge/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error("[auth] missing email or password");
          return null;
        }

        try {
          console.log("[auth] looking up user:", credentials.email);
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: { id: true, email: true, name: true, role: true, passwordHash: true },
          });

          if (!user) {
            console.error("[auth] user not found:", credentials.email);
            return null;
          }
          if (!user.passwordHash) {
            console.error("[auth] user has no password hash:", credentials.email);
            return null;
          }
          if (!compareSync(credentials.password, user.passwordHash)) {
            console.error("[auth] password mismatch for:", credentials.email);
            return null;
          }

          console.log("[auth] login success:", credentials.email);
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as Role,
        },
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session?.user) {
    // Dynamic import to avoid requiring 'next' as a direct dependency
    const { redirect } = await import("next/navigation");
    return redirect("/login");
  }
  return session;
}
