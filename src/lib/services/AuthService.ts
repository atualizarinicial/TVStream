// Service: AuthService
// @env:prod
// Description: Serviço para gerenciar autenticação e validação de credenciais

import axios from 'axios';
import { db } from '../db';

// #region Types
interface AuthResponse {
  success: boolean;
  error?: string;
  token?: string;
}

interface ValidateCredentialsParams {
  server: string;
  username: string;
  password: string;
}
// #endregion

// #region Constants
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  SERVER_ERROR: 'Erro ao conectar ao servidor',
  NETWORK_ERROR: 'Erro de conexão',
  EMPTY_FIELDS: 'Preencha todos os campos'
} as const;

// Lista de credenciais válidas para desenvolvimento
const VALID_CREDENTIALS = [
  { server: 'http://nhflix.xyz', username: 'demo', password: 'demo' },
  { server: 'http://cdn88.xyz', username: 'demo', password: 'demo' },
  { server: 'http://rota66.bar', username: 'demo', password: 'demo' },
  { server: 'http://v220xpco.com', username: 'demo', password: 'demo' },
  { server: 'http://pandatvuhd.tech', username: 'demo', password: 'demo' },
  // Adicionando as credenciais do usuário - aceita qualquer senha para mtfVNd em desenvolvimento
  { server: 'http://nhflix.xyz', username: 'mtfVNd', password: '*' },
  { server: 'http://pandatvuhd.tech', username: 'mtfVNd', password: '*' },
  { server: 'http://cdn88.xyz', username: 'mtfVNd', password: '*' },
  { server: 'http://rota66.bar', username: 'mtfVNd', password: '*' },
  { server: 'http://v220xpco.com', username: 'mtfVNd', password: '*' }
];
// #endregion

export class AuthService {
  // #region Private Methods
  private async validateServerConnection(server: string): Promise<boolean> {
    // Em ambiente de desenvolvimento, sempre retorna true para evitar problemas de CORS
    if (import.meta.env.DEV) {
      return true;
    }
    
    try {
      // Em produção, usa um proxy para evitar problemas de CORS
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(`${server}/status`)}`;
      const response = await axios.get(proxyUrl, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private isValidCredential(server: string, username: string, password: string): boolean {
    // Normaliza a URL do servidor removendo a barra final e player_api.php
    const normalizedServer = server.replace(/\/$/, '').replace(/\/player_api\.php$/, '');
    
    return VALID_CREDENTIALS.some(
      cred => {
        const normalizedCredServer = cred.server.replace(/\/$/, '').replace(/\/player_api\.php$/, '');
        return normalizedCredServer === normalizedServer && 
               cred.username === username && 
               (cred.password === '*' || cred.password === password);
      }
    );
  }
  // #endregion

  // #region Public Methods
  public async validateCredentials({
    server,
    username,
    password
  }: ValidateCredentialsParams): Promise<AuthResponse> {
    try {
      // Validação básica
      if (!server || !username || !password) {
        return { success: false, error: AUTH_ERRORS.EMPTY_FIELDS };
      }

      // Verifica conexão com o servidor
      const isServerAvailable = await this.validateServerConnection(server);
      if (!isServerAvailable) {
        return { success: false, error: AUTH_ERRORS.SERVER_ERROR };
      }

      // Em ambiente de desenvolvimento, usa credenciais mockadas
      if (import.meta.env.DEV) {
        if (this.isValidCredential(server, username, password)) {
          // Salva credenciais no banco local
          await db.credentials.add({
            server,
            username,
            password,
            lastUpdate: new Date()
          });

          return { 
            success: true,
            token: 'mock-token-for-development'
          };
        } else {
          return { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
        }
      }

      // Em produção, tenta autenticar no servidor
      try {
        const isProduction = window.location.hostname !== 'localhost';
        const proxyUrl = isProduction ? `/.netlify/functions/proxy` : `/api/proxy`;
        console.log(`Auth using proxy URL: ${proxyUrl}`);
        
        const response = await axios.post(proxyUrl, {
          targetUrl: `${server}/login`,
          method: 'POST',
          data: { username, password }
        });

        if (response.data?.token) {
          // Salva credenciais no banco local
          await db.credentials.add({
            server,
            username,
            password,
            lastUpdate: new Date()
          });

          return { 
            success: true,
            token: response.data.token
          };
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
        }
        throw error;
      }

      return { success: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
    } catch (error) {
      console.error('Auth error:', error);
      return { success: false, error: AUTH_ERRORS.NETWORK_ERROR };
    }
  }

  public async logout(): Promise<void> {
    await db.credentials.clear();
    await db.settings.where('key').startsWith('cache:').delete();
    
    // Limpa o cache do localStorage
    localStorage.removeItem('auth-storage');
    
    // Recarrega a página para limpar qualquer cache em memória
    window.location.reload();
  }
  // #endregion
} 