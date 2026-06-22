import prisma from '@/lib/db';
import React from 'react'
import SignInOut from './signInOut';

const UsersPage = async () => {
  
  const users = await prisma.user.findMany();

  return (
    <div>
      {users.map(u => (
        <li key={u.id}>{u.email}</li>
      ))}

      <SignInOut />
    </div>
  )
}

export default UsersPage;
