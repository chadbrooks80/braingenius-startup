import { Prisma } from "@/generated/prisma";

type FakeUser = {
  id: string;
  email: string;
  password: string | null;
  role: string;
  emailVerified: Date | null;
  onboardingStep: string;
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

let users: FakeUser[] = [];
let codes: FakeVerificationCode[] = [];
let nextId = 1;
let forceCreateConflict = false;
let forceUnexpectedFailure = false;

function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`email`)",
    { code: "P2002", clientVersion: "test" }
  );
}

export function __resetFakeDb(): void {
  users = [];
  codes = [];
  nextId = 1;
  forceCreateConflict = false;
  forceUnexpectedFailure = false;
}

export function __seedUser(user: Partial<FakeUser> & { email: string }): FakeUser {
  const record: FakeUser = {
    id: newId("user"),
    password: null,
    role: "PARENT",
    emailVerified: null,
    onboardingStep: "VERIFY_EMAIL",
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

export function __getUsers(): FakeUser[] {
  return users;
}

export function __getVerificationCodes(): FakeVerificationCode[] {
  return codes;
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

type WhereEmailOrId = { email?: string; id?: string };

const fakePrisma = {
  user: {
    async findUnique({ where }: { where: WhereEmailOrId }): Promise<FakeUser | null> {
      if (forceUnexpectedFailure) {
        forceUnexpectedFailure = false;
        throw new Error("fakeDb: simulated unexpected database failure");
      }
      if (where.email !== undefined) {
        return users.find((user) => user.email === where.email) ?? null;
      }
      if (where.id !== undefined) {
        return users.find((user) => user.id === where.id) ?? null;
      }
      return null;
    },
    async create({
      data,
    }: {
      data: { email: string; password?: string; role?: string };
    }): Promise<FakeUser> {
      if (forceCreateConflict) {
        forceCreateConflict = false;
        throw uniqueConstraintError();
      }
      if (users.some((user) => user.email === data.email)) {
        throw uniqueConstraintError();
      }
      const record: FakeUser = {
        id: newId("user"),
        email: data.email,
        password: data.password ?? null,
        role: data.role ?? "PARENT",
        emailVerified: null,
        onboardingStep: "VERIFY_EMAIL",
      };
      users.push(record);
      return record;
    },
    async update({
      where,
      data,
    }: {
      where: WhereEmailOrId;
      data: Partial<FakeUser>;
    }): Promise<FakeUser> {
      const record = users.find((user) =>
        where.email !== undefined ? user.email === where.email : user.id === where.id
      );
      if (!record) {
        throw new Error("fakeDb: user not found for update");
      }
      Object.assign(record, data);
      return record;
    },
  },
  emailVerificationCode: {
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
  },
  async $transaction<T extends readonly unknown[]>(operations: readonly [...T]): Promise<T> {
    return Promise.all(operations) as Promise<T>;
  },
};

export default fakePrisma;
