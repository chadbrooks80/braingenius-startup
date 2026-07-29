import { Prisma } from "@/generated/prisma";

type FakeUser = {
  id: string;
  email: string | null;
  password: string | null;
  role: string | null;
  emailVerified: Date | null;
  onboardingStep: string;
  onboardingCompleted: boolean;
  username: string | null;
  fName: string | null;
  lName: string | null;
  name: string | null;
  mustResetPassword: boolean;
};

type FakeSubscription = {
  id: string;
  userId: string;
  tier: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
};

type FakeAccount = {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};

type FakeVerificationCode = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
};

type FakeParentStudent = {
  parentId: string;
  studentId: string;
  createdAt: Date;
};

type FakePasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

let users: FakeUser[] = [];
let codes: FakeVerificationCode[] = [];
let parentStudents: FakeParentStudent[] = [];
let passwordResetTokens: FakePasswordResetToken[] = [];
let subscriptions: FakeSubscription[] = [];
let accounts: FakeAccount[] = [];
let nextId = 1;
let forceCreateConflict = false;
let forceUnexpectedFailure = false;
export type FakeDbFailurePoint =
  | "oauth-subscription-create"
  | "oauth-onboarding-write"
  | "account-create"
  | "user-update"
  | "user-update-many"
  | "verification-code-create"
  | "password-reset-token-create"
  | "password-reset-token-claim"
  | "password-reset-token-sibling-update";
let nextFailurePoint: FakeDbFailurePoint | null = null;

type VerificationLookupHook = () => void;
let verificationLookupHook: VerificationLookupHook | null = null;

// Per-user async locks that model Postgres `SELECT ... FOR UPDATE`: a
// concurrent transaction that requests the same user's lock waits until the
// holder's transaction commits or rolls back, so a check-then-act sequence
// guarded by the lock cannot race against another request for that user.
const activeLocks = new Map<string, Promise<void>>();

function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function uniqueConstraintError(field: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (\`${field}\`)`,
    { code: "P2002", clientVersion: "test" }
  );
}

export function __resetFakeDb(): void {
  users = [];
  codes = [];
  parentStudents = [];
  passwordResetTokens = [];
  subscriptions = [];
  accounts = [];
  nextId = 1;
  forceCreateConflict = false;
  forceUnexpectedFailure = false;
  nextFailurePoint = null;
  verificationLookupHook = null;
  activeLocks.clear();
}

export function __seedUser(user: Partial<FakeUser> & { email?: string }): FakeUser {
  const record: FakeUser = {
    id: newId("user"),
    email: null,
    password: null,
    role: "PARENT",
    emailVerified: null,
    onboardingStep: "VERIFY_EMAIL",
    onboardingCompleted: false,
    username: null,
    fName: null,
    lName: null,
    name: null,
    mustResetPassword: false,
    ...user,
  };
  users.push(record);
  return record;
}

export function __seedVerificationCode(
  code: Partial<FakeVerificationCode> & { email: string; codeHash: string }
): FakeVerificationCode {
  const record: FakeVerificationCode = {
    id: newId("code"),
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...code,
  };
  codes.push(record);
  return record;
}

export function __seedParentStudent(parentId: string, studentId: string): FakeParentStudent {
  const record: FakeParentStudent = { parentId, studentId, createdAt: new Date() };
  parentStudents.push(record);
  return record;
}

export function __getUsers(): FakeUser[] {
  return users;
}

export function __getVerificationCodes(): FakeVerificationCode[] {
  return codes;
}

export function __getParentStudents(): FakeParentStudent[] {
  return parentStudents;
}

export function __getSubscriptions(): FakeSubscription[] {
  return subscriptions;
}

export function __getAccounts(): FakeAccount[] {
  return accounts;
}

export function __seedPasswordResetToken(
  token: Partial<FakePasswordResetToken> & { userId: string; tokenHash: string }
): FakePasswordResetToken {
  const record: FakePasswordResetToken = {
    id: newId("reset"),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    ...token,
  };
  passwordResetTokens.push(record);
  return record;
}

export function __getPasswordResetTokens(): FakePasswordResetToken[] {
  return passwordResetTokens;
}

// Fires once, immediately after the next `emailVerificationCode.findFirst`
// call resolves its match but before that match is returned to the caller.
// Lets a test deterministically supersede/invalidate the exact row
// `attemptEmailVerification` is about to act on in the real gap between its
// lookup and its conditional claim, instead of relying on Promise.all
// timing that can't reliably land inside a single request's own await chain.
export function __runAfterNextVerificationCodeLookup(hook: VerificationLookupHook): void {
  verificationLookupHook = hook;
}

