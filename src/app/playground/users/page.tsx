import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import SignInOut from './signInOut';

const UsersPage = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in?callbackUrl=%2Fplayground%2Fusers");
  }

  return (
    <div>
      <SignInOut />
    </div>
  )
}

export default UsersPage;
