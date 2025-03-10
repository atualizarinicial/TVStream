// Hook: useIPTV
// @env:prod
// Description: Hook para gerenciar conexão com serviços IPTV

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { IPTVFetchService, StreamType, CategoryType, EPGChannelType, IPTVProviderType } from '../services/IPTVFetchService';
import { db } from '../db';

// #region Types
interface UseIPTVResult {
  // Estado
  isLoading: boolean;
  error: string | null;
  
  // Dados
  liveStreams: StreamType[];
  vodStreams: StreamType[];
  seriesStreams: StreamType[];
  categories: {
    live: CategoryType[];
    vod: CategoryType[];
    series: CategoryType[];
  };
  epg: EPGChannelType[];
  
  // Ações
  fetchLiveStreams: (categoryId?: string) => Promise<StreamType[]>;
  fetchVodStreams: (categoryId?: string) => Promise<StreamType[]>;
  fetchSeriesStreams: (categoryId?: string) => Promise<StreamType[]>;
  fetchCategories: (type: 'live' | 'movie' | 'series') => Promise<CategoryType[]>;
  fetchEPG: (channelId?: string) => Promise<EPGChannelType[]>;
  forceEPGDownload: () => Promise<boolean>;
  clearCache: () => Promise<void>;
  
  // Utilitários
  getStreamUrl: (stream: StreamType) => string;
}

interface IPTVCredentials {
  server: string;
  username: string;
  password: string;
  type?: IPTVProviderType;
}
// #endregion

