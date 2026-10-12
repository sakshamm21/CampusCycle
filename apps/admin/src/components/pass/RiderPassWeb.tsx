'use client';

import React, { useState, useRef, useEffect } from 'react';
import './RiderPassWeb.css';
import { cn } from '@/lib/utils';

export type PassFinish = 'graphite' | 'chrome' | 'holo';
export type PassState = 'pending' | 'ready' | 'riding' | 'overdue' | 'returned' | 'suspended';

export interface RiderPassWebProps {
  holderName?: string;
  collegeName?: string;
  passLabel?: string;
  state?: PassState;
  finish?: PassFinish;
  bikeCode?: string;
  statusText?: string;
  rides?: number;
  minutes?: number;
  faveStand?: string;
  strikes?: number;
  idleSway?: boolean;
  tiltOnHover?: boolean;
  interactiveFlip?: boolean;
  className?: string;
}

export function RiderPassWeb({
  holderName = 'Aanya Sharma',
  collegeName = 'IIT Kanpur',
  passLabel = 'IITK · 0421',
  state = 'ready',
  finish = 'graphite',
  bikeCode = 'K-042',
  statusText,
  rides = 7,
  minutes = 96,
  faveStand = 'Hall 5',
  strikes = 0,
  idleSway = false,
  tiltOnHover = false,
  interactiveFlip = false,
  className = '',
}: RiderPassWebProps) {
  const [flipped, setFlipped] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);

  const defaultStatusMap: Record<PassState, string> = {
    pending: 'pending',
    ready: 'ready to ride',
    riding: `riding · ${bikeCode}`,
    overdue: `overdue · ${bikeCode}`,
    returned: 'returned ✓',
    suspended: 'suspended',
  };

  const displayStatus = statusText ?? defaultStatusMap[state];

  // Tilt on pointer move
  useEffect(() => {
    if (!tiltOnHover) return;
    const wrap = wrapRef.current;
    const pass = passRef.current;
    if (!wrap || !pass) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      wrap.classList.remove('idle');
      pass.style.setProperty('--ry', `${((x - 0.5) * 24).toFixed(2)}deg`);
      pass.style.setProperty('--rx', `${((0.5 - y) * 18).toFixed(2)}deg`);
      pass.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      pass.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };

    const handlePointerLeave = () => {
      pass.style.removeProperty('--rx');
      pass.style.removeProperty('--ry');
      pass.style.removeProperty('--mx');
      pass.style.removeProperty('--my');
      if (idleSway) {
        wrap.classList.add('idle');
      }
    };

    wrap.addEventListener('pointermove', handlePointerMove);
    wrap.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      wrap.removeEventListener('pointermove', handlePointerMove);
      wrap.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [tiltOnHover, idleSway]);

  const handlePassClick = () => {
    if (interactiveFlip) {
      setFlipped((f) => !f);
    }
  };

  return (
    <div ref={wrapRef} className={cn('pass-wrap', idleSway && 'idle', className)}>
      <div className="pass-glow" />
      <div
        ref={passRef}
        onClick={handlePassClick}
        data-state={state}
        data-finish={finish}
        className={cn('pass', flipped && 'flipped')}
        role={interactiveFlip ? 'button' : undefined}
        tabIndex={interactiveFlip ? 0 : undefined}
        aria-label={`Rider Pass ${passLabel}, ${holderName}`}
      >
        {/* Front Face */}
        <div className="face front">
          <div className="pf-bg" />
          <div className="pf-holo" />
          <div className="pf-content">
            <div className="pf-top">
              <span className="pf-brand">
                <i>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" strokeWidth="1.4" />
                    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                  </svg>
                </i>
                campuscycle
              </span>
              <span className="pf-k">rider pass</span>
            </div>

            <div className="pf-mid">
              <span className="pf-chip">
                <b>{bikeCode}</b>
              </span>
              <span className="pf-status">{displayStatus}</span>
            </div>

            <div className="pf-name">
              {holderName.toLowerCase()}
              <em>{collegeName.toLowerCase()}</em>
            </div>

            <div className="pf-bot">
              <span>
                <b>{passLabel}</b>
              </span>
              <span>
                <b>{rides}</b> rides
              </span>
              <span className="capitalize">{finish}</span>
            </div>
          </div>

          {/* State overlays */}
          <div className="pf-wait">
            awaiting
            <br />
            approval
          </div>
          <div className="pf-stamp">
            returned ✓
            <br />
            {faveStand} · {minutes} min
          </div>
          <div className="pf-sus">suspended · ask admin</div>

          <div className="pf-shine" />
          <div className="pf-grain" />
        </div>

        {/* Back Face */}
        <div className="face back">
          <div className="pf-bg" />
          <div className="pf-holo" />
          <div className="pb">
            <div className="pb-head">
              <span className="pf-k">pass qr · live</span>
              <span className="pf-k">{passLabel}</span>
            </div>

            <div className="pb-qr">
              {/* Crisp SVG QR code mockup */}
              <svg viewBox="0 0 23 23" shapeRendering="crispEdges">
                <path
                  fillRule="evenodd"
                  fill="#0B0E13"
                  d="M1 1h7v7h-7zM2 2v5h5v-5zM3 3h3v3h-3zM15 1h7v7h-7zM16 2v5h5v-5zM17 3h3v3h-3zM1 15h7v7h-7zM2 16v5h5v-5zM3 17h3v3h-3zM9 2h1v1h-1zM11 2h1v1h-1zM9 4h2v1h-2zM12 4h1v2h-1zM9 7h1v1h-1zM13 7h1v1h-1zM9 10h5v1h-5zM11 12h2v2h-2zM16 10h1v2h-1zM18 10h2v1h-2zM20 12h1v1h-1zM9 15h1v2h-1zM12 16h2v1h-2zM15 15h1v1h-1zM18 15h2v1h-2zM10 19h2v2h-2zM14 18h2v2h-2zM17 18h1v3h-1zM20 19h1v2h-1z"
                />
              </svg>
            </div>

            <div className="pb-side">
              <div className="pb-ring">
                <svg viewBox="0 0 32 32">
                  <circle className="bgc" cx="16" cy="16" r="14" />
                  <circle className="fgc" cx="16" cy="16" r="14" strokeDashoffset="0" />
                </svg>
                <span>30s live qr</span>
              </div>
              <p className="pb-note">
                Show this to an admin. An admin scan shows your pass status and active bike.
              </p>
            </div>

            <div className="pb-stats">
              <div>
                <strong>{rides}</strong>
                <span>rides</span>
              </div>
              <div>
                <strong>{minutes}</strong>
                <span>minutes</span>
              </div>
              <div>
                <strong className="truncate">{faveStand}</strong>
                <span>fave stand</span>
              </div>
              <div>
                <strong>{strikes}</strong>
                <span>strikes</span>
              </div>
            </div>
          </div>

          <div className="pf-shine" />
          <div className="pf-grain" />
        </div>
      </div>
    </div>
  );
}