// Simulates a second concurrent request winning the insert race for the
// same email: the next user.create call rejects with the same
// PrismaClientKnownRequestError shape a real unique-constraint violation
// produces, instead of the fake silently allowing a duplicate.
export function __simulateConcurrentCreateConflict(): void {
  forceCreateConflict = true;
}

// Simulates an unrelated infrastructure failure so callers can prove it
// surfaces as the generic failure contract rather than fake success.
export function __simulateUnexpectedFailure(): void {
  forceUnexpectedFailure = true;
}

export function __failNextDbOperation(point: FakeDbFailurePoint): void {
  nextFailurePoint = point;
}

function failAt(point: FakeDbFailurePoint): void {
  if (nextFailurePoint === point) {
    nextFailurePoint = null;
    throw new Error(`fakeDb: simulated ${point} failure`);
  }
}

type UserWhere = Partial<{
  id: string;
  email: string;
  emailVerified: null;
  username: string;
  role: string | null;
  onboardingStep: string;
  onboardingCompleted: boolean;
  mustResetPassword: boolean;
}>;

function matchesUserWhere(user: FakeUser, where: UserWhere): boolean {
  return (Object.keys(where) as (keyof UserWhere)[]).every((key) => user[key] === where[key]);
}

type VerificationCodeWhere = {
  id?: string;
  email?: string;
  usedAt?: null;
  expiresAt?: { gt: Date };
  attempts?: { lt: number };
};

function matchesVerificationCodeWhere(
  code: FakeVerificationCode,
  where: VerificationCodeWhere
): boolean {
  if (where.id !== undefined && code.id !== where.id) return false;
  if (where.email !== undefined && code.email !== where.email) return false;
  if (where.usedAt !== undefined && code.usedAt !== where.usedAt) return false;
  if (where.expiresAt !== undefined && !(code.expiresAt > where.expiresAt.gt)) return false;
  if (where.attempts !== undefined && !(code.attempts < where.attempts.lt)) return false;
  return true;
}

function findUserByWhere(where: UserWhere): FakeUser | undefined {
  return users.find((user) => matchesUserWhere(user, where));
}

const userMethods = {
  async findUnique({ where }: { where: UserWhere }): Promise<FakeUser | null> {
    if (forceUnexpectedFailure) {
      forceUnexpectedFailure = false;
      throw new Error("fakeDb: simulated unexpected database failure");
    }
    return findUserByWhere(where) ?? null;
  },
  async create({
    data,
  }: {
    data: Partial<FakeUser> & {
      email?: string;
      username?: string;
      subscription?: {
        create: {
          tier: string;
          trialStartedAt: Date;
          trialEndsAt: Date;
        };
      };
    };
  }): Promise<FakeUser> {
    if (forceCreateConflict) {
      forceCreateConflict = false;
      throw uniqueConstraintError(data.email !== undefined ? "email" : "username");
    }
    if (data.email !== undefined && users.some((user) => user.email === data.email)) {
      throw uniqueConstraintError("email");
    }
    if (data.username !== undefined && users.some((user) => user.username === data.username)) {
      throw uniqueConstraintError("username");
    }
    if (data.subscription) {
      failAt("oauth-subscription-create");
    }
    if (data.onboardingStep === "WELCOME_VIDEO" && data.subscription) {
      failAt("oauth-onboarding-write");
    }
    const record: FakeUser = {
      id: newId("user"),
      email: data.email ?? null,
      password: data.password ?? null,
      // prisma/schema.prisma declares `role` as `UserRole?` with no @default,
      // so an omitted role must mirror production's `null` -- defaulting it
      // to PARENT here previously masked src/auth.ts omitting the field.
      role: data.role ?? null,
      emailVerified: data.emailVerified ?? null,
      onboardingStep: data.onboardingStep ?? "VERIFY_EMAIL",
      onboardingCompleted: data.onboardingCompleted ?? false,
      username: data.username ?? null,
      fName: data.fName ?? null,
      lName: data.lName ?? null,
      name: data.name ?? null,
      mustResetPassword: data.mustResetPassword ?? false,
    };
    users.push(record);
    if (data.subscription) {
      subscriptions.push({
        id: newId("subscription"),
        userId: record.id,
        tier: data.subscription.create.tier,
        trialStartedAt: data.subscription.create.trialStartedAt,
        trialEndsAt: data.subscription.create.trialEndsAt,
      });
    }
    return record;
  },
  async update({
    where,
    data,
  }: {
    where: UserWhere;
    data: Partial<FakeUser>;
  }): Promise<FakeUser> {
    failAt("user-update");
    const record = findUserByWhere(where);
    if (!record) {
      throw new Error("fakeDb: user not found for update");
    }
    Object.assign(record, data);
    return record;
  },
  async updateMany({
    where,
    data,
  }: {
    where: UserWhere;
    data: Partial<FakeUser>;
  }): Promise<{ count: number }> {
    failAt("user-update-many");
    if (forceUnexpectedFailure) {
      forceUnexpectedFailure = false;
      throw new Error("fakeDb: simulated unexpected database failure");
    }
    const matches = users.filter((user) => matchesUserWhere(user, where));
    for (const match of matches) {
      Object.assign(match, data);
    }
    return { count: matches.length };
  },
};

