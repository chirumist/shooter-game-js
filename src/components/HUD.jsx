/**
 * HUD.jsx — Heads-Up Display shown during gameplay
 * 
 * Displays:
 * - Health bar (color-coded)
 * - Score counter
 * - Wave / Level info
 * - Enemy count
 * - Special attack cooldown
 * - Camera mode indicator
 * - Crosshair
 * - Damage flash overlay
 * - Weapon name + tier display
 * - Wave announcement popup (new weapon notification)
 */

export default function HUD({ hudData }) {
  const {
    health = 100,
    maxHealth = 100,
    score = 0,
    wave = 1,
    totalWaves = 5,
    enemyCount = 0,
    cameraMode = 'TPS',
    cooldownPercent = 0,
    levelName = '',
    damageFlash = false,
    weaponName = '',
    weaponTier = 0,
    waveAnnouncement = null,
    survivalTime = 0,
    speedPowerupTime = 0,
    damagePowerupTime = 0,
    weaponOverride = null,
    weaponOverrideTime = 0,
  } = hudData || {};

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === undefined) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isInfinity = totalWaves === Infinity || totalWaves === '∞';

  // Health bar color: green → yellow → red
  const healthPercent = (health / maxHealth) * 100;
  const healthColor = healthPercent > 60
    ? '#44ff44'
    : healthPercent > 30
      ? '#ffaa00'
      : '#ff3333';

  const cooldownReady = cooldownPercent <= 0;

  // Weapon tier indicator dots
  const tierDots = [];
  for (let i = 0; i < 5; i++) {
    tierDots.push(
      <span key={i} className={`tier-dot ${i <= weaponTier ? 'active' : ''}`}>●</span>
    );
  }

  return (
    <>
      {/* Power-up badges */}
      <div className="powerup-container">
        {speedPowerupTime > 0 && (
          <div className="powerup-badge speed">
            <span className="powerup-icon">⚡</span>
            <span className="powerup-timer">{speedPowerupTime}s</span>
            <span className="powerup-label">SPEED BOOST</span>
          </div>
        )}
        {damagePowerupTime > 0 && (
          <div className="powerup-badge damage">
            <span className="powerup-icon">💥</span>
            <span className="powerup-timer">{damagePowerupTime}s</span>
            <span className="powerup-label">DAMAGE BOOST</span>
          </div>
        )}
        {weaponOverride === 'shotgun' && weaponOverrideTime > 0 && (
          <div className="powerup-badge shotgun">
            <span className="powerup-icon">🔱</span>
            <span className="powerup-timer">{weaponOverrideTime}s</span>
            <span className="powerup-label">SHOTGUN</span>
          </div>
        )}
        {weaponOverride === 'railgun' && weaponOverrideTime > 0 && (
          <div className="powerup-badge railgun">
            <span className="powerup-icon">☄</span>
            <span className="powerup-timer">{weaponOverrideTime}s</span>
            <span className="powerup-label">RAILGUN</span>
          </div>
        )}
      </div>

      {/* Crosshair */}
      <div className="crosshair">
        <div className="crosshair-dot"></div>
        <div className="crosshair-line top"></div>
        <div className="crosshair-line bottom"></div>
        <div className="crosshair-line left"></div>
        <div className="crosshair-line right"></div>
      </div>

      {/* Damage flash overlay */}
      <div className={`damage-flash ${damageFlash ? 'active' : ''}`}></div>

      {/* Wave Announcement Popup */}
      {waveAnnouncement && (
        <div className={`wave-announcement ${waveAnnouncement.isBossWave ? 'boss-wave' : ''}`}>
          <div className="wave-announce-content">
            <div className="wave-announce-title">
              {waveAnnouncement.isBossWave ? '💀 BOSS WAVE' : `⚔ WAVE ${waveAnnouncement.wave}`}
            </div>
            <div className="wave-announce-weapon">
              <span className="weapon-label">NEW WEAPON</span>
              <span className="weapon-new-name">{waveAnnouncement.weaponName}</span>
            </div>
            <div className="wave-announce-tier">
              TIER {waveAnnouncement.weaponTier + 1}
            </div>
          </div>
        </div>
      )}

      {/* HUD Container */}
      <div className="hud">
        {/* Top-left: Health */}
        <div className="hud-health">
          <div className="health-icon">♥</div>
          <div className="health-bar-container">
            <div
              className="health-bar-fill"
              style={{
                width: `${healthPercent}%`,
                background: `linear-gradient(90deg, ${healthColor}, ${healthColor}88)`,
              }}
            ></div>
          </div>
          <span className="health-text">{Math.ceil(health)}</span>
        </div>

        {/* Top-center: Level & Wave */}
        <div className="hud-top-center">
          <div className="level-name">{levelName}</div>
          <div className="wave-info">
            {isInfinity
              ? `SURVIVAL: ${formatTime(survivalTime)} (WAVE ${wave})`
              : `WAVE ${wave} / ${totalWaves}`}
          </div>
        </div>

        {/* Top-right: Score */}
        <div className="hud-score">
          <span className="hud-label">SCORE</span>
          <span className="score-value">{score.toLocaleString()}</span>
        </div>

        {/* Bottom-left: Enemy count + Weapon */}
        <div className="hud-bottom-left">
          <div className="hud-enemies">
            <span className="hud-label">ENEMIES</span>
            <span className="enemy-count">{enemyCount}</span>
          </div>
          <div className="hud-weapon">
            <span className="weapon-name">{weaponName}</span>
            <div className="weapon-tier-dots">{tierDots}</div>
          </div>
        </div>

        {/* Bottom-center: Special cooldown */}
        <div className="hud-cooldown">
          <div className="cooldown-bar-container">
            <div
              className="cooldown-bar-fill"
              style={{
                width: `${(1 - cooldownPercent) * 100}%`,
                background: cooldownReady
                  ? 'linear-gradient(90deg, #44ff88, #44ffcc)'
                  : 'linear-gradient(90deg, #ff8844, #ffaa66)',
              }}
            ></div>
          </div>
          <span className={`cooldown-text ${cooldownReady ? 'ready' : ''}`}>
            {cooldownReady ? '✦ SPECIAL READY' : 'CHARGING...'}
          </span>
        </div>

        {/* Bottom-right: Camera mode */}
        <div className="hud-camera">
          <span className="hud-label">CAMERA</span>
          <span className="camera-mode">{cameraMode}</span>
          <span className="camera-hint">[LOCKED]</span>
        </div>
      </div>
    </>
  );
}
