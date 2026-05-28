import { useState, useRef, useEffect } from 'react';

export default function MobileControls({ engine }) {
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  
  const joystickRef = useRef(null);
  const joystickTouchIdRef = useRef(null);
  const lookTouchIdRef = useRef(null);
  
  const lastLookPosRef = useRef({ x: 0, y: 0 });
  const playerRef = useRef(null);

  // Keep a reference to the player object
  useEffect(() => {
    if (engine) {
      playerRef.current = engine.player;
    }
  }, [engine, engine?.player]);

  // Constantly sync player ref in render loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (engine && engine.player) {
        playerRef.current = engine.player;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [engine]);

  // JOYSTICK CONTROLS
  const handleJoystickStart = (e) => {
    e.preventDefault();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    setJoystickActive(true);

    // Compute base center coordinates
    updateJoystickPosition(touch);
  };

  const handleJoystickMove = (e) => {
    if (joystickTouchIdRef.current === null) return;
    
    // Find active joystick touch
    let activeTouch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchIdRef.current) {
        activeTouch = e.touches[i];
        break;
      }
    }
    
    if (activeTouch) {
      updateJoystickPosition(activeTouch);
    }
  };

  const handleJoystickEnd = (e) => {
    // Check if the joystick touch ended
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        
        // Reset player movement keys
        const player = playerRef.current;
        if (player) {
          player.keys.forward = false;
          player.keys.backward = false;
          player.keys.left = false;
          player.keys.right = false;
        }
        break;
      }
    }
  };

  const updateJoystickPosition = (touch) => {
    const player = playerRef.current;
    if (!player || !joystickRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate offset from center
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;

    // Clamp to max radius (e.g. 50px)
    const maxRadius = 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: dx, y: dy });

    // Map offset coordinates to player movement keys (using analog normalized ratios)
    const normX = dx / maxRadius;
    const normY = dy / maxRadius;
    const threshold = 0.25;

    // Y axis (inverted in screen coords: -Y is forward, +Y is backward)
    if (normY < -threshold) {
      player.keys.forward = true;
      player.keys.backward = false;
    } else if (normY > threshold) {
      player.keys.backward = true;
      player.keys.forward = false;
    } else {
      player.keys.forward = false;
      player.keys.backward = false;
    }

    // X axis (-X is left, +X is right)
    if (normX < -threshold) {
      player.keys.left = true;
      player.keys.right = false;
    } else if (normX > threshold) {
      player.keys.right = true;
      player.keys.left = false;
    } else {
      player.keys.left = false;
      player.keys.right = false;
    }
  };

  // TOUCH LOOK CONTROLS (Dragging on Look Area)
  const handleLookStart = (e) => {
    // Avoid double capturing or capturing over joystick
    if (lookTouchIdRef.current !== null) return;
    
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e) => {
    if (lookTouchIdRef.current === null) return;

    let activeTouch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === lookTouchIdRef.current) {
        activeTouch = e.touches[i];
        break;
      }
    }

    const player = playerRef.current;
    if (activeTouch && player) {
      const dx = activeTouch.clientX - lastLookPosRef.current.x;
      const dy = activeTouch.clientY - lastLookPosRef.current.y;

      // Higher sensitivity scale for touch aim look (1.5x)
      const sensMultiplier = 1.5;
      player.mouseDelta.x += dx * sensMultiplier;
      player.mouseDelta.y += dy * sensMultiplier;

      lastLookPosRef.current = { x: activeTouch.clientX, y: activeTouch.clientY };
    }
  };

  const handleLookEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  // ACTION BUTTONS (Jump, Attack, Special)
  const handleJumpStart = () => {
    const player = playerRef.current;
    if (player) {
      player.keys.jump = true;
    }
  };

  const handleJumpEnd = () => {
    const player = playerRef.current;
    if (player) {
      player.keys.jump = false;
    }
  };

  const handleShootStart = () => {
    const player = playerRef.current;
    if (player) {
      player.mouseButtons.left = true;
    }
  };

  const handleShootEnd = () => {
    const player = playerRef.current;
    if (player) {
      player.mouseButtons.left = false;
    }
  };

  const handleSpecialTap = () => {
    const player = playerRef.current;
    if (player) {
      player.mouseButtons.right = true;
    }
  };

  return (
    <div className="mobile-controls-root">
      {/* Invisible full screen look area (left excluded by css pointer-events) */}
      <div 
        className="mobile-look-area"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* Bottom Left: Virtual Joystick */}
      <div 
        className="joystick-boundary"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        <div 
          ref={joystickRef} 
          className={`joystick-base ${joystickActive ? 'active' : ''}`}
        >
          <div 
            className="joystick-handle"
            style={{
              transform: `translate3d(${joystickPos.x}px, ${joystickPos.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* Bottom Right: Action Buttons */}
      <div className="mobile-action-buttons">
        {/* Special Attack Button */}
        <button 
          className="mobile-btn special-btn"
          onTouchStart={handleSpecialTap}
        >
          💥
          <span className="btn-label">SPECIAL</span>
        </button>

        {/* Jump Button */}
        <button 
          className="mobile-btn jump-btn"
          onTouchStart={handleJumpStart}
          onTouchEnd={handleJumpEnd}
        >
          ▲
          <span className="btn-label">JUMP</span>
        </button>

        {/* Shoot / Attack Button (Large) */}
        <button 
          className="mobile-btn shoot-btn"
          onTouchStart={handleShootStart}
          onTouchEnd={handleShootEnd}
        >
          🎯
          <span className="btn-label">SHOOT</span>
        </button>
      </div>
    </div>
  );
}