const parentStudentMethods = {
  async count({ where }: { where: { parentId: string } }): Promise<number> {
    return parentStudents.filter((row) => row.parentId === where.parentId).length;
  },
  async create({
    data,
  }: {
    data: { parentId: string; studentId: string };
  }): Promise<FakeParentStudent> {
    const record: FakeParentStudent = { ...data, createdAt: new Date() };
    parentStudents.push(record);
    return record;
  },
};

const emailVerificationCodeMethods = {
  async findFirst({
    where,
    orderBy,
  }: {
    where: { email: string; usedAt?: null };
    orderBy?: { createdAt: "asc" | "desc" };
  }): Promise<FakeVerificationCode | null> {
    let matches = codes.filter((code) => code.email === where.email);
    if (where.usedAt === null) {
      matches = matches.filter((code) => code.usedAt === null);
    }
    matches = [...matches].sort((a, b) =>
      orderBy?.createdAt === "asc"
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    );
    const result = matches[0] ?? null;
    if (verificationLookupHook) {
      const hook = verificationLookupHook;
      verificationLookupHook = null;
      hook();
    }
    return result;
  },
  async create({
    data,
  }: {
    data: { email: string; codeHash: string; expiresAt: Date };
  }): Promise<FakeVerificationCode> {
    failAt("verification-code-create");
    const record: FakeVerificationCode = {
      id: newId("code"),
      email: data.email,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
      attempts: 0,
      usedAt: null,
      createdAt: new Date(),
    };
    codes.push(record);
    return record;
  },
  async updateMany({
    where,
    data,
  }: {
    where: {
      id?: string;
      email?: string;
      usedAt?: null;
      expiresAt?: { gt: Date };
      attempts?: { lt: number };
    };
    data: { usedAt?: Date; attempts?: { increment: number } };
  }): Promise<{ count: number }> {
    // Mirrors the real conditional-`updateMany` contract: every provided
    // filter (including `expiresAt`/`attempts` comparisons) is re-evaluated
    // against each row's *current* state, so a row a previous call already
    // consumed, expired past, or exhausted no longer matches.
    const targets = codes.filter((code) => matchesVerificationCodeWhere(code, where));
    for (const target of targets) {
      if (data.usedAt !== undefined) {
        target.usedAt = data.usedAt;
      }
      if (data.attempts?.increment !== undefined) {
        target.attempts += data.attempts.increment;
      }
    }
    return { count: targets.length };
  },
};

const accountMethods = {
  async create({
    data,
  }: {
    data: Omit<FakeAccount, "id">;
  }): Promise<FakeAccount> {
    failAt("account-create");
    if (
      accounts.some(
        (account) =>
          account.provider === data.provider &&
          account.providerAccountId === data.providerAccountId
      )
    ) {
      throw uniqueConstraintError("provider_providerAccountId");
    }
    const record: FakeAccount = { id: newId("account"), ...data };
    accounts.push(record);
    return record;
  },
};

type PasswordResetTokenWhere = {
  id?: string;
  userId?: string;
  tokenHash?: string;
  usedAt?: null;
  expiresAt?: { gt: Date };
};

function matchesPasswordResetTokenWhere(
  token: FakePasswordResetToken,
  where: PasswordResetTokenWhere
): boolean {
  if (where.id !== undefined && token.id !== where.id) return false;
  if (where.userId !== undefined && token.userId !== where.userId) return false;
  if (where.tokenHash !== undefined && token.tokenHash !== where.tokenHash) return false;
  if (where.usedAt !== undefined && token.usedAt !== where.usedAt) return false;
  if (where.expiresAt !== undefined && !(token.expiresAt > where.expiresAt.gt)) return false;
  return true;
}

