// Service: IPTVFetchService
// @env:prod
// Description: Serviço para conexão com listas IPTV com suporte a retry, proxy e cache

import { db } from '../db';
import { ProxyService } from './ProxyService';

// #region Types
export interface IPTVFetchConfig {
  maxRetries: number;
  initialDelay: number;
  cacheTime: number; // em milissegundos
  useProxy: boolean;
  rateLimitDelay: number; // 500ms entre requisições
  maxConcurrentRequests: number; // Máximo de requisições simultâneas
}

export interface StreamType {
  id: string;
  name: string;
  url?: string;
  cover?: string;
  thumbnail?: string;
  containerExtension?: string;
  direct_source?: string;
  stream_id?: string;
  username?: string;
  password?: string;
  description?: string;
  rating?: number;
  year?: string;
  genres?: string[];
  episodeCount?: number;
  episodeRun?: number;
  lastModified?: string;
  status?: string;
  backdropPath?: string;
  duration?: number;
  director?: string;
  actors?: string;
}

export interface CategoryType {
  id: string;
  name: string;
}

export interface EPGProgramType {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  channel?: string;
  category?: string;
  rating?: string;
  language?: string;
  icon?: string;
}

export interface EPGChannelType {
  id: string;
  name: string;
  icon?: string;
  programs: EPGProgramType[];
}

export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export type IPTVProviderType = 'xtream' | 'm3u_url';
// #endregion

// #region Constants
const DEFAULT_CONFIG: IPTVFetchConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 segundo
  cacheTime: 3600000, // 1 hora
  useProxy: true,
  rateLimitDelay: 500, // 500ms entre requisições
  maxConcurrentRequests: 2 // Máximo de requisições simultâneas
};

const CORS_PROXY = 'https://api.allorigins.win/raw';

// Controle de rate limiting
const requestQueue: Array<{
  resolve: () => void;
  promise: Promise<void>;
}> = [];
let activeRequests = 0;
// #endregion

export class IPTVFetchService {
  // #region Properties
  private config: IPTVFetchConfig;
  private proxyService: ProxyService;
  private baseUrl: string;
  private username: string;
  private password: string;
  private type: IPTVProviderType;
  private m3uCache: string | null = null;
  // #endregion

  // #region Constructor
  constructor(
    baseUrl: string,
    username: string,
    password: string,
    type: IPTVProviderType = 'xtream',
    config: Partial<IPTVFetchConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.proxyService = new ProxyService();
    
    // Normaliza a URL base removendo a barra final e player_api.php
    this.baseUrl = baseUrl.replace(/\/$/, '').replace(/\/player_api\.php$/, '');
    
    // Verifica se a URL base é válida
    try {
      new URL(this.baseUrl);
    } catch (error) {
      throw new Error('Invalid server URL provided');
    }
    
    this.username = username;
    this.password = password;
    this.type = type;
  }
  // #endregion

  // #region Private Methods
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
    // Se já atingiu o limite de requisições simultâneas, entra na fila
    if (activeRequests >= this.config.maxConcurrentRequests) {
      let resolve: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      requestQueue.push({ resolve: resolve!, promise });
      await promise;
    }

