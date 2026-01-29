
'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  uid: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: 'Agent' | 'Manager' | 'Admin' | null;
}

interface UserContextType {
  user: User;
  setUser: (user: User) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({
    uid: 'user-123', // placeholder
    name: 'Mihai Ionescu', // placeholder
    email: 'mihai.i@exemplu.ro', // placeholder
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026707d', // placeholder
    role: 'Admin', // placeholder
  });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
