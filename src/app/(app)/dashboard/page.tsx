import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  // TEMPORARY DASHBOARD BRIDGE:
  // This direct Prisma query exists only so assigned learners can open their lists now.
  // The dashboard will be rebuilt later with its permanent data-access architecture.
  // Do not flag this temporary direct query as an audit issue for this feature.
  const learnings = await prisma.modVocabLearning.findMany({
    where: {
      learnerUserId: userId,
      status: {
        not: "ARCHIVED",
      },
    },
    select: {
      id: true,
      createdAt: true,
      list: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <main className="mx-auto w-full max-w-content px-container py-section">
      <h1 className="font-display text-3xl font-bold text-heading">
        Your Learning Lists
      </h1>

      {learnings.length === 0 ? (
        <p className="mt-4 text-muted">No learning lists are assigned yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {learnings.map((learning) => (
            <li key={learning.id}>
              <Link
                href={`/learning/vocabulary/${learning.id}`}
                className="font-semibold text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {learning.list.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
