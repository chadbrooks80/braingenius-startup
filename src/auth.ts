import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { getTrialDates } from "@/lib/subscription";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Google verifies email ownership, so it's safe to link to an existing
      // credentials-registered account that shares the same email.
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      credentials: {
        username: { label: "Email or User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const emailOrUsername: "email" | "username" = credentials.username.includes("@")
          ? "email"
          : "username";

        const user = await prisma.user.findUnique({
          where:
            emailOrUsername === "email"
              ? { email: credentials.username }
              : { username: credentials.username },
        });

        if (!user || !user.password) return null;

        const pwdMatches = await bcrypt.compare(credentials.password, user.password);
        if (!pwdMatches) return null;

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingCompleted: user.onboardingCompleted,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.onboardingCompleted = Boolean(
          (user as { onboardingCompleted?: boolean }).onboardingCompleted
        );
      }

      if (trigger === "update" && session?.onboardingCompleted !== undefined) {
        token.onboardingCompleted = session.onboardingCompleted;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; onboardingCompleted: boolean }).id = token.id as string;
        (session.user as { id: string; onboardingCompleted: boolean }).onboardingCompleted =
          Boolean(token.onboardingCompleted);
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      const { trialStartedAt, trialEndsAt } = getTrialDates();
      await prisma.subscription.create({
        data: {
          userId: user.id,
          tier: "FREE_TRIAL",
          trialStartedAt,
          trialEndsAt,
        },
      });
    },
  },
};

export default NextAuth(authOptions);
