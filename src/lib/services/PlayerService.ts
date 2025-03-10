// Service: PlayerService
// @env:prod
// Description: Serviço para gerenciar a reprodução de vídeo usando HLS.js

import Hls from 'hls.js';

// #region Types
interface PlayerConfig {
  autoPlay: boolean;
  muted: boolean;
  controls: boolean;
  errorRetryCount: number;
  errorRetryDelay: number;
}

interface PlayerStats {
  buffered: number;
  duration: number;
  currentTime: number;
  playing: boolean;
  volume: number;
  quality: string;
}
// #endregion

// #region Constants
const DEFAULT_CONFIG: PlayerConfig = {
  autoPlay: true,
  muted: false,
  controls: true,
  errorRetryCount: 3,
  errorRetryDelay: 2000
};

const PLAYER_ERRORS = {
  HLS_NOT_SUPPORTED: 'HLS is not supported in this browser',
  INVALID_SOURCE: 'Invalid video source provided',
  PLAYBACK_ERROR: 'Error during video playback'
} as const;
// #endregion

export class PlayerService {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private config: PlayerConfig;
  private retryCount: number = 0;
  private retryTimeout: number | null = null;

  constructor(config: Partial<PlayerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // #region Private Methods
  private setupHLS(videoElement: HTMLVideoElement, source: string) {
    if (this.hls) {
      this.hls.destroy();
    }

    this.hls = new Hls();
    this.video = videoElement;

    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hls?.loadSource(source);
    });

    this.hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.handleNetworkError();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.handleMediaError();
            break;
          default:
            this.handleFatalError();
            break;
        }
      }
    });

    this.hls.attachMedia(videoElement);
  }

  private handleNetworkError() {
    if (this.retryCount < this.config.errorRetryCount) {
      this.retryTimeout = window.setTimeout(() => {
        this.hls?.startLoad();
        this.retryCount++;
      }, this.config.errorRetryDelay);
    } else {
      this.handleFatalError();
    }
  }

  private handleMediaError() {
    if (this.retryCount < this.config.errorRetryCount) {
      this.hls?.recoverMediaError();
      this.retryCount++;
    } else {
      this.handleFatalError();
    }
  }

  private handleFatalError() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.destroy();
    throw new Error(PLAYER_ERRORS.PLAYBACK_ERROR);
  }
  // #endregion

  // #region Public Methods
  public async loadSource(videoElement: HTMLVideoElement, source: string): Promise<void> {
    if (!source) {
      throw new Error(PLAYER_ERRORS.INVALID_SOURCE);
    }

    // Configure video element
    videoElement.autoplay = this.config.autoPlay;
    videoElement.muted = this.config.muted;
    videoElement.controls = this.config.controls;

    // Reset retry counter
    this.retryCount = 0;

    if (Hls.isSupported()) {
      this.setupHLS(videoElement, source);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback to native HLS support (Safari)
      videoElement.src = source;
    } else {
      throw new Error(PLAYER_ERRORS.HLS_NOT_SUPPORTED);
    }
  }

  public getStats(): PlayerStats | null {
    if (!this.video) return null;

    return {
      buffered: this.video.buffered.length ? this.video.buffered.end(0) : 0,
      duration: this.video.duration,
      currentTime: this.video.currentTime,
      playing: !this.video.paused,
      volume: this.video.volume,
      quality: this.hls?.currentLevel === -1 ? 'auto' : `Level ${this.hls?.currentLevel}`
    };
  }

  public setQuality(level: number) {
    if (this.hls) {
      this.hls.currentLevel = level;
    }
  }

  public destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video = null;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }
  // #endregion
} 