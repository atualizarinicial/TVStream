// Hook: useAuth
// @env:prod
// Description: Hook para gerenciamento de estado de autenticação do usuário

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthService } from '../services/AuthService';

// #region Types
interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  error: string | null;
  isLoading: boolean;
  showEPGPopup: boolean;
  login: (server: string, username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setShowEPGPopup: (show: boolean) => void;
}
// #endregion

const authService = new AuthService();

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      token: null,
      error: null,
      isLoading: false,
      showEPGPopup: false,

      login: async (server: string, username: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await authService.validateCredentials({
            server,
            username,
            password
          });

          if (response.success && response.token) {
            set({ 
              isAuthenticated: true,
              token: response.token,
              error: null,
              showEPGPopup: true
            });
            return true;
          } else {
            set({ 
              isAuthenticated: false,
              token: null,
              error: response.error || 'Erro desconhecido'
            });
            return false;
          }
        } catch (error) {
          set({ 
            isAuthenticated: false,
            token: null,
            error: 'Erro ao fazer login'
          });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await authService.logout();
          set({ 
            isAuthenticated: false,
            token: null,
            error: null
          });
        } catch (error) {
          console.error('Logout error:', error);
        }
      },

      setShowEPGPopup: (show: boolean) => {
        set({ showEPGPopup: show });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        token: state.token
      })
    }
  )
); 