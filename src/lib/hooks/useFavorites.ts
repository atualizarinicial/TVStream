// Hook: useFavorites
// @env:prod
// Description: Hook para gerenciar os favoritos do usuário

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

// #region Types
interface FavoriteItem {
  id: string;
  type: 'channel' | 'movie' | 'series';
  name: string;
  logo?: string;
  addedAt: Date;
}

interface UseFavoritesResult {
  favorites: FavoriteItem[];
  isLoading: boolean;
  error: string | null;
  toggleFavorite: (itemId: string, itemType: 'channel' | 'movie' | 'series') => Promise<boolean>;
  isFavorite: (itemId: string) => boolean;
  clearFavorites: () => Promise<void>;
}
// #endregion

export function useFavorites(): UseFavoritesResult {
  // #region State
  const [error, setError] = useState<string | null>(null);
  // #endregion

  // #region Queries
  const favorites = useLiveQuery(async () => {
    try {
      const favoritesData = await db.favorites.toArray();
      const items: FavoriteItem[] = [];

      for (const favorite of favoritesData) {
        let item;
        switch (favorite.itemType) {
          case 'channel':
            item = await db.channels.get(favorite.itemId);
            break;
          case 'movie':
          case 'series':
            // Assumindo que filmes e séries estão na tabela de canais
            item = await db.channels.get(favorite.itemId);
            break;
        }

        if (item) {
          items.push({
            id: item.id,
            type: favorite.itemType,
            name: item.name,
            logo: item.logo,
            addedAt: favorite.addedAt
          });
        }
      }

      return items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
      return [];
    }
  }, []);
  // #endregion

  // #region Callbacks
  const toggleFavorite = useCallback(async (
    itemId: string,
    itemType: 'channel' | 'movie' | 'series'
  ): Promise<boolean> => {
    try {
      setError(null);
      return await db.toggleFavorite(itemId, itemType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
      return false;
    }
  }, []);

  const isFavorite = useCallback((itemId: string): boolean => {
    return favorites?.some(fav => fav.id === itemId) ?? false;
  }, [favorites]);

  const clearFavorites = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await db.favorites.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear favorites');
    }
  }, []);
  // #endregion

  return {
    favorites: favorites ?? [],
    isLoading: favorites === undefined,
    error,
    toggleFavorite,
    isFavorite,
    clearFavorites
  };
} 