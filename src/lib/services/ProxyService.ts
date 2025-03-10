// Service: ProxyService
// @env:prod
// Description: Serviço para gerenciar requisições CORS

import axios, { AxiosRequestConfig } from 'axios';

// #region Types
interface ProxyConfig {
  proxyUrl: string;
  timeout: number;
  retries: number;
}

interface ProxyResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
// #endregion

// #region Constants
const DEFAULT_CONFIG: ProxyConfig = {
  proxyUrl: '/api/proxy',
  timeout: 10000,
  retries: 2
};
// #endregion

export class ProxyService {
  // #region Properties
  private config: ProxyConfig;
  private readonly timeout = 10000; // 10 segundos
  private readonly maxRetries = 2;
  // #endregion

  // #region Constructor
  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  // #endregion

  // #region Public Methods
  public async fetchWithProxy<T>(url: string, config: AxiosRequestConfig = {}): Promise<ProxyResponse<T>> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        const response = await axios({
          ...config,
          url,
          method: 'GET',
          timeout: this.timeout,
          headers: {
            ...config.headers,
            'Accept': 'application/json, text/plain, */*'
          }
        });

        return {
          success: true,
          data: response.data
        };
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        lastError = error as Error;
        
        // Se não for o último retry, espera um pouco antes de tentar novamente
        if (i < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred'
    };
  }

  public async fetchM3U(url: string): Promise<string> {
    const response = await this.fetchWithProxy<string>(url, {
      headers: {
        'Accept': 'text/plain, application/x-mpegurl, */*'
      },
      timeout: 15000 // M3U pode ser maior, damos mais tempo
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erro ao buscar lista M3U');
    }
    
    return response.data || '';
  }

  public async fetchEPG(url: string): Promise<Document> {
    const response = await this.fetchWithProxy<string>(url, {
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      },
      timeout: 20000 // EPG pode ser bem grande, damos ainda mais tempo
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erro ao buscar dados EPG');
    }
    
    const parser = new DOMParser();
    return parser.parseFromString(response.data || '', 'text/xml');
  }
  // #endregion
} 