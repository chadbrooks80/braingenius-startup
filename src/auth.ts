import "server-only";
import NextAuth, { type NextAuthOptions } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { getTrialDates } from "@/lib/subscription";
import { OnboardingStep } from "@/generated/prisma";
import { normalizeEmail } from "@/lib/auth/email-normalization";

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
        // Google already validates its own address, but a missing or
        // malformed provider email must never fall back to a raw,
        // non-canonical value reaching the adapter's create/link path --
        // only the shared canonical form may ever reach Prisma, so an
        // invalid provider email fails the sign-in instead of creating or
        // linking an account with a noncanonical identity.
        const canonicalEmail = normalizeEmail(profile.email);
        if (!canonicalEmail) {
          throw new Error("INVALID_GOOGLE_EMAIL");
        }

        return {
          id: profile.sub,
          name: profile.name,
          email: canonicalEmail,
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

        let identityWhere: { email: string } | { username: string };
        if (credentials.username.includes("@")) {
          const canonicalEmail = normalizeEmail(credentials.username);
          if (!canonicalEmail) return null;
          identityWhere = { email: canonicalEmail };
        } else {
          identityWhere = { username: credentials.username };
        }

        const user = await prisma.user.findUnique({ where: identityWhere });

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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;

        // Re-read from the DB rather than trusting `user` directly, so this
        // always reflects the latest onboardingStep/role/reset state
        // regardless of provider.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, onboardingCompleted: true, onboardingStep: true, mustResetPassword: true },
        });
        token.role = dbUser?.role ?? null;
        token.onboardingCompleted = Boolean(dbUser?.onboardingCompleted);
        token.onboardingStep = dbUser?.onboardingStep ?? OnboardingStep.VERIFY_EMAIL;
        token.mustResetPassword = Boolean(dbUser?.mustResetPassword);
      }

      // `session.update()` is a signal to refresh, not a source of truth:
      // onboarding/reset claims a caller places on the `session` payload here
      // are browser-supplied and untrusted, so they are ignored. The token is
      // always re-synced from the signed-in user's current database record --
      // this is what lets a completed required-password-reset take effect
      // without a full sign-out/sign-in.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, onboardingCompleted: true, onboardingStep: true, mustResetPassword: true },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.onboardingStep = dbUser.onboardingStep;
          token.mustResetPassword = dbUser.mustResetPassword;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role ?? null;
        session.user.onboardingCompleted = Boolean(token.onboardingCompleted);
        session.user.onboardingStep = token.onboardingStep ?? OnboardingStep.VERIFY_EMAIL;
        session.user.mustResetPassword = Boolean(token.mustResetPassword);
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
