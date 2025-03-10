// Service: EPGService
// @env:prod
// Description: Serviço para processar e gerenciar dados do EPG (Electronic Program Guide)

// #region Types
interface EPGProgram {
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

interface EPGChannel {
  id: string;
  name: string;
  icon?: string;
  programs: EPGProgram[];
}

interface ParsedEPG {
  channels: EPGChannel[];
  lastUpdate: Date;
}
// #endregion

// #region Constants
const EPG_ERRORS = {
  INVALID_XML: 'Invalid EPG XML format',
  MISSING_CHANNEL: 'Channel information missing',
  INVALID_DATE: 'Invalid date format in program'
} as const;
// #endregion

export class EPGService {
  // #region Private Methods
  private parseDateTime(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(EPG_ERRORS.INVALID_DATE);
    }
    return date;
  }

  private parseProgram(programElement: Element, channelId: string): EPGProgram {
    const startTime = this.parseDateTime(
      programElement.getAttribute('start') || ''
    );
    const endTime = this.parseDateTime(
      programElement.getAttribute('stop') || ''
    );

    const title = programElement.querySelector('title')?.textContent || 'No Title';
    const description = programElement.querySelector('desc')?.textContent;
    const category = programElement.querySelector('category')?.textContent;
    const rating = programElement.querySelector('rating value')?.textContent;
    const poster = programElement.querySelector('icon')?.getAttribute('src');

    return {
      id: `${channelId}-${startTime.getTime()}`,
      channelId,
      title,
      description,
      startTime,
      endTime,
      category,
      rating,
      poster
    };
  }

  private parseChannel(channelElement: Element): EPGChannel {
    const id = channelElement.getAttribute('id');
    if (!id) throw new Error(EPG_ERRORS.MISSING_CHANNEL);

    const name = channelElement.querySelector('display-name')?.textContent || id;
    const icon = channelElement.querySelector('icon')?.getAttribute('src');

    return {
      id,
      name,
      icon,
      programs: []
    };
  }
  // #endregion

  // #region Public Methods
  public parseEPG(xmlDoc: Document): ParsedEPG {
    const channels: EPGChannel[] = [];
    const channelsMap = new Map<string, EPGChannel>();

    // Parse channels
    const channelElements = xmlDoc.querySelectorAll('channel');
    channelElements.forEach(element => {
      const channel = this.parseChannel(element);
      channels.push(channel);
      channelsMap.set(channel.id, channel);
    });

    // Parse programs
    const programElements = xmlDoc.querySelectorAll('programme');
    programElements.forEach(element => {
      const channelId = element.getAttribute('channel');
      if (!channelId) return;

      const channel = channelsMap.get(channelId);
      if (!channel) return;

      try {
        const program = this.parseProgram(element, channelId);
        channel.programs.push(program);
      } catch (error) {
        console.error('Error parsing program:', error);
      }
    });

    // Sort programs by start time
    channels.forEach(channel => {
      channel.programs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    });

    return {
      channels,
      lastUpdate: new Date()
    };
  }

  public getCurrentProgram(channel: EPGChannel): EPGProgram | null {
    const now = new Date();
    return channel.programs.find(program => 
      program.startTime <= now && program.endTime >= now
    ) || null;
  }

  public getUpcomingPrograms(channel: EPGChannel, hours: number = 24): EPGProgram[] {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    return channel.programs.filter(program =>
      program.startTime >= now && program.startTime <= future
    );
  }

  public searchPrograms(channels: EPGChannel[], query: string): EPGProgram[] {
    const lowerQuery = query.toLowerCase();
    const results: EPGProgram[] = [];

    channels.forEach(channel => {
      const matches = channel.programs.filter(program =>
        program.title.toLowerCase().includes(lowerQuery) ||
        program.description?.toLowerCase().includes(lowerQuery)
      );
      results.push(...matches);
    });

    return results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }
  // #endregion
} 