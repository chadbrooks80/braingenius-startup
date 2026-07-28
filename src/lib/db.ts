import { Prisma, PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})


const prismaClientSingleton = () => {
  return new PrismaClient({adapter})
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production')
  globalThis.prismaGlobal = prisma

/**
 * Takes a Postgres row lock on the given user for the lifetime of the
 * enclosing transaction. Concurrent transactions that lock the same user
 * block until this one commits or rolls back, so a check-then-write
 * sequence guarded by this lock (e.g. counting existing children before
 * inserting one more) cannot race against another request for the same
 * user.
 */
export async function lockUserRow(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}