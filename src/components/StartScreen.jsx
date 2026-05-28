/**
 * StartScreen.jsx — Character selection screen
 * 
 * Displays the game title and two character cards (Gojo & Sukuna).
 * Clicking a card selects that character and starts the game.
 */

import { useState } from 'react';

export default function StartScreen({ onSelectCharacter }) {
  const [hovered, setHovered] = useState(null);
  const [isInfinityMode, setIsInfinityMode] = useState(false);

  return (
    <div className="start-screen">
      <div className="start-content">
        {/* Title */}
        <div className="title-container">
          <h1 className="game-title">
            <span className="title-cursed">CURSED</span>
            <span className="title-battle">BATTLEGROUND</span>
          </h1>
          <p className="subtitle">呪術廻戦 &bull; JUJUTSU KAISEN</p>
        </div>

        {/* Game Mode Selector */}
        <div className="mode-selector">
          <button 
            type="button"
            className={`mode-btn ${!isInfinityMode ? 'active' : ''}`}
            onClick={() => setIsInfinityMode(false)}
          >
            🏆 DOMAIN CONQUEST
          </button>
          <button 
            type="button"
            className={`mode-btn ${isInfinityMode ? 'active' : ''}`}
            onClick={() => setIsInfinityMode(true)}
          >
            ♾ INFINITY SURVIVAL
          </button>
        </div>

        {/* Character Selection */}
        <h2 className="select-text">SELECT YOUR SORCERER</h2>

        <div className="character-selection">
          {/* Gojo Card */}
          <div
            className={`char-card gojo-card ${hovered === 'gojo' ? 'hovered' : ''}`}
            onClick={() => onSelectCharacter('gojo', isInfinityMode)}
            onMouseEnter={() => setHovered('gojo')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="char-preview gojo-preview">
              <div className="char-icon">∞</div>
              <div className="char-glow gojo-glow"></div>
            </div>
            <div className="char-info">
              <h3>GOJO SATORU</h3>
              <p className="char-ability">∞ INFINITY &bull; LIMITLESS</p>
              <p className="char-desc">The strongest sorcerer. Wields Limitless cursed technique with devastating blue energy blasts.</p>
              <div className="char-stats">
                <div className="stat-item">
                  <span>ATK</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '85%', background: 'linear-gradient(90deg, #4488ff, #88bbff)' }}></div></div>
                </div>
                <div className="stat-item">
                  <span>SPD</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '90%', background: 'linear-gradient(90deg, #4488ff, #88bbff)' }}></div></div>
                </div>
                <div className="stat-item">
                  <span>DEF</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '95%', background: 'linear-gradient(90deg, #4488ff, #88bbff)' }}></div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Sukuna Card */}
          <div
            className={`char-card sukuna-card ${hovered === 'sukuna' ? 'hovered' : ''}`}
            onClick={() => onSelectCharacter('sukuna', isInfinityMode)}
            onMouseEnter={() => setHovered('sukuna')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="char-preview sukuna-preview">
              <div className="char-icon">✂</div>
              <div className="char-glow sukuna-glow"></div>
            </div>
            <div className="char-info">
              <h3>RYOMEN SUKUNA</h3>
              <p className="char-ability">✂ CLEAVE &bull; DISMANTLE</p>
              <p className="char-desc">The King of Curses. Unleashes devastating slash attacks that cut through anything.</p>
              <div className="char-stats">
                <div className="stat-item">
                  <span>ATK</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '98%', background: 'linear-gradient(90deg, #ff2222, #ff6644)' }}></div></div>
                </div>
                <div className="stat-item">
                  <span>SPD</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '80%', background: 'linear-gradient(90deg, #ff2222, #ff6644)' }}></div></div>
                </div>
                <div className="stat-item">
                  <span>DEF</span>
                  <div className="stat-bar"><div className="stat-fill" style={{ width: '70%', background: 'linear-gradient(90deg, #ff2222, #ff6644)' }}></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls hint */}
        <div className="controls-hint">
          <p>
            <kbd>WASD</kbd> Move &bull; <kbd>Mouse</kbd> Aim &bull;
            <kbd>LClick</kbd> Shoot &bull; <kbd>RClick</kbd> Special &bull;
            <kbd>V</kbd> Camera &bull; <kbd>Space</kbd> Jump &bull;
            <kbd>Shift</kbd> Sprint
          </p>
        </div>
      </div>
    </div>
  );
}
