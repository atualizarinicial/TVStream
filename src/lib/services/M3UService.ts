// Service: M3UService
// @env:prod
// Description: Serviço para processar e gerenciar listas M3U de IPTV

// #region Types
interface M3UItem {
  id: string;
  name: string;
  logo?: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
  tvgId?: string;
  tvgName?: string;
}

interface ParsedM3U {
  channels: M3UItem[];
  movies: M3UItem[];
  series: M3UItem[];
}
// #endregion

// #region Constants
const M3U_PATTERNS = {
  HEADER: /#EXTM3U/,
  INFO: /#EXTINF:-?\d+(.*?),(.+)/,
  GROUP: /group-title="([^"]+)"/,
  LOGO: /tvg-logo="([^"]+)"/,
  TVG_ID: /tvg-id="([^"]+)"/,
  TVG_NAME: /tvg-name="([^"]+)"/
} as const;

const ITEM_TYPES = {
  LIVE: ['live', 'tv', 'canal'],
  MOVIE: ['movie', 'filme', 'vod'],
  SERIES: ['series', 'serie', 'show']
} as const;
// #endregion

export class M3UService {
  // #region Private Methods
  private determineType(group: string): M3UItem['type'] {
    const lowerGroup = group.toLowerCase();
    
    if (ITEM_TYPES.LIVE.some(type => lowerGroup.includes(type))) {
      return 'live';
    }
    if (ITEM_TYPES.MOVIE.some(type => lowerGroup.includes(type))) {
      return 'movie';
    }
    if (ITEM_TYPES.SERIES.some(type => lowerGroup.includes(type))) {
      return 'series';
    }
    
    return 'live'; // Default to live if unknown
  }

  private parseM3ULine(infoLine: string, urlLine: string): M3UItem | null {
    const infoMatch = infoLine.match(M3U_PATTERNS.INFO);
    if (!infoMatch) return null;

    const [, attributes, name] = infoMatch;
    
    const groupMatch = attributes.match(M3U_PATTERNS.GROUP);
    const logoMatch = attributes.match(M3U_PATTERNS.LOGO);
    const tvgIdMatch = attributes.match(M3U_PATTERNS.TVG_ID);
    const tvgNameMatch = attributes.match(M3U_PATTERNS.TVG_NAME);

    const group = groupMatch ? groupMatch[1] : 'Uncategorized';
    const type = this.determineType(group);

    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      logo: logoMatch ? logoMatch[1] : undefined,
      group,
      url: urlLine.trim(),
      type,
      tvgId: tvgIdMatch ? tvgIdMatch[1] : undefined,
      tvgName: tvgNameMatch ? tvgNameMatch[1] : undefined
    };
  }
  // #endregion

  // #region Public Methods
  public parseM3U(content: string): ParsedM3U {
    const lines = content.split('\n');
    const items: M3UItem[] = [];
    
    if (!M3U_PATTERNS.HEADER.test(lines[0])) {
      throw new Error('Invalid M3U file: Missing #EXTM3U header');
    }

    for (let i = 1; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        const urlLine = lines[i + 1];
        const item = this.parseM3ULine(line, urlLine);
        if (item) {
          items.push(item);
        }
        i++; // Skip URL line
      }
    }

    return {
      channels: items.filter(item => item.type === 'live'),
      movies: items.filter(item => item.type === 'movie'),
      series: items.filter(item => item.type === 'series')
    };
  }

  public generateM3U(items: M3UItem[]): string {
    let content = '#EXTM3U\n';
    
    items.forEach(item => {
      const attributes = [
        item.tvgId ? `tvg-id="${item.tvgId}"` : '',
        item.tvgName ? `tvg-name="${item.tvgName}"` : '',
        item.logo ? `tvg-logo="${item.logo}"` : '',
        `group-title="${item.group}"`
      ].filter(Boolean).join(' ');

      content += `#EXTINF:-1 ${attributes},${item.name}\n`;
      content += `${item.url}\n`;
    });

    return content;
  }
  // #endregion
} 