export function useIPTV(): UseIPTVResult {
  // #region State
  const { isAuthenticated } = useAuth();
  const [service, setService] = useState<IPTVFetchService | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [liveStreams, setLiveStreams] = useState<StreamType[]>([]);
  const [vodStreams, setVodStreams] = useState<StreamType[]>([]);
  const [seriesStreams, setSeriesStreams] = useState<StreamType[]>([]);
  const [categories, setCategories] = useState<{
    live: CategoryType[];
    vod: CategoryType[];
    series: CategoryType[];
  }>({
    live: [],
    vod: [],
    series: []
  });
  const [epg, setEpg] = useState<EPGChannelType[]>([]);
  // #endregion

  // #region Initialize Service
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    
    const initService = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Buscar credenciais do banco de dados
        let credentials;
        try {
          credentials = await db.credentials.orderBy('lastUpdate').reverse().first();
        } catch (error) {
          console.error('Erro ao acessar o banco de dados:', error);
          
          // Se o erro for relacionado ao esquema, tente limpar o banco e recriar
          const dbError = error as { name: string };
          if (dbError.name === 'SchemaError') {
            console.log('Erro de esquema detectado, tentando recriar o banco...');
            await db.delete();
            location.reload(); // Recarrega a página para recriar o banco
            return;
          }
        }
        
        if (!credentials) {
          setError('Nenhuma credencial encontrada. Por favor, faça login novamente.');
          return;
        }
        
        // Criar serviço
        const newService = new IPTVFetchService(
          credentials.server,
          credentials.username,
          credentials.password,
          'xtream' // Assume Xtream como padrão
        );
        
        setService(newService);
        
        // Carregar dados iniciais
        await Promise.all([
          fetchInitialData(newService)
        ]);
      } catch (err) {
        console.error('Erro ao inicializar serviço IPTV:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };
    
    initService();
  }, [isAuthenticated]);
  // #endregion

  // #region Fetch Methods
  const fetchInitialData = async (iptvService: IPTVFetchService) => {
    try {
      // Carregar categorias primeiro
      const [liveCategories, vodCategories, seriesCategories] = await Promise.all([
        iptvService.getCategories('live'),
        iptvService.getCategories('movie'),
        iptvService.getCategories('series')
      ]);
      
      setCategories({
        live: liveCategories,
        vod: vodCategories,
        series: seriesCategories
      });
      
      // Se tiver categorias, carrega os streams da primeira categoria
      if (liveCategories.length > 0) {
        const streams = await iptvService.getLiveStreams(liveCategories[0].id);
        setLiveStreams(streams);
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados iniciais');
    }
  };

  const fetchLiveStreams = useCallback(async (categoryId?: string): Promise<StreamType[]> => {
    if (!service) {
      return [];
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const streams = await service.getLiveStreams(categoryId);
      setLiveStreams(streams);
      return streams;
    } catch (err) {
      console.error('Erro ao buscar streams ao vivo:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar streams ao vivo');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const fetchVodStreams = useCallback(async (categoryId?: string): Promise<StreamType[]> => {
    if (!service) {
      return [];
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const streams = await service.getVodStreams(categoryId);
      setVodStreams(streams);
      return streams;
    } catch (err) {
      console.error('Erro ao buscar filmes:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar filmes');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const fetchSeriesStreams = useCallback(async (categoryId?: string): Promise<StreamType[]> => {
    if (!service) {
      return [];
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const streams = await service.getSeriesStreams(categoryId);
      setSeriesStreams(streams);
      return streams;
    } catch (err) {
      console.error('Erro ao buscar séries:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar séries');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const fetchCategories = useCallback(async (type: 'live' | 'movie' | 'series'): Promise<CategoryType[]> => {
    if (!service) {
      return [];
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const fetchedCategories = await service.getCategories(type);
      
      setCategories(prev => ({
        ...prev,
        [type === 'movie' ? 'vod' : type]: fetchedCategories
      }));
      
      return fetchedCategories;
    } catch (err) {
      console.error(`Erro ao buscar categorias de ${type}:`, err);
      setError(err instanceof Error ? err.message : `Erro ao buscar categorias de ${type}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const fetchEPG = useCallback(async (channelId?: string): Promise<EPGChannelType[]> => {
    if (!service) {
      return [];
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const epgData = await service.getEPG(channelId);
      setEpg(epgData);
      return epgData;
    } catch (err) {
      console.error('Erro ao buscar EPG:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar EPG');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const forceEPGDownload = useCallback(async (): Promise<boolean> => {
    if (!service) {
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await service.forceEPGDownload();
      return success;
    } catch (err) {
      console.error('Erro ao forçar download de EPG:', err);
      setError(err instanceof Error ? err.message : 'Erro ao forçar download de EPG');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const clearCache = useCallback(async (): Promise<void> => {
    if (!service) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await service.clearCache();
      
      // Recarregar dados
      if (service) {
        await fetchInitialData(service);
      }
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
      setError(err instanceof Error ? err.message : 'Erro ao limpar cache');
    } finally {
      setIsLoading(false);
    }
  }, [service]);
  // #endregion

  // #region Utility Methods
  const getStreamUrl = useCallback((stream: StreamType): string => {
    if (stream.url) {
      return stream.url;
    }
    
    if (!service) {
      return '';
    }
    
    // Construir URL com base no tipo
    if (stream.stream_id) {
      if (stream.genres?.some(g => g.toLowerCase().includes('movie'))) {
        return `${stream.username && stream.password 
          ? `${service['baseUrl']}/movie/${stream.username}/${stream.password}/${stream.stream_id}.${stream.containerExtension || 'mp4'}`
          : ''}`;
      } else {
        return `${stream.username && stream.password 
          ? `${service['baseUrl']}/live/${stream.username}/${stream.password}/${stream.stream_id}.ts`
          : ''}`;
      }
    }
    
    return '';
  }, [service]);
  // #endregion

  return {
    isLoading,
    error,
    liveStreams,
    vodStreams,
    seriesStreams,
    categories,
    epg,
    fetchLiveStreams,
    fetchVodStreams,
    fetchSeriesStreams,
    fetchCategories,
    fetchEPG,
    forceEPGDownload,
    clearCache,
    getStreamUrl
  };
} 