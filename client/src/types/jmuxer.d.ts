declare module 'jmuxer' {
  interface JMuxerOptions {
    node: HTMLVideoElement | string;
    mode?: 'video' | 'audio' | 'both';
    debug?: boolean;
    fps?: number;
    flushingTime?: number;
    clearBuffer?: boolean;
    onReady?: () => void;
    onError?: (error: Error) => void;
    readFpsFromTrack?: boolean;
    audio?: {
      channelCount?: number;
      sampleRate?: number;
    };
  }

  interface FeedData {
    video?: Uint8Array;
    audio?: Uint8Array;
    duration?: number;
  }

  class JMuxer {
    constructor(options: JMuxerOptions);
    feed(data: FeedData): void;
    destroy(): void;
    reset(): void;
  }

  export default JMuxer;
}