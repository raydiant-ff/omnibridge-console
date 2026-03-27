import type { NextAuthOptions } from "next-auth";
import { getServerSession as nextAuthGetServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import SlackProvider from "next-auth/providers/slack";
import { compareSync } from "bcryptjs";
import { prisma, type Role } from "@omnibridge/db";

export type { Role } from "@omnibridge/db";

type AuthorizedUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

async function getAuthorizedUserByEmail(email: string): Promise<AuthorizedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, role: true },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
      ? [
          SlackProvider({
            clientId: process.env.SLACK_CLIENT_ID,
            clientSecret: process.env.SLACK_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn("[auth] credentials authorize rejected: missing email or password");
          return null;
        }

        try {
          const normalizedEmail = credentials.email.trim().toLowerCase();
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true, name: true, role: true, passwordHash: true },
          });

          if (!user) {
            console.warn("[auth] credentials authorize rejected: user not found", {
              email: normalizedEmail,
            });
            return null;
          }
          if (!user.passwordHash) {
            console.warn("[auth] credentials authorize rejected: password hash missing", {
              email: normalizedEmail,
              userId: user.id,
            });
            return null;
          }
          const passwordMatched = compareSync(credentials.password, user.passwordHash);
          if (!passwordMatched) {
            console.warn("[auth] credentials authorize rejected: password mismatch", {
              email: normalizedEmail,
              userId: user.id,
            });
            return null;
          }

          console.info("[auth] credentials authorize succeeded", {
            email: normalizedEmail,
            userId: user.id,
            role: user.role,
          });

          return { id: user.id, email: user.email, name: user.name, role: user.role };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "slack") {
        return true;
      }

      const email =
        user.email ??
        (typeof profile?.email === "string" ? profile.email : null);

      if (!email) {
        return false;
      }

      const authorizedUser = await getAuthorizedUserByEmail(email);
      return Boolean(authorizedUser);
    },
    async jwt({ token, user }) {
      if (user) {
        const userEmail = typeof user.email === "string" ? user.email : null;
        const authorizedUser =
          userEmail ? await getAuthorizedUserByEmail(userEmail) : null;

        if (authorizedUser) {
          token.id = authorizedUser.id;
          token.role = authorizedUser.role;
          token.name = authorizedUser.name ?? user.name ?? token.name;
          token.email = authorizedUser.email;
        } else {
          token.id = user.id;
          const directRole = (user as unknown as { role?: Role }).role;
          if (directRole) {
            token.role = directRole;
          }
        }
      } else if (typeof token.email === "string" && (!token.id || !token.role)) {
        const authorizedUser = await getAuthorizedUserByEmail(token.email);
        if (authorizedUser) {
          token.id = authorizedUser.id;
          token.role = authorizedUser.role;
          token.name = authorizedUser.name ?? token.name;
          token.email = authorizedUser.email;
        }
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

function isLocalBrowseMode() {
  return process.env.NODE_ENV === "development" && process.env.OMNI_REQUIRE_AUTH !== "true";
}

async function getLocalBrowseSession() {
  const adminEmail =
    process.env.ADMIN_EMAIL?.trim() ||
    "admin@yourcompany.com";

  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(
      `[auth] Local browse mode requires a real user row for ${adminEmail}. Run the seed or fix ADMIN_EMAIL.`,
    );
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    expires: "2099-12-31T23:59:59.999Z",
  };
}

export async function getClientSessionSeed() {
  if (!isLocalBrowseMode()) {
    return undefined;
  }
  return getLocalBrowseSession();
}

export async function requireSession() {
  if (isLocalBrowseMode()) {
    return getLocalBrowseSession();
  }
  const session = await getServerSession();
  if (!session?.user) {
    // Dynamic import to avoid requiring 'next' as a direct dependency
    const { redirect } = await import("next/navigation");
    return redirect("/login");
  }
  return session;
}
