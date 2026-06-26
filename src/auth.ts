import NextAuth, { type NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { getTrialDates } from "@/lib/subscription";
import { OnboardingStep } from "@/generated/prisma";

const prismaAdapter = PrismaAdapter(prisma);
const createPrismaUser = prismaAdapter.createUser as (
  user: Omit<AdapterUser, "id">
) => Promise<AdapterUser>;
const linkPrismaAccount = prismaAdapter.linkAccount as (
  account: AdapterAccount
) => Promise<AdapterAccount | null | undefined>;

// Accounts created through the adapter only come from OAuth providers
// (credentials sign-up creates the User row directly in registerUser).
// Wrapping `createUser` keeps subscription + funnel setup on the awaited,
// critical-path adapter call instead of the `createUser` *event*, whose
// errors NextAuth swallows silently -- a prior version relying on the event
// left users stuck at the default VERIFY_EMAIL step whenever it failed.
const adapter: Adapter = {
  ...prismaAdapter,
  async createUser(data: Omit<AdapterUser, "id">) {
    const user = await createPrismaUser(data);

    const { trialStartedAt, trialEndsAt } = getTrialDates();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        tier: "FREE_TRIAL",
        trialStartedAt,
        trialEndsAt,
      },
    });

    // Google verifies email ownership up front, so these users skip
    // straight to the welcome video step of the funnel.
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: OnboardingStep.WELCOME_VIDEO },
    });

    return { ...user, onboardingStep: updatedUser.onboardingStep };
  },

  // `linkAccount` runs for every OAuth sign-in, including when Google is
  // linked to a pre-existing credentials account (allowDangerousEmailAccountLinking).
  // That path skips `createUser`, so without this an existing user who never
  // verified their email/password account would stay stuck at VERIFY_EMAIL
  // even though Google just verified the same email address.
  async linkAccount(account: AdapterAccount) {
    const linkedAccount = await linkPrismaAccount(account);

    if (account.provider === "google") {
      const user = await prisma.user.findUnique({ where: { id: account.userId } });

      if (user?.onboardingStep === OnboardingStep.VERIFY_EMAIL) {
        await prisma.user.update({
          where: { id: account.userId },
          data: {
            emailVerified: user.emailVerified ?? new Date(),
            onboardingStep: OnboardingStep.WELCOME_VIDEO,
          },
        });
      }
    }

    return linkedAccount;
  },
};

export const authOptions: NextAuthOptions = {
  adapter,
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
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          // The default Google profile mapping doesn't set this, so it's
          // explicit here: Google already verified the address.
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
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

        if (user.role !== "CHILD" && !user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;

        // Re-read from the DB rather than trusting `user` directly, so this
        // always reflects the latest onboardingStep regardless of provider.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { onboardingCompleted: true, onboardingStep: true },
        });
        token.onboardingCompleted = Boolean(dbUser?.onboardingCompleted);
        token.onboardingStep = dbUser?.onboardingStep ?? OnboardingStep.VERIFY_EMAIL;
      }

      if (trigger === "update") {
        if (session?.onboardingCompleted !== undefined) {
          token.onboardingCompleted = session.onboardingCompleted;
        }
        if (session?.onboardingStep !== undefined) {
          token.onboardingStep = session.onboardingStep;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (
          session.user as { id: string; onboardingCompleted: boolean; onboardingStep: OnboardingStep }
        ).id = token.id as string;
        (
          session.user as { id: string; onboardingCompleted: boolean; onboardingStep: OnboardingStep }
        ).onboardingCompleted = Boolean(token.onboardingCompleted);
        (
          session.user as { id: string; onboardingCompleted: boolean; onboardingStep: OnboardingStep }
        ).onboardingStep = (token.onboardingStep as OnboardingStep) ?? OnboardingStep.VERIFY_EMAIL;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
