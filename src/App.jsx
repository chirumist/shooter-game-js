/**
 * App.jsx — Main application component
 * 
 * Manages the overall game flow by:
 * 1. Rendering the Three.js canvas (always present)
 * 2. Showing the correct UI overlay based on game state
 * 3. Bridging GameEngine state to React components
 */

import { useState, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import StartScreen from './components/StartScreen.jsx';
import HUD from './components/HUD.jsx';
import {
  LoadingScreen,
  GameOverScreen,
  LevelCompleteScreen,
  VictoryScreen,
  PauseScreen,
} from './components/Overlays.jsx';
import { GAME_STATES } from './engine/GameEngine.js';
import MobileControls from './components/MobileControls.jsx';
import OrientationOverlay from './components/OrientationOverlay.jsx';

export default function App() {
  // Game state tracked in React for UI rendering
  const [gameState, setGameState] = useState(GAME_STATES.MENU);
  const [hudData, setHudData] = useState({});
  const engineRef = useRef(null);

  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const [engineInstance, setEngineInstance] = useState(null);

  // Called when the GameEngine is initialized
  const handleEngineReady = useCallback((engine) => {
    engineRef.current = engine;
    setEngineInstance(engine);
  }, []);

  // Called every time the game state changes (from GameEngine)
  const handleStateChange = useCallback((data) => {
    setGameState(data.state);
    setHudData(data.hud);
  }, []);

  // User actions
  const handleSelectCharacter = useCallback((character, isInfinity) => {
    // Attempt screen orientation lock to landscape on mobile devices
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch((err) => {
        console.warn('Orientation lock failed on selection:', err);
      });
    }
    if (engineRef.current) {
      engineRef.current.selectCharacter(character, isInfinity);
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
    }
  }, []);

  const handleNextLevel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.nextLevel();
    }
  }, []);

  const handleResume = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
  }, []);

  const handleQuit = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.quitToMenu();
    }
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.restart();
    }
  }, []);

  return (
    <div className="game-root">
      {/* Three.js Canvas — always rendered */}
      <GameCanvas
        onEngineReady={handleEngineReady}
        onStateChange={handleStateChange}
      />

      {/* UI Overlays — conditionally rendered based on game state */}

      {gameState === GAME_STATES.MENU && (
        <StartScreen onSelectCharacter={handleSelectCharacter} />
      )}

      {gameState === GAME_STATES.LOADING && (
        <LoadingScreen levelName={hudData.levelName} />
      )}

      {gameState === GAME_STATES.PLAYING && (
        <>
          {/* CSS post-processing overlays (zero GPU cost) */}
          <div className="game-vignette"></div>
          <div className="game-scanlines"></div>
          <HUD hudData={hudData} />
          {isMobile && <MobileControls engine={engineInstance} />}
        </>
      )}

      {gameState === GAME_STATES.PAUSED && (
        <>
          <HUD hudData={hudData} />
          <PauseScreen onResume={handleResume} onQuit={handleQuit} />
        </>
      )}

      {gameState === GAME_STATES.GAME_OVER && (
        <GameOverScreen
          score={hudData.finalScore}
          kills={hudData.finalKills}
          level={hudData.finalLevel}
          survivalTime={hudData.finalSurvivalTime}
          onRestart={handleRestart}
        />
      )}

      {gameState === GAME_STATES.LEVEL_COMPLETE && (
        <LevelCompleteScreen
          score={hudData.levelScore}
          message={hudData.clearMessage}
          onNextLevel={handleNextLevel}
        />
      )}

      {gameState === GAME_STATES.VICTORY && (
        <VictoryScreen
          score={hudData.victoryScore}
          kills={hudData.victoryKills}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Enforce landscape mode on mobile/touch screens */}
      <OrientationOverlay />
    </div>
  );
}