    activeRequests++;
    try {
      // Aguarda o intervalo mínimo entre requisições
      await this.sleep(this.config.rateLimitDelay);
      return await request();
    } finally {
      activeRequests--;
      // Se há requisições na fila, libera a próxima
      if (requestQueue.length > 0) {
        const next = requestQueue.shift();
        next?.resolve();
      }
    }
  }

  private async fetchWithRetry(url: string, retryCount = 0): Promise<any> {
    return this.enqueueRequest(async () => {
      try {
        console.log(`🔄 Attempt ${retryCount + 1} for URL:`, url);

        const headers: HeadersInit = {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        };

        // Add specific headers for M3U content
        if (url.includes('type=m3u') || url.includes('type=m3u_plus')) {
          headers['Accept'] = 'audio/mpegurl, application/vnd.apple.mpegurl, */*';
        }
        
        // Add specific headers for XML content
        if (url.includes('xmltv.php')) {
          headers['Accept'] = 'application/xml, text/xml, */*';
        }

        // Para o EPG XML, use apenas acesso direto (sem proxy)
        if (url.includes('xmltv.php')) {
          try {
            console.log('🔄 Tentando acesso direto ao EPG XML (sem proxy)');
            const directResponse = await fetch(url, {
              method: 'GET',
              headers,
              mode: 'cors',
              credentials: 'omit'
            });
            
            if (directResponse.ok) {
              return await directResponse.text();
            } else {
              console.error(`❌ Erro ao acessar EPG XML diretamente: ${directResponse.status} ${directResponse.statusText}`);
              return null;
            }
          } catch (directError) {
            console.error('❌ Erro ao acessar EPG XML diretamente:', directError);
            return null;
          }
        }

        // Para outros endpoints (não EPG), tenta primeiro com o proxy CORS
        try {
          const parsedUrl = new URL(url);
          // Decodifica os parâmetros antes de recodificar para evitar dupla codificação
          const decodedUsername = decodeURIComponent(parsedUrl.searchParams.get('username') || '');
          const decodedPassword = decodeURIComponent(parsedUrl.searchParams.get('password') || '');
          const decodedAction = decodeURIComponent(parsedUrl.searchParams.get('action') || '');
          
          let customProxyUrl = `https://corsfook-2y83m1l58-fes-projects-3eaeabe4.vercel.app/xtream?url=${encodeURIComponent(parsedUrl.origin)}&username=${encodeURIComponent(decodedUsername)}&password=${encodeURIComponent(decodedPassword)}&action=${encodeURIComponent(decodedAction)}`;
          
          if (parsedUrl.searchParams.has('category_id')) {
            const decodedCategoryId = decodeURIComponent(parsedUrl.searchParams.get('category_id') || '');
            customProxyUrl += `&category_id=${encodeURIComponent(decodedCategoryId)}`;
          }

          console.log('🔄 Trying custom CORS proxy:', customProxyUrl);
          const proxyResponse = await fetch(customProxyUrl, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit'
          });

          if (proxyResponse.ok) {
            const contentType = proxyResponse.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              return await proxyResponse.json();
            } else {
              const text = await proxyResponse.text();
              
              // Tenta converter para JSON se o conteúdo parecer ser JSON
              try {
                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                  return JSON.parse(text);
                }
                return text;
              } catch {
                return text;
              }
            }
          }
        } catch (proxyError) {
          console.log('Custom CORS proxy failed, trying direct...', proxyError);
        }

        // Se falhou com o proxy personalizado, tenta direto
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit'
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              return await response.json();
            } else {
              const text = await response.text();
              
              // Tenta converter para JSON se o conteúdo parecer ser JSON
              try {
                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                  return JSON.parse(text);
                }
                return text;
              } catch {
                return text;
              }
            }
          }
        } catch (directError) {
          console.log('Direct request failed:', directError);
        }

        // Se ainda não retornou, tenta com o proxy do serviço
        if (this.config.useProxy) {
          try {
            return await this.fetchWithProxy(url);
          } catch (proxyServiceError) {
            console.log('Proxy service failed:', proxyServiceError);
          }
        }

        // Se chegou aqui, todas as tentativas falharam
        // Tenta mais uma vez com retry
        if (retryCount < this.config.maxRetries) {
          console.log(`🔄 Retrying (${retryCount + 1}/${this.config.maxRetries})...`);
          await this.sleep(this.config.initialDelay * Math.pow(2, retryCount));
          return this.fetchWithRetry(url, retryCount + 1);
        }

        throw new Error(`Failed to fetch after ${this.config.maxRetries} retries`);
      } catch (error) {
        console.error('❌ Error in fetchWithRetry:', error);
        throw error;
      }
    });
  }

  private async fetchWithProxy(url: string): Promise<any> {
    try {
      console.log('🔄 Trying proxy fetch for URL:', url);
      
      // Tenta primeiro com o proxy local
      try {
        const proxyResponse = await this.proxyService.fetchWithProxy(url, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
          }
        });
        
        if (proxyResponse.success) {
          return proxyResponse.data;
        }
      } catch (localProxyError) {
        console.log('Local proxy failed, trying CORS proxy...', localProxyError);
      }
      
      // Se falhou com proxy local, tenta com CORS proxy
      const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://cors-anywhere.herokuapp.com/'
      ];

      for (const proxyUrl of corsProxies) {
        try {
          const response = await fetch(`${proxyUrl}${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
          });

          if (response.ok) {
            const text = await response.text();
            try {
              return JSON.parse(text);
            } catch {
              return text;
            }
          }
        } catch (proxyError) {
          console.log(`CORS proxy ${proxyUrl} failed, trying next...`, proxyError);
          continue;
        }
      }

      throw new Error('All proxy attempts failed');
    } catch (error) {
      console.error('❌ Error in proxy fetch:', error);
      throw error;
    }
  }

  private async fetchWithFallback(url: string): Promise<any> {
    try {
      // Primeira tentativa: usar o proxy
      console.log('🔄 Trying with proxy first...');
      
      // Decodifica a URL antes de enviar para o proxy
      const decodedUrl = decodeURIComponent(url);
      
      // Remove caracteres especiais e espaços extras
      const cleanUrl = decodedUrl
        .replace(/\s+/g, '') // Remove espaços extras
        .replace(/[^\w\s\-\.\?\=\&\:\/]/g, ''); // Remove caracteres especiais mantendo alguns necessários
      
      return await this.fetchWithProxy(cleanUrl);
    } catch (error) {
      // Se o proxy falhar, tenta direto
      console.log('Proxy request failed, trying direct URL...');
      return this.fetchWithRetry(url);
    }
  }

  private async getCachedOrFetch<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<T> {
    try {
      // Verifica se temos o item no cache
      const cacheItem = await db.settings.get({ key: `cache:${cacheKey}` });
      
      if (cacheItem) {
        try {
          const cachedData = JSON.parse(cacheItem.value) as CacheItem<T>;
          const now = Date.now();
          
          // Verifica se o cache ainda é válido
          if (now - cachedData.timestamp < this.config.cacheTime) {
            console.log(`Using cached data for ${cacheKey}`);
            return cachedData.data;
          }
        } catch (e) {
          console.error('Error parsing cache:', e);
        }
      }
      
      // Busca novos dados
      console.log(`Fetching fresh data for ${cacheKey}`);
      const freshData = await fetchFn();
      
      // Salva no cache
      await db.settings.put({
        key: `cache:${cacheKey}`,
        value: JSON.stringify({
          data: freshData,
          timestamp: Date.now()
        }),
        updatedAt: new Date()
      });
      
      return freshData;
    } catch (error) {
      console.error('Error in getCachedOrFetch:', error);
      throw error;
    }
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '').replace(/\/player_api\.php$/, '');
  }

  private normalizeChannelName(name: string): string {
    if (!name) return '';
    
    // Converte para minúsculas
    let normalized = name.toLowerCase();
    
    // Remove textos entre colchetes e parênteses
    normalized = normalized.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
    
    // Remove indicadores de qualidade
    normalized = normalized.replace(/\b(hd|sd|fhd|uhd|4k|8k|fullhd|alt|[0-9]+p)\b/g, '');
    
    // Substitui caracteres especiais
    normalized = normalized.replace(/\+/g, 'mais');
    normalized = normalized.replace(/&/g, 'e');
    
    // Remove caracteres especiais e acentos
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remove caracteres não alfanuméricos e substitui por espaço
    normalized = normalized.replace(/[^a-z0-9]/g, ' ');
    
    // Remove espaços extras
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  // Mapeamento de canais conhecidos para seus IDs no EPG
  private getKnownChannelMapping(channelName: string): string | null {
    // Normaliza o nome do canal para busca
    const normalizedName = this.normalizeChannelName(channelName);
    
    // Mapeamento de canais conhecidos
    const knownChannels: Record<string, string> = {
      'gnt': 'GNT',
      'globo': 'Globo',
      'sbt': 'SBT',
      'record': 'Record',
      'band': 'Band',
      'redetv': 'RedeTV',
      'sportv': 'SporTV',
      'espn': 'ESPN',
      'fox sports': 'Fox Sports',
      'discovery': 'Discovery Channel',
      'history': 'History Channel',
      'national geographic': 'National Geographic',
      'warner': 'Warner',
      'universal': 'Universal',
      'sony': 'Sony',
      'fx': 'FX',
      'hbo': 'HBO',
      'telecine': 'Telecine',
      'megapix': 'Megapix',
      'space': 'Space',
      'tnt': 'TNT',
      'cartoon': 'Cartoon Network',
      'disney': 'Disney Channel',
      'nick': 'Nickelodeon',
      'mtv': 'MTV',
      'multishow': 'Multishow',
      'bis': 'BIS',
      'viva': 'Viva',
      'comedy central': 'Comedy Central',
      'ae': 'AE.br',
      'a e': 'AE.br',
      'a&e': 'AE.br',
      'amc': 'AMC',
      'animal planet': 'Animal Planet',
      'axn': 'AXN',
      'cinemax': 'Cinemax',
      'combate': 'Combate',
      'discovery kids': 'Discovery Kids',
      'discovery turbo': 'Discovery Turbo',
      'e entertainment': 'E!',
      'espn brasil': 'ESPN Brasil',
      'food network': 'Food Network',
      'fox': 'Fox',
      'fox life': 'Fox Life',
      'fox premium': 'Fox Premium',
      'futura': 'Futura',
      'globo news': 'GloboNews',
      'gloob': 'Gloob',
      'h2': 'H2',
      'hgtv': 'HGTV',
      'lifetime': 'Lifetime',
      'mais globosat': 'Mais Globosat',
      'max': 'Max',
      'nat geo wild': 'Nat Geo Wild',
      'nick jr': 'Nick Jr.',
      'off': 'OFF',
      'paramount': 'Paramount',
      'premiere': 'Premiere',
      'prime box brazil': 'Prime Box Brazil',
      'record news': 'Record News',
      'rede vida': 'Rede Vida',
      'syfy': 'Syfy',
      'tcm': 'TCM',
      'tlc': 'TLC',
      'tooncast': 'Tooncast',
      'travel box brazil': 'Travel Box Brazil',
      'tv brasil': 'TV Brasil',
      'tv gazeta': 'TV Gazeta',
      'woohoo': 'WooHoo',
      'zoomoo': 'ZooMoo',
      'agromais': 'Agro+'
    };
    
    // Busca por correspondência exata
    if (knownChannels[normalizedName]) {
      return knownChannels[normalizedName];
    }
    
    // Busca por correspondência parcial
    for (const [key, value] of Object.entries(knownChannels)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return value;
      }
    }
    
    return null;
  }

  private findMatchingChannel(channelName: string, channels: EPGChannelType[]): EPGChannelType | undefined {
    if (!channelName || !channels.length) return undefined;
    
    console.log(`🔍 Buscando correspondência para canal: "${channelName}"`);
    
    // Verifica se é um canal conhecido
    const knownChannelId = this.getKnownChannelMapping(channelName);
    if (knownChannelId) {
      console.log(`🔍 Canal conhecido: "${channelName}" -> "${knownChannelId}"`);
      
      // Busca pelo ID conhecido
      const knownChannel = channels.find(c => c.id === knownChannelId);
      if (knownChannel) {
        console.log(`✅ Correspondência por mapeamento conhecido: "${knownChannel.name}"`);
        return knownChannel;
      }
      
      // Busca pelo nome conhecido
      const knownChannelByName = channels.find(c => c.name === knownChannelId);
      if (knownChannelByName) {
        console.log(`✅ Correspondência por nome conhecido: "${knownChannelByName.name}"`);
        return knownChannelByName;
      }
    }
    
    // Normaliza o nome do canal para busca
    const normalizedName = this.normalizeChannelName(channelName);
    console.log(`🔄 Nome normalizado: "${normalizedName}"`);
    
    // 1. Tenta encontrar por correspondência exata de ID
    const exactIdMatch = channels.find(c => c.id === channelName);
    if (exactIdMatch) {
      console.log(`✅ Correspondência exata por ID: "${exactIdMatch.name}"`);
      return exactIdMatch;
    }
    
    // 1.1 Tenta encontrar por variações de ID
    // Alguns canais podem ter IDs como "br#a-e-hd" ou "AE.br"
    const idVariations = [
      channelName,
      `br#${channelName.toLowerCase()}`,
      `br#${channelName.toLowerCase()}-hd`,
      `${channelName}.br`,
      `${this.normalizeChannelName(channelName).replace(/\s+/g, '-')}.br`,
      `br#${this.normalizeChannelName(channelName).replace(/\s+/g, '-')}`
    ];
    
    for (const idVariation of idVariations) {
      const idVariationMatch = channels.find(c => 
        c.id === idVariation || 
        c.id.toLowerCase() === idVariation.toLowerCase()
      );
      
      if (idVariationMatch) {
        console.log(`✅ Correspondência por variação de ID: "${idVariationMatch.name}" (${idVariation})`);
        return idVariationMatch;
      }
    }
    
    // 2. Tenta encontrar por correspondência exata de nome
    const exactNameMatch = channels.find(c => c.name === channelName);
    if (exactNameMatch) {
      console.log(`✅ Correspondência exata por nome: "${exactNameMatch.name}"`);
      return exactNameMatch;
    }
    
    // 3. Tenta encontrar por nome normalizado
    const normalizedMatch = channels.find(c => this.normalizeChannelName(c.name) === normalizedName);
    if (normalizedMatch) {
      console.log(`✅ Correspondência por nome normalizado: "${normalizedMatch.name}"`);
      return normalizedMatch;
    }
    
    // 4. Tenta encontrar por correspondência parcial
    // Primeiro, verifica se o nome normalizado do canal está contido em algum canal do EPG
    const containedInMatch = channels.find(c => 
      this.normalizeChannelName(c.name).includes(normalizedName) || 
      normalizedName.includes(this.normalizeChannelName(c.name))
    );
    
    if (containedInMatch) {
      console.log(`✅ Correspondência parcial: "${containedInMatch.name}" contém ou está contido em "${channelName}"`);
      return containedInMatch;
    }
    
    // 5. Tenta encontrar por palavras-chave
    // Extrai palavras-chave do nome do canal (palavras com mais de 3 caracteres)
    const keywords = normalizedName.split(/\s+/).filter(word => word.length > 3);
    
    if (keywords.length > 0) {
      // Procura canais que contenham pelo menos uma das palavras-chave
      const keywordMatches = channels.filter(c => {
        const normalizedChannelName = this.normalizeChannelName(c.name);
        return keywords.some(keyword => normalizedChannelName.includes(keyword));
      });
      
      if (keywordMatches.length > 0) {
        // Ordena por relevância (número de palavras-chave correspondentes)
        keywordMatches.sort((a, b) => {
          const scoreA = keywords.filter(kw => this.normalizeChannelName(a.name).includes(kw)).length;
          const scoreB = keywords.filter(kw => this.normalizeChannelName(b.name).includes(kw)).length;
          return scoreB - scoreA;
        });
        
        console.log(`✅ Correspondência por palavras-chave: "${keywordMatches[0].name}" (${keywords.join(', ')})`);
        return keywordMatches[0];
      }
    }
    
    console.log(`❌ Nenhuma correspondência encontrada para "${channelName}"`);
    return undefined;
  }

  private async fetchEPGXMLDirect(): Promise<string | null> {
    try {
      const epgUrl = `${this.baseUrl}/xmltv.php?username=${this.username}&password=${this.password}&type=m3u_plus&output=ts`;
      console.log('📡 Iniciando download direto do EPG XML:', epgUrl);
      
      const headers: HeadersInit = {
        'Accept': 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      };
      
      const response = await fetch(epgUrl, {
        method: 'GET',
        headers,
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        console.error(`❌ Erro ao buscar EPG XML diretamente: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const xmlText = await response.text();
      
      if (!xmlText || !xmlText.includes('<?xml')) {
        console.error('❌ Resposta não é um XML válido');
        return null;
      }
      
      const sizeInMB = (xmlText.length / (1024 * 1024)).toFixed(2);
      console.log(`📊 EPG XML recebido diretamente - Tamanho: ${sizeInMB}MB`);
      
      const channelCount = (xmlText.match(/<channel/g) || []).length;
      const programCount = (xmlText.match(/<programme/g) || []).length;
      
      console.log(`📺 Estatísticas do EPG XML:
        - Canais encontrados: ${channelCount}
        - Programas encontrados: ${programCount}
        - Primeiros 200 caracteres: ${xmlText.substring(0, 200)}
      `);
      
      return xmlText;
    } catch (error) {
      console.error('❌ Erro ao buscar EPG XML diretamente:', error);
      return null;
    }
  }

  private async fetchEPGXML(): Promise<string | null> {
    try {
      // Primeiro tenta buscar diretamente
      const directXml = await this.fetchEPGXMLDirect();
      if (directXml) {
        return directXml;
      }
      
      // Se falhar, tenta com o método original
      console.log('⚠️ Falha ao buscar EPG XML diretamente, tentando método alternativo...');
      
      const epgUrl = `${this.baseUrl}/xmltv.php?username=${this.username}&password=${this.password}&type=m3u_plus&output=ts`;
      const response = await this.fetchWithRetry(epgUrl);
      
      if (typeof response === 'string') {
        const sizeInMB = (response.length / (1024 * 1024)).toFixed(2);
        console.log(`📊 EPG XML recebido via método alternativo - Tamanho: ${sizeInMB}MB`);
        
        if (response.includes('<?xml')) {
          const channelCount = (response.match(/<channel/g) || []).length;
          const programCount = (response.match(/<programme/g) || []).length;
          
          console.log(`📺 Estatísticas do EPG XML:
            - Canais encontrados: ${channelCount}
            - Programas encontrados: ${programCount}
            - Primeiros 200 caracteres: ${response.substring(0, 200)}
          `);
          
          return response;
        } else {
          console.error('❌ Resposta não é um XML válido. Resposta recebida:', 
            response.length > 500 ? response.substring(0, 500) + '...' : response
          );
          return null;
        }
      }
      
      console.error('❌ Resposta inválida do EPG:', response);
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar EPG XML:', error);
      return null;
    }
  }

  private parseEPGXML(xmlContent: string): EPGChannelType[] {
    console.log('🔍 Iniciando processamento do EPG XML');
    
    try {
      // Criar um parser XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Verificar se o XML é válido
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        console.error('❌ XML inválido:', xmlDoc.getElementsByTagName('parsererror')[0].textContent);
        return [];
      }
      
      // Extrair canais
      const channelElements = xmlDoc.getElementsByTagName('channel');
      console.log(`📺 Encontrados ${channelElements.length} canais no EPG XML`);
      
      const channels: EPGChannelType[] = [];
      const channelsMap = new Map<string, EPGChannelType>();
      
      // Processar canais
      let processedCount = 0;
      let ignoredCount = 0;
      let noIdCount = 0;
      let emptyIdCount = 0;
      let noNameCount = 0;
      
      for (let i = 0; i < channelElements.length; i++) {
        const channelElement = channelElements[i];
        
        // Extrair ID do canal
        const channelId = channelElement.getAttribute('id');
        
        if (!channelId) {
          noIdCount++;
          continue;
        }
        
        if (channelId === '') {
          emptyIdCount++;
          continue;
        }
        
        // Extrair nome do canal
        const displayNameElement = channelElement.getElementsByTagName('display-name')[0];
        if (!displayNameElement || !displayNameElement.textContent) {
          noNameCount++;
          continue;
        }
        
        const channelName = displayNameElement.textContent.trim();
        
        // Extrair ícone do canal
        let channelIcon = '';
        const iconElement = channelElement.getElementsByTagName('icon')[0];
        if (iconElement && iconElement.getAttribute('src')) {
          channelIcon = iconElement.getAttribute('src') || '';
        }
        
        // Criar objeto de canal
        const channel: EPGChannelType = {
          id: channelId,
          name: channelName,
          icon: channelIcon,
          programs: []
        };
        
        // Adicionar canal à lista e ao mapa
        channels.push(channel);
        channelsMap.set(channelId, channel);
        
        processedCount++;
        
        // Log de progresso a cada 100 canais
        if (processedCount % 100 === 0) {
          console.log(`⏳ Processados ${processedCount} canais...`);
        }
      }
      
      // Adicionar mapeamento especial para o canal A&E
      // Isso garante que o canal A&E seja encontrado mesmo com diferentes IDs
      const aeChannel = channels.find(c => 
        c.id === 'AE.br' || 
        c.name.toLowerCase().includes('a&e') || 
        c.name.toLowerCase().includes('a e')
      );
      
      if (aeChannel) {
        // Adicionar versões alternativas do canal A&E
        const aeAlternativeIds = ['br#a-e-hd', 'a-e-hd'];
        for (const altId of aeAlternativeIds) {
          if (!channelsMap.has(altId)) {
            const altChannel: EPGChannelType = {
              id: altId,
              name: aeChannel.name,
              icon: aeChannel.icon,
              programs: [...aeChannel.programs]
            };
            channels.push(altChannel);
            channelsMap.set(altId, altChannel);
          }
        }
      }
      
      console.log(`📊 Resumo do processamento de canais:
        - Total encontrado: ${channelElements.length}
        - Processados com sucesso: ${processedCount}
        - Ignorados: ${ignoredCount}
        - Sem ID: ${noIdCount}
        - Com ID vazio: ${emptyIdCount}
        - Sem nome: ${noNameCount}
      `);

      // Parse programs
      const programElements = xmlDoc.getElementsByTagName('programme');
      console.log(`📝 Encontrados ${programElements.length} programas no EPG XML`);
      
      let programsAdded = 0;
      let programsSkipped = 0;
      let programsWithoutTitle = 0;
      let programsWithoutTimes = 0;
      let channelsWithoutPrograms = new Set<string>();
      let programsForEmptyIdChannels = 0;

      for (let i = 0; i < programElements.length; i++) {
        const program = programElements[i];
        const channelId = program.getAttribute('channel') || '';
        let channel = channelsMap.get(channelId);
        
        // Se não encontrou pelo ID, tenta pelo nome do canal
        if (!channel && channelId) {
          // Tenta encontrar o canal pelo nome normalizado
          const normalizedChannelId = this.normalizeChannelName(channelId);
          channel = channelsMap.get(normalizedChannelId);
          
          if (channel) {
            console.log(`🔄 Programa associado ao canal "${channel.name}" via nome normalizado`);
          }
        }

        if (channel) {
          const title = program.getElementsByTagName('title')[0]?.textContent || '';
          const desc = program.getElementsByTagName('desc')[0]?.textContent;
          const category = program.getElementsByTagName('category')[0]?.textContent;
          const ratingElement = program.getElementsByTagName('rating')[0];
          const rating = ratingElement?.getElementsByTagName('value')[0]?.textContent;
          const language = program.getElementsByTagName('language')[0]?.textContent;
          const icon = program.getElementsByTagName('icon')[0]?.getAttribute('src');
          
          if (!title) programsWithoutTitle++;
          if (!program.getAttribute('start') || !program.getAttribute('stop')) programsWithoutTimes++;

          if (!title || !program.getAttribute('start') || !program.getAttribute('stop')) {
            console.warn(`⚠️ Programa ignorado para "${channel.name}" - Título: "${title}"`);
            programsSkipped++;
            continue;
          }

          const programData: EPGProgramType = {
            title,
            startTime: program.getAttribute('start') || '',
            endTime: program.getAttribute('stop') || '',
            channel: channel.name
          };

          // Adiciona campos opcionais apenas se existirem
          if (desc) programData.description = desc;
          if (category) programData.category = category;
          if (rating) programData.rating = rating;
          if (language) programData.language = language;
          if (icon) programData.icon = icon;

          channel.programs.push(programData);
          programsAdded++;
          
          // Contabiliza programas para canais com ID vazio
          if (channel.id !== channelId && channelId === '') {
            programsForEmptyIdChannels++;
          }
          
          // Log a cada 1000 programas processados
          if (programsAdded % 1000 === 0) {
            console.log(`⏳ Processados ${programsAdded} programas...`);
          }
        } else {
          channelsWithoutPrograms.add(channelId);
          programsSkipped++;
        }
      }

      console.log(`✅ Resumo final do processamento do EPG:
        - Canais com programação: ${channels.length - channelsWithoutPrograms.size}
        - Canais sem programação: ${channelsWithoutPrograms.size}
        - Programas adicionados: ${programsAdded}
        - Programas para canais com ID vazio: ${programsForEmptyIdChannels}
        - Programas ignorados: ${programsSkipped}
        - Programas sem título: ${programsWithoutTitle}
        - Programas sem horários: ${programsWithoutTimes}
      `);

      if (channelsWithoutPrograms.size > 0 && channelsWithoutPrograms.size < 20) {
        console.warn('⚠️ Canais sem programação:', Array.from(channelsWithoutPrograms));
      } else if (channelsWithoutPrograms.size >= 20) {
        console.warn(`⚠️ ${channelsWithoutPrograms.size} canais sem programação (muitos para listar)`);
      }

      // Ordena os programas por data de início
      channels.forEach(channel => {
        channel.programs.sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
      });

      return channels;
    } catch (error) {
      console.error('❌ Erro ao processar EPG XML:', error);
      return [];
    }
  }
  // #endregion

  // #region Public Methods
  public async getM3UContent(): Promise<string | null> {
    if (this.m3uCache !== null) {
      console.log('Using cached M3U content');
      return this.m3uCache;
    }

    const cacheKey = `m3u:${this.baseUrl}:${this.username}`;
    
    try {
      return await this.getCachedOrFetch<string>(cacheKey, async () => {
        // Try different output formats
        const formats = ['ts', 'm3u_plus', 'm3u'];
        let content: string | null = null;

        for (const format of formats) {
          const m3uUrl = `${this.baseUrl}/get.php?username=${this.username}&password=${this.password}&type=m3u_plus&output=${format}`;
          console.log(`Trying M3U format: ${format}`);
          
          try {
            const response = await this.fetchWithRetry(m3uUrl);
            
            if (typeof response === 'string' && response.trim().startsWith('#EXTM3U')) {
              console.log(`Successfully got M3U content with format: ${format}`);
              content = response;
              break;
            }
          } catch (error) {
            console.error(`Error fetching M3U with format ${format}:`, error);
          }
        }

        if (content) {
          console.log('Caching new M3U content');
          this.m3uCache = content;
          return content;
        }
        
        console.log('No valid M3U content received from any format');
        throw new Error('Failed to fetch M3U content');
      });
    } catch (error) {
      console.error('Error getting M3U content:', error);
      return null;
    }
  }

  public async getLiveStreams(categoryId?: string): Promise<StreamType[]> {
    const cacheKey = `live:${this.baseUrl}:${this.username}:${categoryId || 'all'}`;
    
    return this.getCachedOrFetch<StreamType[]>(cacheKey, async () => {
      if (this.type === 'xtream') {
        const url = categoryId 
          ? `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_live_streams&category_id=${categoryId}`
          : `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_live_streams`;
        
        const response = await this.fetchWithRetry(url);
        return this.mapXtreamToStreamType(response);
      } else {
        // Para tipo m3u_url, precisamos parsear o conteúdo M3U
        const m3uContent = await this.getM3UContent();
        if (!m3uContent) {
          return [];
        }
        
        return this.parseM3UToStreamType(m3uContent, 'live', categoryId);
      }
    });
  }

  public async getVodStreams(categoryId?: string): Promise<StreamType[]> {
    const cacheKey = `vod:${this.baseUrl}:${this.username}:${categoryId || 'all'}`;
    
    return this.getCachedOrFetch<StreamType[]>(cacheKey, async () => {
      if (this.type === 'xtream') {
        const url = categoryId 
          ? `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_vod_streams&category_id=${categoryId}`
          : `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_vod_streams`;
        
        const response = await this.fetchWithRetry(url);
        return this.mapXtreamToStreamType(response);
      } else {
        // Para tipo m3u_url, precisamos parsear o conteúdo M3U
        const m3uContent = await this.getM3UContent();
        if (!m3uContent) {
          return [];
        }
        
        return this.parseM3UToStreamType(m3uContent, 'movie', categoryId);
      }
    });
  }

  public async getSeriesStreams(categoryId?: string): Promise<StreamType[]> {
    const cacheKey = `series:${this.baseUrl}:${this.username}:${categoryId || 'all'}`;
    
    return this.getCachedOrFetch<StreamType[]>(cacheKey, async () => {
      if (this.type === 'xtream') {
        const url = categoryId 
          ? `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_series&category_id=${categoryId}`
          : `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=get_series`;
        
        const response = await this.fetchWithRetry(url);
        return this.mapXtreamToStreamType(response);
      } else {
        // Para tipo m3u_url, precisamos parsear o conteúdo M3U
        const m3uContent = await this.getM3UContent();
        if (!m3uContent) {
          return [];
        }
        
        return this.parseM3UToStreamType(m3uContent, 'series', categoryId);
      }
    });
  }

  public async getCategories(type: 'live' | 'movie' | 'series'): Promise<CategoryType[]> {
    const cacheKey = `categories:${this.baseUrl}:${this.username}:${type}`;
    
    return this.getCachedOrFetch<CategoryType[]>(cacheKey, async () => {
      if (this.type === 'xtream') {
        let action = '';
        switch (type) {
          case 'live':
            action = 'get_live_categories';
            break;
          case 'movie':
            action = 'get_vod_categories';
            break;
          case 'series':
            action = 'get_series_categories';
            break;
        }
        
        const url = `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}&action=${action}`;
        const response = await this.fetchWithRetry(url);
        
        return Array.isArray(response) ? response.map(cat => ({
          id: cat.category_id.toString(),
          name: cat.category_name
        })) : [];
      } else {
        // Para tipo m3u_url, extraímos as categorias do conteúdo M3U
        const m3uContent = await this.getM3UContent();
        if (!m3uContent) {
          return [];
        }
        
        return this.parseM3UCategories(m3uContent, type);
      }
    });
  }

  public async getEPG(channelId?: string): Promise<EPGChannelType[]> {
    const cacheKey = `epg:${this.baseUrl}:${this.username}:${channelId || 'all'}`;
    
    return this.getCachedOrFetch<EPGChannelType[]>(cacheKey, async () => {
      try {
        console.log(`🔍 Buscando EPG ${channelId ? `para o canal ${channelId}` : 'para todos os canais'}`);
        
        // Primeiro tenta buscar o XML EPG do servidor diretamente
        const xmlContent = await this.fetchEPGXMLDirect();
        
        if (xmlContent) {
          console.log('✅ XML EPG obtido com sucesso, iniciando processamento...');
          const epgData = this.parseEPGXML(xmlContent);
          
          // Filtra canais vazios e ordena por nome
          const filteredData = epgData
            .filter(channel => channel.programs.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

          // Log dos canais sem programação
          const emptyChannels = epgData
            .filter(channel => channel.programs.length === 0)
            .map(channel => channel.name);
          
          if (emptyChannels.length > 0) {
            console.warn('⚠️ Canais sem programação:', emptyChannels.length > 20 
              ? `${emptyChannels.length} canais (muitos para listar)` 
              : emptyChannels);
          }
          
          // Se um channelId específico foi fornecido, filtra apenas esse canal
          if (channelId) {
            console.log(`🔍 Buscando canal com ID "${channelId}" no EPG`);
            
            // Estratégia 1: Tenta encontrar por ID exato
            const directMatch = filteredData.filter(channel => channel.id === channelId);
            if (directMatch.length > 0) {
              console.log(`✅ Canal encontrado por ID: "${directMatch[0].name}" com ${directMatch[0].programs.length} programas`);
              return directMatch;
            }
            
            // Estratégia 2: Tenta encontrar pelo nome do canal no stream
            // Primeiro, busca o canal no stream para obter o nome
            try {
              // Tenta obter o stream para pegar o nome do canal
              const streams = await this.getLiveStreams();
              const stream = streams.find(s => s.stream_id === channelId || s.id === channelId);
              
              if (stream) {
                console.log(`🔍 Encontrado stream para o canal ID "${channelId}": "${stream.name}"`);
                
                // Agora busca o canal no EPG pelo nome
                const matchByName = this.findMatchingChannel(stream.name, filteredData);
                if (matchByName) {
                  console.log(`✅ Canal encontrado por nome do stream: "${matchByName.name}" com ${matchByName.programs.length} programas`);
                  return [matchByName];
                }
              } else {
                console.warn(`⚠️ Não foi encontrado stream para o canal ID "${channelId}"`);
              }
            } catch (err) {
              console.warn(`⚠️ Erro ao buscar stream para o canal ID "${channelId}":`, err);
            }
            
            // Estratégia 3: Tenta encontrar por nome normalizado do ID
            console.log(`🔍 Tentando encontrar canal por nome normalizado do ID: "${channelId}"`);
            const matchByNormalizedId = this.findMatchingChannel(channelId, filteredData);
            if (matchByNormalizedId) {
              console.log(`✅ Canal encontrado por nome normalizado: "${matchByNormalizedId.name}" com ${matchByNormalizedId.programs.length} programas`);
              return [matchByNormalizedId];
            }
            
            // Estratégia 4: Busca por correspondência parcial
            // Já implementada no findMatchingChannel
            
            console.warn(`⚠️ Nenhuma programação encontrada para o canal ID "${channelId}"`);
            return [];
          }
          
          return filteredData;
        }
        
        console.error('❌ Não foi possível obter o XML EPG');
        return [];
      } catch (err) {
        console.error('❌ Erro ao buscar EPG:', err);
        return [];
      }
    });
  }

  public clearCache(): Promise<void> {
    return db.transaction('rw', db.settings, async () => {
      const cacheKeys = await db.settings.where('key').startsWith('cache:').keys();
      await db.settings.bulkDelete(cacheKeys);
      this.m3uCache = null;
    });
  }

  /**
   * Força o download do EPG XML e limpa o cache
   * @returns Verdadeiro se o download foi bem-sucedido
   */
  public async forceEPGDownload(): Promise<boolean> {
    console.log('🔄 Forçando download do EPG XML...');
    
    try {
      // Limpar cache de EPG do localStorage
      const epgCacheKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('epg:'));
      
      epgCacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log(`🧹 ${epgCacheKeys.length} itens de cache de EPG removidos`);
      
      // Buscar EPG XML diretamente
      const xmlContent = await this.fetchEPGXMLDirect();
      
      if (!xmlContent) {
        console.error('❌ Falha ao baixar EPG XML diretamente');
        return false;
      }
      
      // Processar EPG XML
      const epgData = this.parseEPGXML(xmlContent);
      
      console.log(`✅ EPG XML baixado e processado com sucesso: ${epgData.length} canais encontrados`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao forçar download de EPG:', error);
      return false;
    }
  }
  // #endregion

  // #region Helper Methods
  private mapXtreamToStreamType(data: any[]): StreamType[] {
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map(item => ({
      id: item.stream_id?.toString() || item.series_id?.toString() || '',
      name: item.name || '',
      url: item.stream_type === 'live' 
        ? `${this.baseUrl}/live/${this.username}/${this.password}/${item.stream_id}.ts`
        : item.stream_type === 'movie'
          ? `${this.baseUrl}/movie/${this.username}/${this.password}/${item.stream_id}.${item.container_extension || 'mp4'}`
          : '',
      cover: item.cover || item.stream_icon || '',
      thumbnail: item.stream_icon || item.cover || '',
      containerExtension: item.container_extension || 'mp4',
      direct_source: item.direct_source || '',
      stream_id: item.stream_id?.toString() || item.series_id?.toString() || '',
      username: this.username,
      password: this.password,
      description: item.plot || item.description || '',
      rating: item.rating || 0,
      year: item.year || '',
      genres: item.genre ? item.genre.split(',').map((g: string) => g.trim()) : [],
      episodeCount: item.episode_count || 0,
      episodeRun: item.episode_run || 0,
      lastModified: item.last_modified || '',
      status: item.status || '',
      backdropPath: item.backdrop_path || '',
      duration: item.duration || 0,
      director: item.director || '',
      actors: item.cast || ''
    }));
  }

  private mapXtreamToEPG(data: any, channelId?: string): EPGChannelType[] {
    if (!data) {
      return [];
    }
    
    if (channelId) {
      // Single channel EPG
      const epgData = data.epg_listings || [];
      return [{
        id: channelId,
        name: data.title || '',
        programs: epgData.map((program: any) => ({
          title: program.title || '',
          description: program.description || '',
          startTime: program.start || '',
          endTime: program.end || ''
        }))
      }];
    } else {
      // Multiple channels EPG
      const channels: EPGChannelType[] = [];
      
      for (const [channelId, programs] of Object.entries(data)) {
        if (Array.isArray(programs)) {
          channels.push({
            id: channelId,
            name: programs[0]?.channel_name || '',
            programs: programs.map((program: any) => ({
              title: program.title || '',
              description: program.description || '',
              startTime: program.start_timestamp || '',
              endTime: program.stop_timestamp || ''
            }))
          });
        }
      }
      
      return channels;
    }
  }

  private parseM3UToStreamType(m3uContent: string, type: 'live' | 'movie' | 'series', categoryId?: string): StreamType[] {
    const streams: StreamType[] = [];
    const lines = m3uContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        // Parse the EXTINF line
        const infoLine = line;
        const urlLine = lines[i + 1]?.trim();
        
        if (!urlLine || urlLine.startsWith('#')) {
          continue;
        }
        
        // Extract stream type from group-title
        const groupMatch = infoLine.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : '';
        
        // Determine stream type based on group or URL
        let streamType: 'live' | 'movie' | 'series' = 'live';
        
        if (group.toLowerCase().includes('movie') || group.toLowerCase().includes('film') || 
            group.toLowerCase().includes('vod') || urlLine.includes('/movie/')) {
          streamType = 'movie';
        } else if (group.toLowerCase().includes('series') || group.toLowerCase().includes('show') || 
                  urlLine.includes('/series/')) {
          streamType = 'series';
        }
        
        // Skip if not the requested type
        if (streamType !== type) {
          continue;
        }
        
        // Filter by category if provided
        if (categoryId && group !== categoryId) {
          continue;
        }
        
        // Extract name
        const nameMatch = infoLine.match(/,([^,]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        
        // Extract tvg-id for stream_id
        const tvgIdMatch = infoLine.match(/tvg-id="([^"]+)"/i);
        const tvgId = tvgIdMatch ? tvgIdMatch[1] : '';
        
        // Extract logo
        const logoMatch = infoLine.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';
        
        streams.push({
          id: tvgId || `m3u_${i}`,
          name,
          url: urlLine,
          cover: logo,
          thumbnail: logo,
          stream_id: tvgId || `m3u_${i}`,
          username: this.username,
          password: this.password,
          description: '',
          genres: [group]
        });
        
        // Skip the URL line
        i++;
      }
    }
    
    return streams;
  }

  private parseM3UCategories(m3uContent: string, type: 'live' | 'movie' | 'series'): CategoryType[] {
    const categories = new Map<string, string>();
    const lines = m3uContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        // Parse the EXTINF line
        const infoLine = line;
        const urlLine = lines[i + 1]?.trim();
        
        if (!urlLine || urlLine.startsWith('#')) {
          continue;
        }
        
        // Extract stream type from group-title
        const groupMatch = infoLine.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : 'Uncategorized';
        
        // Determine stream type based on group or URL
        let streamType: 'live' | 'movie' | 'series' = 'live';
        
        if (group.toLowerCase().includes('movie') || group.toLowerCase().includes('film') || 
            group.toLowerCase().includes('vod') || urlLine.includes('/movie/')) {
          streamType = 'movie';
        } else if (group.toLowerCase().includes('series') || group.toLowerCase().includes('show') || 
                  urlLine.includes('/series/')) {
          streamType = 'series';
        }
        
        // Skip if not the requested type
        if (streamType !== type) {
          continue;
        }
        
        // Add category if not already added
        if (!categories.has(group)) {
          categories.set(group, group);
        }
        
        // Skip the URL line
        i++;
      }
    }
    
    return Array.from(categories.entries()).map(([id, name]) => ({ id, name }));
  }
  // #endregion
} 