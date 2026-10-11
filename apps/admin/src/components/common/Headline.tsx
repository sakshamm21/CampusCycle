import React from 'react';

export interface HeadlineProps {
  text: string;
  size?: 'xl' | 'l' | 'm';
  className?: string;
}

export function Headline({ text, size = 'l', className = '' }: HeadlineProps) {
  // text has *accent* markers
  const parts = text.split(/(\*[^*]+\*)/g);

  const sizeClasses = {
    xl: 'text-4xl md:text-5xl leading-tight',
    l: 'text-2xl md:text-3xl leading-snug',
    m: 'text-xl md:text-2xl leading-snug',
  }[size];

  return (
    <h1
      className={`font-display lowercase font-black [font-stretch:125%] tracking-tight ${sizeClasses} ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          const word = part.slice(1, -1);
          return (
            <span
              key={i}
              className="italic font-normal text-primary tracking-tight"
              style={{
                fontFamily: 'var(--font-accent)',
                fontSize: '1.04em',
                letterSpacing: '-0.01em',
              }}
            >
              {word}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </h1>
  );
}
