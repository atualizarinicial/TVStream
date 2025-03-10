// Component: MovieList
// @env:prod
// Description: Componente para listar e reproduzir filmes

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Film, Search, RefreshCw, Play, Info, Loader2 } from 'lucide-react';
import { useIPTV } from '../lib/hooks/useIPTV';
import { StreamType, CategoryType } from '../lib/services/IPTVFetchService';
import { usePlayer } from '../lib/hooks/usePlayer';

export function MovieList() {
  const { t } = useTranslation();
  const { 
    isLoading: isIPTVLoading, 
    error, 
    vodStreams,
    categories, 
    fetchCategories,
    fetchVodStreams,
    getStreamUrl,
    clearCache
  } = useIPTV();
  const player = usePlayer('video-player');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<StreamType | null>(null);
  const [filteredMovies, setFilteredMovies] = useState<StreamType[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoryStreams, setCategoryStreams] = useState<StreamType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar categorias se não estiverem carregadas
  useEffect(() => {
    if (categories.vod.length === 0 && !isIPTVLoading) {
      fetchCategories('movie').catch(err => {
        console.error('Erro ao carregar categorias:', err);
      });
    }
  }, [categories.vod, fetchCategories, isIPTVLoading]);

  // Filtrar filmes quando a busca mudar
  useEffect(() => {
    let filtered = [...categoryStreams];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(movie => 
        movie.name.toLowerCase().includes(query)
      );
    }
    
    setFilteredMovies(filtered);
  }, [categoryStreams, searchQuery]);

  const handleCategorySelect = async (categoryId: string) => {
    try {
      setSelectedCategory(categoryId);
      setIsLoading(true);
      const streams = await fetchVodStreams(categoryId);
      setCategoryStreams(streams);
      setFilteredMovies(streams);
    } catch (err) {
      console.error('Erro ao carregar filmes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMovieSelect = async (movie: StreamType) => {
    setSelectedMovie(movie);
    
    const streamUrl = getStreamUrl(movie);
    if (streamUrl) {
      try {
        await player.reload();
        const videoElement = document.getElementById('video-player') as HTMLVideoElement;
        if (videoElement) {
          await player.loadSource(videoElement, streamUrl);
          await player.play();
        }
      } catch (error) {
        console.error('Erro ao reproduzir filme:', error);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await clearCache();
      await fetchCategories('movie');
      if (selectedCategory) {
        const streams = await fetchVodStreams(selectedCategory);
        setCategoryStreams(streams);
        setFilteredMovies(streams);
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
            <Film className="w-6 h-6" />
            {t('nav.movies')}
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
            
            {isLoading && categories.vod.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <ul className="space-y-1">
                {categories.vod.map((category: CategoryType) => (
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

        {/* Movie List and Player */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Movie List */}
          <div className="md:w-1/3 flex-shrink-0 mb-4 md:mb-0 md:mr-4 overflow-auto">
            <div className="bg-gray-800 rounded-lg p-4 h-full">
              <h2 className="text-lg font-semibold mb-3 text-white">{t('movies.title')}</h2>
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : !selectedCategory ? (
                <div className="text-center text-gray-400 py-4">
                  {t('movies.select_category')}
                </div>
              ) : filteredMovies.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  {t('movies.empty')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredMovies.map((movie) => (
                    <li key={movie.id}>
                      <button
                        onClick={() => handleMovieSelect(movie)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          selectedMovie?.id === movie.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {movie.thumbnail ? (
                          <img 
                            src={movie.thumbnail} 
                            alt={movie.name} 
                            className="w-12 h-16 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/90x120?text=Movie';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-16 bg-gray-700 rounded flex items-center justify-center">
                            <Film className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="truncate">{movie.name}</div>
                          {movie.year && (
                            <div className="text-sm text-gray-400">{movie.year}</div>
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
              {selectedMovie ? (
                <video
                  id="video-player"
                  className="absolute top-0 left-0 w-full h-full bg-black"
                  controls
                  autoPlay
                ></video>
              ) : (
                <div className="absolute top-0 left-0 w-full h-full bg-black flex flex-col items-center justify-center text-gray-400">
                  <Film className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('movies.select_to_watch')}</p>
                </div>
              )}
            </div>

            {/* Movie Info */}
            {selectedMovie && (
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {selectedMovie.cover && (
                    <img 
                      src={selectedMovie.cover} 
                      alt={selectedMovie.name} 
                      className="w-24 h-32 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/180x240?text=Movie';
                      }}
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedMovie.name}</h3>
                    {selectedMovie.year && (
                      <div className="text-gray-400 text-sm mt-1">{selectedMovie.year}</div>
                    )}
                    {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                        <Info className="w-4 h-4" />
                        <span>{selectedMovie.genres.join(', ')}</span>
                      </div>
                    )}
                    {selectedMovie.description && (
                      <p className="text-gray-300 text-sm mt-2">{selectedMovie.description}</p>
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