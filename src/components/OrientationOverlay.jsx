import React from 'react';

export default function OrientationOverlay() {
  const handleLockOrientation = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) {
      console.warn('Orientation lock failed:', err);
    }
  };

  const hasOrientationLock = typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock;

  return (
    <div className="orientation-overlay">
      <div className="orientation-overlay-content">
        <div className="orientation-device-animation">
          <div className="orientation-device-screen"></div>
        </div>
        <h2 className="orientation-title">Landscape Required</h2>
        <p className="orientation-text">
          Cursed Battleground requires <span>landscape mode</span> to play. 
          Please rotate your device or lock it to landscape.
        </p>
        {hasOrientationLock && (
          <button className="orientation-btn" onClick={handleLockOrientation}>
            FORCE LANDSCAPE
          </button>
        )}
      </div>
    </div>
  );
}
