// Component: SeriesList
// @env:prod
// Description: Componente para listar e reproduzir séries

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorPlay, Search, RefreshCw, Play, Info, Loader2 } from 'lucide-react';
import { useIPTV } from '../lib/hooks/useIPTV';
import { StreamType, CategoryType } from '../lib/services/IPTVFetchService';
import { usePlayer } from '../lib/hooks/usePlayer';

export function SeriesList() {
  const { t } = useTranslation();
  const { 
    isLoading: isIPTVLoading, 
    error, 
    seriesStreams,
    categories, 
    fetchCategories,
    fetchSeriesStreams,
    getStreamUrl,
    clearCache
  } = useIPTV();
  const player = usePlayer('video-player');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<StreamType | null>(null);
  const [filteredSeries, setFilteredSeries] = useState<StreamType[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoryStreams, setCategoryStreams] = useState<StreamType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar categorias se não estiverem carregadas
  useEffect(() => {
    if (categories.series.length === 0 && !isIPTVLoading) {
      fetchCategories('series').catch(err => {
        console.error('Erro ao carregar categorias:', err);
      });
    }
  }, [categories.series, fetchCategories, isIPTVLoading]);

  // Filtrar séries quando a busca mudar
  useEffect(() => {
    let filtered = [...categoryStreams];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(series => 
        series.name.toLowerCase().includes(query)
      );
    }
    
    setFilteredSeries(filtered);
  }, [categoryStreams, searchQuery]);

  const handleCategorySelect = async (categoryId: string) => {
    try {
      setSelectedCategory(categoryId);
      setIsLoading(true);
      const streams = await fetchSeriesStreams(categoryId);
      setCategoryStreams(streams);
      setFilteredSeries(streams);
    } catch (err) {
      console.error('Erro ao carregar séries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeriesSelect = async (series: StreamType) => {
    setSelectedSeries(series);
    
    const streamUrl = getStreamUrl(series);
    if (streamUrl) {
      try {
        await player.reload();
        const videoElement = document.getElementById('video-player') as HTMLVideoElement;
        if (videoElement) {
          await player.loadSource(videoElement, streamUrl);
          await player.play();
        }
      } catch (error) {
        console.error('Erro ao reproduzir série:', error);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await clearCache();
      await fetchCategories('series');
      if (selectedCategory) {
        const streams = await fetchSeriesStreams(selectedCategory);
        setCategoryStreams(streams);
        setFilteredSeries(streams);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-0">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <div className="text-red-500 p-1 rounded-full bg-red-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-500">{t('error.title')}</h3>
              <p className="text-red-400 text-sm mt-1">{error}</p>
              <button 
                onClick={handleRefresh}
                className="mt-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {t('error.retry')}
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MonitorPlay className="w-6 h-6" />
            {t('nav.series')}
          </h1>

          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full md:w-64 pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              {isRefreshing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 pt-0">
        {/* Categories */}
        <div className="md:w-64 flex-shrink-0 mb-4 md:mb-0 md:mr-4 overflow-auto">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3 text-white">{t('categories.title')}</h2>
            
            {isLoading && categories.series.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <ul className="space-y-1">
                {categories.series.map((category: CategoryType) => (
                  <li key={category.id}>
                    <button
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Series List and Player */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Series List */}
          <div className="md:w-1/3 flex-shrink-0 mb-4 md:mb-0 md:mr-4 overflow-auto">
            <div className="bg-gray-800 rounded-lg p-4 h-full">
              <h2 className="text-lg font-semibold mb-3 text-white">{t('series.title')}</h2>
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : !selectedCategory ? (
                <div className="text-center text-gray-400 py-4">
                  {t('series.select_category')}
                </div>
              ) : filteredSeries.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  {t('series.empty')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredSeries.map((series) => (
                    <li key={series.id}>
                      <button
                        onClick={() => handleSeriesSelect(series)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          selectedSeries?.id === series.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {series.thumbnail ? (
                          <img 
                            src={series.thumbnail} 
                            alt={series.name} 
                            className="w-12 h-16 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/90x120?text=Series';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center">
                            <MonitorPlay className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="truncate">{series.name}</div>
                          {series.year && (
                            <div className="text-sm text-gray-400">{series.year}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Player */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {selectedSeries ? (
                <video
                  id="video-player"
                  className="absolute top-0 left-0 w-full h-full bg-black"
                  controls
                  autoPlay
                ></video>
              ) : (
                <div className="absolute top-0 left-0 w-full h-full bg-black flex flex-col items-center justify-center text-gray-400">
                  <MonitorPlay className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('series.select_to_watch')}</p>
                </div>
              )}
            </div>

            {/* Series Info */}
            {selectedSeries && (
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {selectedSeries.cover && (
                    <img 
                      src={selectedSeries.cover} 
                      alt={selectedSeries.name} 
                      className="w-24 h-32 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/180x240?text=Series';
                      }}
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedSeries.name}</h3>
                    {selectedSeries.year && (
                      <div className="text-gray-400 text-sm mt-1">{selectedSeries.year}</div>
                    )}
                    {selectedSeries.genres && selectedSeries.genres.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                        <Info className="w-4 h-4" />
                        <span>{selectedSeries.genres.join(', ')}</span>
                      </div>
                    )}
                    {selectedSeries.description && (
                      <p className="text-gray-300 text-sm mt-2">{selectedSeries.description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 