import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Country } from './types';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [winner, setWinner] = useState<Country | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleStart = () => {
    // Initialize audio on user interaction
    audioService.init();
    setGameState(GameState.PLAYING);
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-white select-none">
      {/* Game Canvas Layer */}
      <GameCanvas 
        gameState={gameState} 
        onGameStateChange={setGameState}
        setWinner={setWinner}
        setRemainingCount={setRemainingCount}
        onReady={() => setIsReady(true)}
      />

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6 z-10">
        
        {/* Top HUD */}
        {gameState !== GameState.MENU && (
             <div className="flex flex-col items-center gap-2 animate-fade-in">
                <div className="bg-slate-800/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-slate-700">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Remaining: {remainingCount}
                    </h1>
                </div>
            </div>
        )}

        {/* Start Screen */}
        {gameState === GameState.MENU && isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
                <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-600 max-w-md text-center transform hover:scale-105 transition-transform duration-300">
                    <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                        Flag Battle
                    </h1>
                    <p className="text-slate-400 mb-8 text-lg">Physics Royale • Last One Standing Wins</p>
                    <button 
                        onClick={handleStart}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 text-xl"
                    >
                        START MATCH
                    </button>
                </div>
            </div>
        )}

        {/* Winner Screen */}
        {gameState === GameState.GAME_OVER && winner && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto animate-bounce-in">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-10 rounded-3xl shadow-2xl border-2 border-yellow-500/50 text-center relative overflow-hidden">
                    {/* Glow effect */}
                    <div className="absolute top-0 left-0 w-full h-full bg-yellow-500/10 z-0"></div>
                    
                    <div className="relative z-10">
                        <div className="text-sm font-bold tracking-widest text-yellow-500 mb-2 uppercase">Champion</div>
                        <div className="text-8xl mb-4 filter drop-shadow-lg animate-pulse">{winner.emoji}</div>
                        <h2 className="text-6xl font-black text-white mb-8 tracking-tight">{winner.name}</h2>
                        
                        <button 
                            onClick={handleRestart}
                            className="bg-white text-slate-900 hover:bg-slate-200 font-bold py-3 px-8 rounded-full shadow-xl transition-all active:scale-95"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
             </div>
        )}

        {/* Restart Button (During Game) */}
        {gameState === GameState.PLAYING && (
            <div className="pointer-events-auto">
                <button 
                    onClick={handleStart}
                    className="bg-slate-800/50 hover:bg-slate-700/80 text-white/50 hover:text-white text-sm font-semibold py-2 px-4 rounded-lg border border-slate-700 transition-colors backdrop-blur-sm"
                >
                    Restart Match
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;