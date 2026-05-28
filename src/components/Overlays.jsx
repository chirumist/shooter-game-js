/**
 * Overlays.jsx — Game overlay screens
 * 
 * Contains all overlay screen components:
 * - LoadingScreen: Shown while a level loads
 * - GameOverScreen: Shown when player dies
 * - LevelCompleteScreen: Shown when a level is cleared
 * - VictoryScreen: Shown when all levels are beaten
 * - PauseScreen: Shown when game is paused
 */

import { useState } from 'react';

// ============================================================
// LOADING SCREEN
// ============================================================

export function LoadingScreen({ levelName }) {
  const tips = [
    'Use right-click for your devastating special attack!',
    'Press V to toggle between TPS and FPS camera modes.',
    'Hold Shift to sprint — move faster, dodge better!',
    'Ranged enemies stay far away — close the gap quickly!',
    'Bosses appear after clearing all waves. Stay sharp!',
    'Jump with Space to dodge enemy attacks!',
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  return (
    <div className="overlay loading-screen">
      <div className="loading-content">
        <h2 className="loading-title">ENTERING DOMAIN</h2>
        <h1 className="loading-level-name">{levelName || '...'}</h1>
        <div className="loading-bar">
          <div className="loading-fill"></div>
        </div>
        <p className="loading-tip">💡 {tip}</p>
      </div>
    </div>
  );
}

// ============================================================
// GAME OVER SCREEN
// ============================================================

export function GameOverScreen({ score, kills, level, survivalTime, onRestart }) {
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === undefined) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isInfinity = survivalTime !== undefined && survivalTime > 0;

  return (
    <div className="overlay game-over-screen">
      <div className="overlay-content">
        <h1 className="screen-title game-over-title">GAME OVER</h1>
        <p className="screen-subtitle">Your cursed energy has been depleted...</p>

        <div className="final-stats">
          <div className="stat-box">
            <span className="stat-label">FINAL SCORE</span>
            <span className="stat-value">{(score || 0).toLocaleString()}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">ENEMIES DEFEATED</span>
            <span className="stat-value">{kills || 0}</span>
          </div>
          {isInfinity ? (
            <div className="stat-box">
              <span className="stat-label">TIME SURVIVED</span>
              <span className="stat-value">{formatTime(survivalTime)}</span>
            </div>
          ) : (
            <div className="stat-box">
              <span className="stat-label">LEVEL REACHED</span>
              <span className="stat-value">{level || 1}</span>
            </div>
          )}
        </div>

        <button className="game-btn" onClick={onRestart}>
          RESTART
        </button>
      </div>
    </div>
  );
}

// ============================================================
// LEVEL COMPLETE SCREEN
// ============================================================

export function LevelCompleteScreen({ score, message, onNextLevel }) {
  return (
    <div className="overlay level-complete-screen">
      <div className="overlay-content">
        <h1 className="screen-title level-clear-title">DOMAIN CLEARED!</h1>
        <p className="screen-subtitle">{message || 'The cursed spirits have been purified.'}</p>

        <div className="final-stats">
          <div className="stat-box">
            <span className="stat-label">SCORE</span>
            <span className="stat-value">{(score || 0).toLocaleString()}</span>
          </div>
        </div>

        <button className="game-btn" onClick={onNextLevel}>
          NEXT DOMAIN →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// VICTORY SCREEN
// ============================================================

export function VictoryScreen({ score, kills, onPlayAgain }) {
  return (
    <div className="overlay victory-screen">
      <div className="overlay-content victory">
        <h1 className="screen-title victory-title">✦ VICTORY ✦</h1>
        <p className="screen-subtitle">All domains have been conquered! You are the strongest!</p>

        <div className="final-stats">
          <div className="stat-box">
            <span className="stat-label">TOTAL SCORE</span>
            <span className="stat-value">{(score || 0).toLocaleString()}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">TOTAL KILLS</span>
            <span className="stat-value">{kills || 0}</span>
          </div>
        </div>

        <button className="game-btn" onClick={onPlayAgain}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PAUSE SCREEN
// ============================================================

export function PauseScreen({ onResume, onQuit }) {
  return (
    <div className="overlay pause-screen">
      <div className="overlay-content">
        <h1 className="screen-title">PAUSED</h1>

        <div className="pause-buttons">
          <button className="game-btn" onClick={onResume}>
            RESUME
          </button>
          <button className="game-btn secondary" onClick={onQuit}>
            QUIT TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}
