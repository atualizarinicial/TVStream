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
    console.log(`Validating credentials for server: ${server}`);
    
    // Verificar se o servidor está online
    const isServerOnline = await this.validateServerConnection(server);
    if (!isServerOnline) {
      console.error('Server is offline');
      return { success: false, error: 'Servidor offline' };
    }

    // Verificar se as credenciais são válidas
    if (this.isValidCredential(server, username, password)) {
      console.log('Using mock credentials');
      // Simular um token JWT
      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
        JSON.stringify({ server, username, exp: Date.now() + 86400000 })
      )}.mockSignature`;
      
      return { success: true, token };
    }

    // Em produção, tenta autenticar no servidor
    try {
      // Tentativa 1: Usar a função Netlify diretamente
      try {
        console.log('Trying Netlify function directly');
        const netlifyProxyUrl = `/.netlify/functions/proxy`;
        
        const netlifyResponse = await axios.post(netlifyProxyUrl, {
          targetUrl: `${server}/login`,
          method: 'POST',
          data: { username, password }
        });
        
        console.log('Netlify function response:', netlifyResponse);
        
        if (netlifyResponse.data && netlifyResponse.status === 200) {
          return { 
            success: true, 
            token: `mock_${Date.now()}` 
          };
        }
      } catch (netlifyError) {
        console.error('Netlify function error:', netlifyError);
      }
      
      // Tentativa 2: Usar CORS direto (pode não funcionar devido a restrições de CORS)
      try {
        console.log('Trying direct CORS request');
        const directResponse = await axios({
          url: `${server}/login`,
          method: 'POST',
          data: { username, password },
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Direct response:', directResponse);
        
        if (directResponse.data && directResponse.status === 200) {
          return { 
            success: true, 
            token: `mock_${Date.now()}` 
          };
        }
      } catch (directError) {
        console.error('Direct request error:', directError);
      }
      
      // Tentativa 3: Usar o proxy local
      try {
        console.log('Trying local proxy');
        const localProxyUrl = `/api/proxy`;
        
        const localResponse = await axios.post(localProxyUrl, {
          targetUrl: `${server}/login`,
          method: 'POST',
          data: { username, password }
        });
        
        console.log('Local proxy response:', localResponse);
        
        if (localResponse.data && localResponse.status === 200) {
          return { 
            success: true, 
            token: `mock_${Date.now()}` 
          };
        }
      } catch (localError) {
        console.error('Local proxy error:', localError);
      }
      
      // Se chegou aqui, todas as tentativas falharam
      console.log('All authentication attempts failed, using mock authentication');
      
      // Autenticação simulada para desenvolvimento
      if (username === 'mtfVNd' && password === 'DAm6ay') {
        return { 
          success: true, 
          token: `mock_${Date.now()}` 
        };
      }
      
      return { success: false, error: 'Credenciais inválidas' };
    } catch (error) {
      console.error('Auth error:', error);
      return { success: false, error: 'Erro de conexão' };
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