export interface Country {
  code: string;
  name: string;
  emoji: string;
  color: string;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

// Matter.js types when loaded via CDN
declare global {
  interface Window {
    Matter: any;
    webkitAudioContext: typeof AudioContext;
  }
}