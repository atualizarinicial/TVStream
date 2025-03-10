// Component: ChannelList
// @env:prod
// Description: Componente para listar e reproduzir canais ao vivo

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tv, Search, RefreshCw, Play, Info, Loader2, Calendar } from 'lucide-react';
import { useIPTV } from '../lib/hooks/useIPTV';
import { StreamType, CategoryType, EPGChannelType } from '../lib/services/IPTVFetchService';
import { usePlayer } from '../lib/hooks/usePlayer';

export function ChannelList() {
  const { t } = useTranslation();
  const { 
    isLoading: isIPTVLoading, 
    error, 
    liveStreams, 
    categories, 
    fetchLiveStreams, 
    fetchCategories,
    getStreamUrl,
    clearCache,
    fetchEPG,
    forceEPGDownload,
    epg
  } = useIPTV();
  const player = usePlayer('video-player');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<StreamType | null>(null);
  const [filteredChannels, setFilteredChannels] = useState<StreamType[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoryStreams, setCategoryStreams] = useState<StreamType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEPG, setIsLoadingEPG] = useState(false);
  const [epgError, setEpgError] = useState<string | null>(null);
  const [currentEPG, setCurrentEPG] = useState<EPGChannelType | null>(null);

  // Carregar categorias se não estiverem carregadas
  useEffect(() => {
    if (categories.live.length === 0 && !isIPTVLoading) {
      fetchCategories('live').catch(err => {
        console.error('Erro ao carregar categorias:', err);
      });
    }
  }, [categories.live, fetchCategories, isIPTVLoading]);

  // Filtrar canais quando a busca mudar
  useEffect(() => {
    let filtered = [...categoryStreams];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(channel => 
        channel.name.toLowerCase().includes(query)
      );
    }
    
    setFilteredChannels(filtered);
  }, [searchQuery, categoryStreams]);

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsLoading(true);
    
    try {
      const streams = await fetchLiveStreams(categoryId);
      setCategoryStreams(streams);
      setFilteredChannels(streams);
    } catch (err) {
      console.error('Erro ao carregar canais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = async (channel: StreamType) => {
    console.log('🔄 Selecionando canal:', channel.name, 'ID:', channel.stream_id || channel.id);
    setSelectedChannel(channel);
    
    // Tenta carregar o EPG para o canal selecionado primeiro
    // para evitar atrasos na exibição da programação
    loadChannelEPG(channel.stream_id || channel.id);
    
    const streamUrl = getStreamUrl(channel);
    if (streamUrl) {
      try {
        await player.reload();
        const videoElement = document.getElementById('video-player') as HTMLVideoElement;
        if (videoElement) {
          await player.loadSource(videoElement, streamUrl);
          await player.play();
        }
      } catch (error) {
        console.error('Erro ao reproduzir canal:', error);
      }
    }
  };

  const loadChannelEPG = async (channelId: string) => {
    setIsLoadingEPG(true);
    setEpgError(null);
    setCurrentEPG(null);
    
    console.log(`🔄 Iniciando carregamento de EPG para canal ID: ${channelId}`);
    
    try {
      // Tratamento especial para o canal A&E
      let epgChannelId = channelId;
      if (selectedChannel && selectedChannel.name && selectedChannel.name.toLowerCase().includes('a&e')) {
        console.log('🔍 Canal A&E detectado, tentando buscar EPG com ID alternativo');
        // Tenta com diferentes formatos de ID para o canal A&E
        const aeIds = ['AE.br', 'br#a-e-hd', 'a-e-hd'];
        
        for (const aeId of aeIds) {
          console.log(`🔍 Tentando buscar EPG para A&E com ID: ${aeId}`);
          const aeEpgData = await fetchEPG(aeId);
          console.log(`🔍 Resultado da busca para A&E com ID ${aeId}:`, aeEpgData);
          
          if (aeEpgData && aeEpgData.length > 0) {
            console.log(`✅ EPG encontrado para A&E com ID ${aeId}:`, aeEpgData[0].name, 'com', aeEpgData[0].programs.length, 'programas');
            
            // Verificar se os programas têm datas válidas
            if (aeEpgData[0].programs.length > 0) {
              const firstProgram = aeEpgData[0].programs[0];
              console.log(`📊 Primeiro programa:`, {
                title: firstProgram.title,
                startTime: firstProgram.startTime,
                endTime: firstProgram.endTime,
                adjustedStartTime: adjustEPGDate(firstProgram.startTime),
                adjustedEndTime: adjustEPGDate(firstProgram.endTime)
              });
            }
            
            setCurrentEPG(aeEpgData[0]);
            setIsLoadingEPG(false);
            
            // Forçar atualização da interface
            setTimeout(() => {
              const currentProgram = getCurrentProgram();
              const nextProgram = getNextProgram();
              console.log('🔄 Após carregar EPG A&E - Programa atual:', currentProgram?.title);
              console.log('🔄 Após carregar EPG A&E - Próximo programa:', nextProgram?.title);
            }, 100);
            
            return;
          } else {
            console.log(`❌ Nenhum EPG encontrado para A&E com ID ${aeId}`);
          }
        }
      }
      
      console.log(`🔍 Buscando EPG para canal ID: ${epgChannelId}`);
      const epgData = await fetchEPG(epgChannelId);
      console.log(`🔍 Resultado da busca para canal ID ${epgChannelId}:`, epgData);
      
      if (epgData && epgData.length > 0) {
        console.log(`✅ EPG encontrado para canal ID ${epgChannelId}:`, epgData[0].name, 'com', epgData[0].programs.length, 'programas');
        
        // Verificar se os programas têm datas válidas
        if (epgData[0].programs.length > 0) {
          const firstProgram = epgData[0].programs[0];
          console.log(`📊 Primeiro programa:`, {
            title: firstProgram.title,
            startTime: firstProgram.startTime,
            endTime: firstProgram.endTime,
            adjustedStartTime: adjustEPGDate(firstProgram.startTime),
            adjustedEndTime: adjustEPGDate(firstProgram.endTime)
          });
        }
        
        setCurrentEPG(epgData[0]);
        
        // Forçar atualização da interface
        setTimeout(() => {
          const currentProgram = getCurrentProgram();
          const nextProgram = getNextProgram();
          console.log('🔄 Após carregar EPG - Programa atual:', currentProgram?.title);
          console.log('🔄 Após carregar EPG - Próximo programa:', nextProgram?.title);
        }, 100);
      } else {
        console.log(`❌ Nenhum EPG encontrado para canal ID ${epgChannelId}`);
        setEpgError('Sem programação disponível');
      }
    } catch (error) {
      console.error('Erro ao carregar EPG:', error);
      setEpgError('Erro ao carregar programação');
    } finally {
      setIsLoadingEPG(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await clearCache();
      await fetchCategories('live');
      if (selectedCategory) {
        const streams = await fetchLiveStreams(selectedCategory);
        setCategoryStreams(streams);
        setFilteredChannels(streams);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadAllEPG = async () => {
    setIsLoadingEPG(true);
    setEpgError(null);
    
    try {
      // Primeiro tenta forçar o download do EPG XML
      const success = await forceEPGDownload();
      
      if (!success) {
        // Se falhar, tenta o método normal
        await fetchEPG();
      }
      
      if (selectedChannel) {
        loadChannelEPG(selectedChannel.stream_id || selectedChannel.id);
      }
    } catch (error) {
      console.error('Erro ao carregar EPG completo:', error);
      setEpgError('Erro ao carregar programação');
    } finally {
      setIsLoadingEPG(false);
    }
  };

  // Ajustar formato de data do EPG
  const adjustEPGDate = (dateStr: string): string => {
    // Verifica se a data está no formato "YYYYMMDDHHMMSS +0000"
    const epgDateRegex = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-]\d{4})$/;
    if (epgDateRegex.test(dateStr)) {
      const matches = dateStr.match(epgDateRegex);
      if (matches) {
        // Converte para o formato ISO "YYYY-MM-DDTHH:MM:SS+00:00"
        const [_, year, month, day, hour, minute, second, timezone] = matches;
        const timezoneHours = timezone.substring(0, 3);
        const timezoneMinutes = timezone.substring(3);
        return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneHours}:${timezoneMinutes}`;
      }
    }
    return dateStr;
  };

  // Formatar data e hora
  const formatDateTime = (dateTimeStr: string) => {
    try {
      console.log('🕒 Formatando data original:', dateTimeStr);
      // Ajusta o formato da data se necessário
      const adjustedDateStr = adjustEPGDate(dateTimeStr);
      console.log('🕒 Data ajustada:', adjustedDateStr);
      
      const date = new Date(adjustedDateStr);
      console.log('🕒 Data convertida:', date.toString());
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error('❌ Erro ao formatar data:', dateTimeStr, e);
      return dateTimeStr;
    }
  };

  // Encontrar programa atual
  const getCurrentProgram = () => {
    if (!currentEPG || currentEPG.programs.length === 0) {
      console.log('❌ Sem EPG atual ou sem programas', currentEPG);
      return null;
    }
    
    console.log('✅ EPG atual:', currentEPG.name, 'com', currentEPG.programs.length, 'programas');
    
    // Log dos primeiros programas para depuração
    if (currentEPG.programs.length > 0) {
      console.log('📊 Primeiros 3 programas:');
      currentEPG.programs.slice(0, 3).forEach((program, index) => {
        const adjustedStartTime = adjustEPGDate(program.startTime);
        const adjustedEndTime = adjustEPGDate(program.endTime);
        console.log(`📺 Programa ${index + 1}:`, {
          title: program.title,
          startTime: program.startTime,
          endTime: program.endTime,
          adjustedStartTime,
          adjustedEndTime,
          startDate: new Date(adjustedStartTime).toString(),
          endDate: new Date(adjustedEndTime).toString()
        });
      });
    }
    
    const now = new Date().getTime();
    console.log('🕒 Data/hora atual:', new Date().toString(), '(timestamp:', now, ')');
    
    const program = currentEPG.programs.find(program => {
      const adjustedStartTime = adjustEPGDate(program.startTime);
      const adjustedEndTime = adjustEPGDate(program.endTime);
      const start = new Date(adjustedStartTime).getTime();
      const end = new Date(adjustedEndTime).getTime();
      
      const isCurrentProgram = now >= start && now < end;
      if (isCurrentProgram) {
        console.log(`✅ Programa atual encontrado: "${program.title}" (${adjustedStartTime} - ${adjustedEndTime})`);
      }
      
      return isCurrentProgram;
    });
    
    if (program) {
      console.log('✅ Programa atual encontrado:', program.title);
    } else {
      console.log('❌ Nenhum programa atual encontrado');
    }
    
    return program;
  };

  // Encontrar próximo programa
  const getNextProgram = () => {
    if (!currentEPG || currentEPG.programs.length === 0) {
      console.log('❌ Sem EPG atual ou sem programas para próximo programa');
      return null;
    }
    
    const now = new Date().getTime();
    
    // Ordenar programas por data de início
    const sortedPrograms = [...currentEPG.programs].sort((a, b) => {
      const startA = new Date(adjustEPGDate(a.startTime)).getTime();
      const startB = new Date(adjustEPGDate(b.startTime)).getTime();
      return startA - startB;
    });
    
    const program = sortedPrograms.find(program => {
      const adjustedStartTime = adjustEPGDate(program.startTime);
      const start = new Date(adjustedStartTime).getTime();
      return start > now;
    });
    
    if (program) {
      console.log('✅ Próximo programa encontrado:', program.title);
    } else {
      console.log('❌ Nenhum próximo programa encontrado');
    }
    
    return program;
  };

  const currentProgram = getCurrentProgram();
  const nextProgram = getNextProgram();

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
              <h3 className="font-semibold text-red-500">Erro ao carregar dados</h3>
              <p className="text-red-400 text-sm mt-1">{error}</p>
              <button 
                onClick={handleRefresh}
                className="mt-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Tentar novamente
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tv className="w-6 h-6" />
            {t('nav.live')}
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

            {/* EPG Button */}
            <button
              onClick={handleLoadAllEPG}
              disabled={isLoadingEPG}
              title="Carregar Guia de Programação"
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              {isLoadingEPG ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </button>

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
            
            {isLoading && categories.live.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <ul className="space-y-1">
                {categories.live.map((category) => (
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

        {/* Channel List and Player */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Channel List */}
          <div className="md:w-1/3 flex-shrink-0 mb-4 md:mb-0 md:mr-4 overflow-auto">
            <div className="bg-gray-800 rounded-lg p-4 h-full">
              <h2 className="text-lg font-semibold mb-3 text-white">{t('channels.title')}</h2>
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : !selectedCategory ? (
                <div className="text-center text-gray-400 py-4">
                  {t('channels.select_category')}
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  {t('channels.empty')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredChannels.map((channel) => (
                    <li key={channel.id}>
                      <button
                        onClick={() => handleChannelSelect(channel)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          selectedChannel?.id === channel.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {channel.thumbnail ? (
                          <img 
                            src={channel.thumbnail} 
                            alt={channel.name} 
                            className="w-8 h-8 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=TV';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                            <Tv className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <span className="truncate">{channel.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Player */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
            {/* Video Player */}
            <div className="relative aspect-video bg-black">
              {selectedChannel ? (
                <video
                  id="video-player"
                  className="w-full h-full"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Tv className="w-16 h-16 mb-4 opacity-30" />
                  <p>{t('channel.select_to_watch')}</p>
                </div>
              )}
            </div>

            {/* Channel Info */}
            {selectedChannel && (
              <div className="p-4 bg-gray-800 border-t border-gray-700">
                <div className="flex items-start gap-4">
                  {selectedChannel.thumbnail && (
                    <img 
                      src={selectedChannel.thumbnail} 
                      alt={selectedChannel.name} 
                      className="w-16 h-16 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=TV';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">{selectedChannel.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => loadChannelEPG(selectedChannel.stream_id || selectedChannel.id)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded flex items-center gap-1"
                      >
                        <Calendar className="w-4 h-4" />
                        Atualizar EPG
                      </button>
                      <button
                        onClick={handleLoadAllEPG}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded flex items-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Recarregar Tudo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EPG Under Player */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
              {isLoadingEPG ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando programação...</span>
                </div>
              ) : epgError ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Info className="w-5 h-5" />
                  <span>{epgError}</span>
                  <button 
                    onClick={handleLoadAllEPG}
                    className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : currentEPG && currentEPG.programs.length > 0 ? (
                <div>
                  {currentProgram ? (
                    <>
                      <div className="flex items-center gap-2 text-white">
                        <Calendar className="w-5 h-5 text-indigo-400" />
                        <span className="font-medium text-lg">{currentProgram.title}</span>
                        <span className="text-gray-400">
                          ({formatDateTime(currentProgram.startTime)} - {formatDateTime(currentProgram.endTime)})
                        </span>
                      </div>
                      {currentProgram.description && (
                        <p className="text-gray-400 mt-2">{currentProgram.description}</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 mb-4">
                      <Info className="w-5 h-5" />
                      <span>Nenhum programa no horário atual</span>
                    </div>
                  )}
                  
                  {nextProgram && (
                    <div className={`${currentProgram ? 'mt-4 pt-4 border-t border-gray-700' : ''}`}>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="font-medium">A seguir:</span>
                        <span className="text-white">{nextProgram.title}</span>
                        <span>
                          ({formatDateTime(nextProgram.startTime)} - {formatDateTime(nextProgram.endTime)})
                        </span>
                      </div>
                      {nextProgram.description && (
                        <p className="text-gray-400 mt-1 text-sm">{nextProgram.description}</p>
                      )}
                    </div>
                  )}

                  {/* EPG Timeline */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">Programação do Dia</h4>
                      <button
                        onClick={handleLoadAllEPG}
                        className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {currentEPG.programs.map((program, index) => (
                        <div 
                          key={index}
                          className={`p-2 rounded ${
                            program === currentProgram 
                              ? 'bg-indigo-600/20 border border-indigo-500/30' 
                              : 'hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-white">{program.title}</span>
                            <span className="text-gray-400">
                              {formatDateTime(program.startTime)} - {formatDateTime(program.endTime)}
                            </span>
                          </div>
                          {program.description && (
                            <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                              {program.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Info className="w-5 h-5" />
                  <span>Sem programação disponível</span>
                  <button 
                    onClick={handleLoadAllEPG}
                    className="ml-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded"
                  >
                    Carregar EPG
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}