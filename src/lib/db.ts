// Model: IPTVDatabase
// @env:prod
// Description: Definição do esquema de banco de dados e interfaces para o IPTV Player
import Dexie, { Table } from 'dexie';

// #region Types
export interface Credentials {
  id?: number;
  server: string;
  username: string;
  password: string;
  lastUpdate: Date;
}

export interface Channel {
  id: string;
  name: string;
  streamUrl: string;
  logo?: string;
  categoryId: string;
  number?: number;
  tvgId?: string;
  tvgName?: string;
  group: string;
  type: 'live' | 'movie' | 'series';
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category?: string;
  rating?: string;
  poster?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'live' | 'movie' | 'series';
  parentId?: string;
}

export interface Favorite {
  id?: number;
  itemId: string;
  itemType: 'channel' | 'movie' | 'series';
  addedAt: Date;
}

export interface WatchHistory {
  id?: number;
  itemId: string;
  itemType: 'channel' | 'movie' | 'series';
  watchedAt: Date;
  position?: number;
  duration?: number;
}

export interface Settings {
  id?: number;
  key: string;
  value: string;
  updatedAt: Date;
}
// #endregion

export class IPTVDatabase extends Dexie {
  credentials!: Table<Credentials>;
  channels!: Table<Channel>;
  epg!: Table<EPGProgram>;
  categories!: Table<Category>;
  favorites!: Table<Favorite>;
  watchHistory!: Table<WatchHistory>;
  settings!: Table<Settings>;

  constructor() {
    super('IPTVDatabase');
    
    this.version(1).stores({
      credentials: '++id, server, username, lastUpdate',
      channels: 'id, name, categoryId, tvgId, type',
      epg: 'id, channelId, startTime, endTime',
      categories: 'id, name, type, parentId',
      favorites: '++id, itemId, itemType, addedAt',
      watchHistory: '++id, itemId, itemType, watchedAt',
      settings: 'key, updatedAt'
    });

    // Índices compostos para melhor performance
    this.channels.hook('creating', (primKey, obj) => {
      obj.id = obj.id || `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return obj;
    });

    this.epg.hook('creating', (primKey, obj) => {
      obj.id = obj.id || `${obj.channelId}-${obj.startTime.getTime()}`;
      return obj;
    });
  }

  // #region Helper Methods
  async getLastUpdate(type: 'channels' | 'epg'): Promise<Date | null> {
    const setting = await this.settings
      .where('key')
      .equals(`lastUpdate_${type}`)
      .first();
    return setting ? new Date(setting.value) : null;
  }

  async setLastUpdate(type: 'channels' | 'epg'): Promise<void> {
    const now = new Date();
    await this.settings.put({
      key: `lastUpdate_${type}`,
      value: now.toISOString(),
      updatedAt: now
    });
  }

  async clearOldData(): Promise<void> {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    
    // Limpar EPG antigo
    await this.epg
      .where('endTime')
      .below(twoDaysAgo)
      .delete();
    
    // Limpar histórico antigo
    await this.watchHistory
      .where('watchedAt')
      .below(twoDaysAgo)
      .delete();
  }

  async addToWatchHistory(
    itemId: string,
    itemType: 'channel' | 'movie' | 'series',
    position?: number,
    duration?: number
  ): Promise<number> {
    const id = await this.watchHistory.add({
      itemId,
      itemType,
      watchedAt: new Date(),
      position,
      duration
    });
    
    return typeof id === 'number' ? id : 0;
  }

  async toggleFavorite(
    itemId: string,
    itemType: 'channel' | 'movie' | 'series'
  ): Promise<boolean> {
    const existing = await this.favorites.where({ itemId, itemType }).first();
    
    if (existing) {
      await this.favorites.delete(existing.id as number);
      return false;
    } else {
      await this.favorites.add({
        itemId,
        itemType,
        addedAt: new Date()
      });
      return true;
    }
  }
  // #endregion
}

export const db = new IPTVDatabase();