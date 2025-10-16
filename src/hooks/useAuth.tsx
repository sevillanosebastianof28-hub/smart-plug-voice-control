import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface User {
  email: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('smart-plug-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem('smart-plug-users') || '[]');
    const foundUser = users.find((u: any) => u.email === email && u.password === password);

    if (foundUser) {
      const userData = { email: foundUser.email, id: foundUser.id };
      setUser(userData);
      localStorage.setItem('smart-plug-user', JSON.stringify(userData));
      toast({ title: 'Login successful', description: 'Welcome back!' });
      navigate('/home');
    } else {
      throw new Error('Invalid email or password');
    }
  };

  const signup = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem('smart-plug-users') || '[]');
    
    if (users.find((u: any) => u.email === email)) {
      throw new Error('User already exists');
    }

    const newUser = {
      email,
      password,
      id: Math.random().toString(36).substr(2, 9)
    };

    users.push(newUser);
    localStorage.setItem('smart-plug-users', JSON.stringify(users));

    const userData = { email: newUser.email, id: newUser.id };
    setUser(userData);
    localStorage.setItem('smart-plug-user', JSON.stringify(userData));
    
    toast({ title: 'Account created', description: 'Welcome to Smart Plug Voice!' });
    navigate('/home');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('smart-plug-user');
    toast({ title: 'Logged out', description: 'See you next time!' });
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
