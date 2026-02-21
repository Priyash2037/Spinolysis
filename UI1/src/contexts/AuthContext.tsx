import React, { createContext, useContext, useState, ReactNode } from "react";

type Role = "patient" | "doctor" | null;

interface User {
  name: string;
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  login: (email: string, password: string, role: Role) => void;
  signup: (name: string, email: string, password: string, role: Role) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, _password: string, role: Role) => {
    setUser({ name: role === "doctor" ? "Dr. Smith" : "John Doe", email, role });
  };

  const signup = (name: string, email: string, _password: string, role: Role) => {
    setUser({ name, email, role });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
