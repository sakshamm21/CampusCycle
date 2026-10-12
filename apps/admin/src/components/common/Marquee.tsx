'use client';

import React from 'react';
import './Marquee.css';

interface MarqueeProps {
  className?: string;
  lane1Text?: string;
  lane2Text?: string;
}

export function Marquee({
  className = '',
  lane1Text = 'borrow · ride · return at any stand · borrow · ride · return at any stand · ',
  lane2Text = 'hall 5 · library · lhc · shopping complex · hall 12 · main gate · new sac · ',
}: MarqueeProps) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden py-3 select-none pointer-events-none w-full ${className}`}
    >
      {/* Primary lane 1: rotated -2.2deg */}
      <div className="marquee-lane marquee-lane1">
        <div className="marquee-track">
          <span>{lane1Text}</span>
          <span>{lane1Text}</span>
          <span>{lane1Text}</span>
          <span>{lane1Text}</span>
        </div>
      </div>
      {/* Reverse lane 2: rotated +1.4deg */}
      <div className="marquee-lane marquee-lane2">
        <div className="marquee-track marquee-track-reverse">
          <span>{lane2Text}</span>
          <span>{lane2Text}</span>
          <span>{lane2Text}</span>
          <span>{lane2Text}</span>
        </div>
      </div>
    </div>
  );
}
