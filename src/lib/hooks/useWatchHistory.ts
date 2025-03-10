// Hook: useWatchHistory
// @env:prod
// Description: Hook para gerenciar o histórico de visualização do usuário

import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

// #region Types
interface WatchHistoryItem {
  id: string;
  type: 'channel' | 'movie' | 'series';
  name: string;
  logo?: string;
  watchedAt: Date;
  position?: number;
  duration?: number;
  progress: number;
}

interface UseWatchHistoryResult {
  history: WatchHistoryItem[];
  isLoading: boolean;
  error: string | null;
  addToHistory: (
    itemId: string,
    itemType: 'channel' | 'movie' | 'series',
    position?: number,
    duration?: number
  ) => Promise<void>;
  removeFromHistory: (itemId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  getLastWatched: (itemId: string) => WatchHistoryItem | undefined;
}
// #endregion

export function useWatchHistory(): UseWatchHistoryResult {
  // #region State
  const [error, setError] = useState<string | null>(null);
  // #endregion

  // #region Queries
  const history = useLiveQuery(async () => {
    try {
      const historyData = await db.watchHistory.toArray();
      const items: WatchHistoryItem[] = [];

      for (const entry of historyData) {
        let item;
        switch (entry.itemType) {
          case 'channel':
            item = await db.channels.get(entry.itemId);
            break;
          case 'movie':
          case 'series':
            // Assumindo que filmes e séries estão na tabela de canais
            item = await db.channels.get(entry.itemId);
            break;
        }

        if (item) {
          items.push({
            id: item.id,
            type: entry.itemType,
            name: item.name,
            logo: item.logo,
            watchedAt: entry.watchedAt,
            position: entry.position,
            duration: entry.duration,
            progress: entry.duration ? (entry.position || 0) / entry.duration : 0
          });
        }
      }

      return items.sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watch history');
      return [];
    }
  }, []);
  // #endregion

  // #region Callbacks
  const addToHistory = useCallback(async (
    itemId: string,
    itemType: 'channel' | 'movie' | 'series',
    position?: number,
    duration?: number
  ): Promise<void> => {
    try {
      setError(null);
      await db.addToWatchHistory(itemId, itemType, position, duration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to watch history');
    }
  }, []);

  const removeFromHistory = useCallback(async (itemId: string): Promise<void> => {
    try {
      setError(null);
      await db.watchHistory
        .where('itemId')
        .equals(itemId)
        .delete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove from watch history');
    }
  }, []);

  const clearHistory = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await db.watchHistory.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear watch history');
    }
  }, []);

  const getLastWatched = useCallback((itemId: string): WatchHistoryItem | undefined => {
    return history?.find(item => item.id === itemId);
  }, [history]);
  // #endregion

  // #region Auto Cleanup
  const cleanupOldHistory = useCallback(async (): Promise<void> => {
    try {
      await db.clearOldData();
    } catch (err) {
      console.error('Failed to cleanup old history:', err);
    }
  }, []);
  // #endregion

  return {
    history: history ?? [],
    isLoading: history === undefined,
    error,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getLastWatched
  };
} 