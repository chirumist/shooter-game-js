/**
 * GameCanvas.jsx — React component wrapping the Three.js canvas
 * 
 * This component:
 * 1. Creates a <canvas> element for Three.js rendering
 * 2. Initializes the GameEngine on mount
 * 3. Passes game state changes up to App via callbacks
 * 4. Cleans up on unmount
 */

import { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine.js';

export default function GameCanvas({ onEngineReady, onStateChange }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create the game engine
    const engine = new GameEngine(canvasRef.current, (data) => {
      if (onStateChange) onStateChange(data);
    });
    engineRef.current = engine;

    // Pass engine reference up to parent
    if (onEngineReady) onEngineReady(engine);

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