const passwordResetTokenMethods = {
  async findFirst({
    where,
    orderBy,
  }: {
    where: { userId: string };
    orderBy?: { createdAt: "asc" | "desc" };
  }): Promise<FakePasswordResetToken | null> {
    const matches = [...passwordResetTokens]
      .filter((token) => token.userId === where.userId)
      .sort((a, b) =>
        orderBy?.createdAt === "asc"
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime()
      );
    return matches[0] ?? null;
  },
  async findUnique({
    where,
    include,
  }: {
    where: { tokenHash: string };
    include?: { user?: boolean };
  }): Promise<(FakePasswordResetToken & { user: FakeUser }) | null> {
    const token = passwordResetTokens.find((t) => t.tokenHash === where.tokenHash);
    if (!token) return null;
    if (!include?.user) return token as FakePasswordResetToken & { user: FakeUser };
    const user = users.find((u) => u.id === token.userId);
    if (!user) return null;
    return { ...token, user };
  },
  async create({
    data,
  }: {
    data: { userId: string; tokenHash: string; expiresAt: Date };
  }): Promise<FakePasswordResetToken> {
    failAt("password-reset-token-create");
    if (passwordResetTokens.some((token) => token.tokenHash === data.tokenHash)) {
      throw uniqueConstraintError("tokenHash");
    }
    const record: FakePasswordResetToken = {
      id: newId("reset"),
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    passwordResetTokens.push(record);
    return record;
  },
  async updateMany({
    where,
    data,
  }: {
    where: PasswordResetTokenWhere;
    data: { usedAt: Date };
  }): Promise<{ count: number }> {
    failAt(
      where.tokenHash === undefined
        ? "password-reset-token-sibling-update"
        : "password-reset-token-claim"
    );
    const targets = passwordResetTokens.filter((token) =>
      matchesPasswordResetTokenWhere(token, where)
    );
    for (const target of targets) {
      target.usedAt = data.usedAt;
    }
    return { count: targets.length };
  },
};

type FakeTransactionClient = {
  user: typeof userMethods;
  account: typeof accountMethods;
  parentStudent: typeof parentStudentMethods;
  emailVerificationCode: typeof emailVerificationCodeMethods;
  passwordResetToken: typeof passwordResetTokenMethods;
  __releaseLocks: (() => void)[];
};

// Each transaction gets its own undo log instead of a whole-array
// snapshot/restore: every tx-scoped write records how to revert only the
// exact rows it touched, captured at the moment it touches them. A rollback
// therefore only ever undoes this transaction's own writes -- it can never
// stomp on rows a different, already-committed concurrent transaction wrote
// in the interim, which a start-of-transaction full-array restore would.
// Each underlying write (`create`/`updateMany`) still runs synchronously
// against the one live array, so a losing transaction's re-evaluated `WHERE`
// always sees the winner's already-committed state, the same way a real
// Postgres `UPDATE` re-evaluates its predicate against the current row.
function wrapTxWrites(undoLog: (() => void)[]) {
  const txUser = {
    ...userMethods,
    async create(
      args: Parameters<typeof userMethods.create>[0]
    ): ReturnType<typeof userMethods.create> {
      const record = await userMethods.create(args);
      undoLog.push(() => {
        subscriptions = subscriptions.filter(
          (subscription) => subscription.userId !== record.id
        );
        const index = users.indexOf(record);
        if (index !== -1) users.splice(index, 1);
      });
      return record;
    },
    async update(
      args: Parameters<typeof userMethods.update>[0]
    ): ReturnType<typeof userMethods.update> {
      const record = findUserByWhere(args.where);
      const before = record ? { ...record } : null;
      const result = await userMethods.update(args);
      if (record && before) {
        undoLog.push(() => Object.assign(record, before));
      }
      return result;
    },
    async updateMany(
      args: Parameters<typeof userMethods.updateMany>[0]
    ): ReturnType<typeof userMethods.updateMany> {
      const targets = users.filter((user) => matchesUserWhere(user, args.where));
      const before = targets.map((user) => ({ ...user }));
      const result = await userMethods.updateMany(args);
      targets.forEach((record, index) => {
        const snapshot = before[index];
        undoLog.push(() => Object.assign(record, snapshot));
      });
      return result;
    },
  };

  const txAccount = {
    ...accountMethods,
    async create(
      args: Parameters<typeof accountMethods.create>[0]
    ): ReturnType<typeof accountMethods.create> {
      const record = await accountMethods.create(args);
      undoLog.push(() => {
        const index = accounts.indexOf(record);
        if (index !== -1) accounts.splice(index, 1);
      });
      return record;
    },
  };

  const txParentStudent = {
    ...parentStudentMethods,
    async create(
      args: Parameters<typeof parentStudentMethods.create>[0]
    ): ReturnType<typeof parentStudentMethods.create> {
      const record = await parentStudentMethods.create(args);
      undoLog.push(() => {
        const index = parentStudents.indexOf(record);
        if (index !== -1) parentStudents.splice(index, 1);
      });
      return record;
    },
  };

  const txEmailVerificationCode = {
    ...emailVerificationCodeMethods,
    async create(
      args: Parameters<typeof emailVerificationCodeMethods.create>[0]
    ): ReturnType<typeof emailVerificationCodeMethods.create> {
      const record = await emailVerificationCodeMethods.create(args);
      undoLog.push(() => {
        const index = codes.indexOf(record);
        if (index !== -1) codes.splice(index, 1);
      });
      return record;
    },
    async updateMany(
      args: Parameters<typeof emailVerificationCodeMethods.updateMany>[0]
    ): ReturnType<typeof emailVerificationCodeMethods.updateMany> {
      const targets = codes.filter((code) => matchesVerificationCodeWhere(code, args.where));
      const before = targets.map((code) => ({ ...code }));
      const result = await emailVerificationCodeMethods.updateMany(args);
      targets.forEach((record, index) => {
        const snapshot = before[index];
        undoLog.push(() => Object.assign(record, snapshot));
      });
      return result;
    },
  };

  const txPasswordResetToken = {
    ...passwordResetTokenMethods,
    async create(
      args: Parameters<typeof passwordResetTokenMethods.create>[0]
    ): ReturnType<typeof passwordResetTokenMethods.create> {
      const record = await passwordResetTokenMethods.create(args);
      undoLog.push(() => {
        const index = passwordResetTokens.indexOf(record);
        if (index !== -1) passwordResetTokens.splice(index, 1);
      });
      return record;
    },
    async updateMany(
      args: Parameters<typeof passwordResetTokenMethods.updateMany>[0]
    ): ReturnType<typeof passwordResetTokenMethods.updateMany> {
      const targets = passwordResetTokens.filter((token) =>
        matchesPasswordResetTokenWhere(token, args.where)
      );
      const before = targets.map((token) => ({ ...token }));
      const result = await passwordResetTokenMethods.updateMany(args);
      targets.forEach((record, index) => {
        const snapshot = before[index];
        undoLog.push(() => Object.assign(record, snapshot));
      });
      return result;
    },
  };

  return {
    txUser,
    txAccount,
    txParentStudent,
    txEmailVerificationCode,
    txPasswordResetToken,
  };
}

async function runInteractiveTransaction<T>(
  callback: (tx: FakeTransactionClient) => Promise<T>
): Promise<T> {
  const undoLog: (() => void)[] = [];
  const {
    txUser,
    txAccount,
    txParentStudent,
    txEmailVerificationCode,
    txPasswordResetToken,
  } = wrapTxWrites(undoLog);

  const tx: FakeTransactionClient = {
    user: txUser,
    account: txAccount,
    parentStudent: txParentStudent,
    emailVerificationCode: txEmailVerificationCode,
    passwordResetToken: txPasswordResetToken,
    __releaseLocks: [],
  };

  try {
    return await callback(tx);
  } catch (error) {
    for (let index = undoLog.length - 1; index >= 0; index -= 1) {
      undoLog[index]();
    }
    throw error;
  } finally {
    for (const release of tx.__releaseLocks) {
      release();
    }
  }
}

const fakePrisma = {
  user: userMethods,
  account: accountMethods,
  parentStudent: parentStudentMethods,
  emailVerificationCode: emailVerificationCodeMethods,
  passwordResetToken: passwordResetTokenMethods,
  async $transaction<T>(
    arg: readonly unknown[] | ((tx: FakeTransactionClient) => Promise<T>)
  ): Promise<T> {
    if (typeof arg === "function") {
      return runInteractiveTransaction(arg);
    }
    return Promise.all(arg) as Promise<T>;
  },
};

export default fakePrisma;

// Mirrors the named export from src/lib/db.ts so `@/lib/db` can be aliased
// to this whole module in tests. Models the same row-lock contract real
// `SELECT ... FOR UPDATE` provides: a concurrent transaction requesting a
// lock on the same userId blocks until this transaction's callback settles
// (commit or rollback), so it only takes effect inside an interactive
// `$transaction` callback -- never a global/blanket serialization.
export async function lockUserRow(
  tx: FakeTransactionClient,
  userId: string
): Promise<void> {
  while (activeLocks.has(userId)) {
    await activeLocks.get(userId);
  }
  let release!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  activeLocks.set(userId, lockPromise);
  tx.__releaseLocks.push(() => {
    activeLocks.delete(userId);
    release();
  });
}
