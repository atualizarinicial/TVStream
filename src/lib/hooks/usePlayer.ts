// Hook: usePlayer
// @env:prod
// Description: Hook para gerenciar o estado e controle do player de vídeo

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerService } from '../services/PlayerService';
import { db } from '../db';

// #region Types
interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  quality: string;
  error: string | null;
}

interface UsePlayerResult {
  state: PlayerState;
  play: () => Promise<void>;
  pause: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  seek: (time: number) => void;
  setQuality: (level: number) => void;
  reload: () => Promise<void>;
  loadSource: (videoElement: HTMLVideoElement, source: string) => Promise<void>;
}
// #endregion

// #region Constants
const INITIAL_STATE: PlayerState = {
  isPlaying: false,
  isMuted: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  quality: 'auto',
  error: null
};

const UPDATE_INTERVAL = 1000; // 1 segundo
// #endregion

export function usePlayer(videoElementId: string): UsePlayerResult {
  // #region State
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const playerRef = useRef<PlayerService | null>(null);
  const updateIntervalRef = useRef<number | null>(null);
  // #endregion

  // #region Callbacks
  const updatePlayerState = useCallback(() => {
    if (!playerRef.current) return;

    const stats = playerRef.current.getStats();
    if (!stats) return;

    setState(prev => ({
      ...prev,
      isPlaying: stats.playing,
      currentTime: stats.currentTime,
      duration: stats.duration,
      buffered: stats.buffered,
      volume: stats.volume,
      quality: stats.quality
    }));
  }, []);

  const startUpdateInterval = useCallback(() => {
    if (updateIntervalRef.current) return;

    updateIntervalRef.current = window.setInterval(() => {
      updatePlayerState();
    }, UPDATE_INTERVAL);
  }, [updatePlayerState]);

  const stopUpdateInterval = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error: error.message }));
    stopUpdateInterval();
  }, [stopUpdateInterval]);
  // #endregion

  // #region Player Controls
  const play = useCallback(async () => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      await videoElement.play();
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      startUpdateInterval();
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to play'));
    }
  }, [videoElementId, startUpdateInterval, handleError]);

  const pause = useCallback(() => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      videoElement.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
      stopUpdateInterval();
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to pause'));
    }
  }, [videoElementId, stopUpdateInterval, handleError]);

  const setVolume = useCallback((volume: number) => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      videoElement.volume = Math.max(0, Math.min(1, volume));
      setState(prev => ({ ...prev, volume: videoElement.volume }));
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to set volume'));
    }
  }, [videoElementId, handleError]);

  const setMuted = useCallback((muted: boolean) => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      videoElement.muted = muted;
      setState(prev => ({ ...prev, isMuted: muted }));
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to set muted state'));
    }
  }, [videoElementId, handleError]);

  const seek = useCallback((time: number) => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      videoElement.currentTime = Math.max(0, Math.min(time, videoElement.duration));
      setState(prev => ({ ...prev, currentTime: videoElement.currentTime }));
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to seek'));
    }
  }, [videoElementId, handleError]);

  const setQuality = useCallback((level: number) => {
    try {
      if (!playerRef.current) throw new Error('Player not initialized');
      playerRef.current.setQuality(level);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to set quality'));
    }
  }, [handleError]);

  const reload = useCallback(async () => {
    try {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (!videoElement) throw new Error('Video element not found');

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new PlayerService({
        autoPlay: true,
        muted: state.isMuted,
        controls: true
      });

      const currentTime = state.currentTime;
      await playerRef.current.loadSource(videoElement, videoElement.src);
      
      if (currentTime > 0) {
        seek(currentTime);
      }

      if (state.isPlaying) {
        await play();
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to reload'));
    }
  }, [videoElementId, state.isMuted, state.currentTime, state.isPlaying, play, seek, handleError]);

  const loadSource = useCallback(async (videoElement: HTMLVideoElement, source: string) => {
    try {
      if (!playerRef.current) throw new Error('Player not initialized');
      await playerRef.current.loadSource(videoElement, source);
      setState(prev => ({ ...prev, error: null }));
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to load source'));
    }
  }, [handleError]);
  // #endregion

  // #region Effects
  useEffect(() => {
    return () => {
      stopUpdateInterval();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [stopUpdateInterval]);
  // #endregion

  return {
    state,
    play,
    pause,
    setVolume,
    setMuted,
    seek,
    setQuality,
    reload,
    loadSource
  };
} 