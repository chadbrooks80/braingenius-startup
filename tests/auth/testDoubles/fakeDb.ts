import { Prisma } from "@/generated/prisma";

type FakeUser = {
  id: string;
  email: string | null;
  password: string | null;
  role: string;
  emailVerified: Date | null;
  onboardingStep: string;
  onboardingCompleted: boolean;
  username: string | null;
  fName: string | null;
  lName: string | null;
  name: string | null;
  mustResetPassword: boolean;
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

let users: FakeUser[] = [];
let codes: FakeVerificationCode[] = [];
let parentStudents: FakeParentStudent[] = [];
let nextId = 1;
let forceCreateConflict = false;
let forceUnexpectedFailure = false;

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
  nextId = 1;
  forceCreateConflict = false;
  forceUnexpectedFailure = false;
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

type UserWhere = Partial<{
  id: string;
  email: string;
  username: string;
  role: string;
  onboardingStep: string;
  onboardingCompleted: boolean;
}>;

function matchesUserWhere(user: FakeUser, where: UserWhere): boolean {
  return (Object.keys(where) as (keyof UserWhere)[]).every((key) => user[key] === where[key]);
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
    data: Partial<FakeUser> & { email?: string; username?: string };
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
    const record: FakeUser = {
      id: newId("user"),
      email: data.email ?? null,
      password: data.password ?? null,
      role: data.role ?? "PARENT",
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
    return record;
  },
  async update({
    where,
    data,
  }: {
    where: UserWhere;
    data: Partial<FakeUser>;
  }): Promise<FakeUser> {
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
    return matches[0] ?? null;
  },
  async create({
    data,
  }: {
    data: { email: string; codeHash: string; expiresAt: Date };
  }): Promise<FakeVerificationCode> {
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
  async update({
    where,
    data,
  }: {
    where: { id: string };
    data: { attempts?: { increment: number }; usedAt?: Date };
  }): Promise<FakeVerificationCode> {
    const record = codes.find((code) => code.id === where.id);
    if (!record) {
      throw new Error("fakeDb: verification code not found for update");
    }
    if (data.attempts?.increment !== undefined) {
      record.attempts += data.attempts.increment;
    }
    if (data.usedAt !== undefined) {
      record.usedAt = data.usedAt;
    }
    return record;
  },
  async updateMany({
    where,
    data,
  }: {
    where: { email: string; usedAt?: null };
    data: { usedAt: Date };
  }): Promise<{ count: number }> {
    let targets = codes.filter((code) => code.email === where.email);
    if (where.usedAt === null) {
      targets = targets.filter((code) => code.usedAt === null);
    }
    for (const target of targets) {
      target.usedAt = data.usedAt;
    }
    return { count: targets.length };
  },
};

type FakeTransactionClient = {
  user: typeof userMethods;
  parentStudent: typeof parentStudentMethods;
  emailVerificationCode: typeof emailVerificationCodeMethods;
  __releaseLocks: (() => void)[];
};

async function runInteractiveTransaction<T>(
  callback: (tx: FakeTransactionClient) => Promise<T>
): Promise<T> {
  const usersSnapshot = users.map((user) => ({ ...user }));
  const parentStudentsSnapshot = parentStudents.map((row) => ({ ...row }));
  const nextIdSnapshot = nextId;

  const tx: FakeTransactionClient = {
    user: userMethods,
    parentStudent: parentStudentMethods,
    emailVerificationCode: emailVerificationCodeMethods,
    __releaseLocks: [],
  };

  try {
    return await callback(tx);
  } catch (error) {
    users = usersSnapshot;
    parentStudents = parentStudentsSnapshot;
    nextId = nextIdSnapshot;
    throw error;
  } finally {
    for (const release of tx.__releaseLocks) {
      release();
    }
  }
}

const fakePrisma = {
  user: userMethods,
  parentStudent: parentStudentMethods,
  emailVerificationCode: emailVerificationCodeMethods,
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
