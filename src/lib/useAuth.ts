// Hook: useAuth
// @env:prod
// Description: Hook para gerenciamento de estado de autenticação do usuário
import create from 'zustand';
import { db } from './db';

interface AuthState {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
}));