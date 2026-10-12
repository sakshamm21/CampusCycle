import React, { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { en, palette } from '@campuscycle/shared';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/theme/ThemeProvider';
import { PASS_ASPECT, passText, qrSecondsLeft, splitName, type RiderPassProps } from './types';
import './RiderPass.web.css';

const BIKE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18.5" cy="17.5" r="3.5" />
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="15" cy="5" r="1" />
    <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
  </svg>
);

// The Rider Pass on the web: the reference board's CSS card (06 §6.7).
export function RiderPass(props: RiderPassProps) {
  const { state, finish, interactive, onFlip, onMinted, testID } = props;
  const { c } = useTheme();
  const screen = useWindowDimensions();
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [levelled, setLevelled] = useState(false);

  const width = props.width ?? Math.min(440, screen.width - 32);
  const live = state === 'riding' || state === 'overdue';
  const now = useNow(1000, live || flipped || state === 'pending');
  const text = passText(props, now);
  const name = splitName(props.name);
  const idle = !!interactive || !!props.sway;
  const noQr = state === 'pending' || state === 'suspended';
  const left = qrSecondsLeft(props.qr?.expiresAt, now);
  const shownFinish = levelled && props.levelUpTo ? props.levelUpTo : finish;

  // Tilt follows the pointer; the idle sway comes back when it leaves (the board's tilt()).
  useEffect(() => {
    const w = wrap.current;
    const p = card.current;
    if (!interactive || !w || !p) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = w.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      w.classList.remove('idle');
      p.style.setProperty('--ry', `${((x - 0.5) * 24).toFixed(2)}deg`);
      p.style.setProperty('--rx', `${((0.5 - y) * 18).toFixed(2)}deg`);
      p.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      p.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    const leave = () => {
      for (const v of ['--rx', '--ry', '--mx', '--my']) p.style.removeProperty(v);
      w.classList.add('idle');
    };
    w.addEventListener('pointermove', move);
    w.addEventListener('pointerleave', leave);
    return () => {
      w.removeEventListener('pointermove', move);
      w.removeEventListener('pointerleave', leave);
    };
  }, [interactive]);

  const minted = useRef(onMinted);
  minted.current = onMinted;
  useEffect(() => {
    if (state !== 'minting') return;
    const timer = setTimeout(() => minted.current?.(), 1350);
    return () => clearTimeout(timer);
  }, [state]);

  // Level-up: after the stamp, the new finish fades in.
  useEffect(() => {
    if (state !== 'returned' || !props.levelUpTo || props.levelUpTo === finish) return;
    const timer = setTimeout(() => setLevelled(true), 550);
    return () => clearTimeout(timer);
  }, [state, props.levelUpTo, finish]);

  const flip = () => {
    if (!interactive) return;
    const next = !flipped;
    setFlipped(next);
    onFlip?.(next);
  };

  const background = (
    <>
      <div className={`pf-bg ${shownFinish}`} />
      <div className="pf-holo" />
    </>
  );

  return (
    <View testID={testID} style={{ width, height: width / PASS_ASPECT, alignSelf: 'center' }}>
      <div
        ref={wrap}
        className={['pass-wrap', idle ? 'idle' : '', props.dock ? 'docking' : ''].join(' ')}
        style={{ '--pass-glow': c.primary } as React.CSSProperties}
      >
        <div className="pass-glow" />
        <button
          ref={card}
          type="button"
          data-testid={testID ? `${testID}.card` : undefined}
          data-state={state}
          data-finish={shownFinish}
          className={['pass', flipped ? 'flipped' : '', interactive ? 'interactive' : ''].join(' ')}
          aria-label={text.a11y}
          aria-pressed={interactive ? flipped : undefined}
          disabled={!interactive}
          onClick={flip}
        >
          <div className="face front" aria-hidden={flipped}>
            {background}
            <div className="pf-content">
              <div className="pf-top">
                <span className="pf-brand">
                  <i>{BIKE_ICON}</i>
                  {en.common.wordmark}
                </span>
                <span className="pf-k">{en.pass.kicker}</span>
              </div>
              <div className="pf-mid">
                <span className="pf-chip">{text.riding ? <b>{props.bikeCode}</b> : en.pass.dock}</span>
                <span className="pf-status">{text.status}</span>
              </div>
              <div className="pf-name">
                {name.first}
                {name.rest ? <em>{name.rest}</em> : null}
              </div>
              <div className="pf-bot">
                <b>{text.bottomLeft}</b>
                <span>{text.riding ? text.timer : text.ridesLabel}</span>
                <span>{props.collegeShort}</span>
              </div>
            </div>
            <div className="pf-wait">{en.pass.awaiting}</div>
            <div className="pf-stamp">{text.stamp}</div>
            <div className="pf-sus">{en.pass.suspended}</div>
            <div className="pf-sweep" />
            <div className="pf-shine" />
            <div className="pf-grain" />
          </div>

          <div className="face back" aria-hidden={!flipped}>
            {background}
            <div className="pb">
              <div className="pb-head">
                <span className="pf-k">{en.pass.show_admin}</span>
                {noQr ? null : (
                  <svg className="pb-ring" viewBox="0 0 32 32">
                    <circle className="bgc" cx="16" cy="16" r="14" />
                    <circle className="fgc" cx="16" cy="16" r="14" strokeDashoffset={88 * (1 - left / 30)} />
                  </svg>
                )}
              </div>
              <div className="pb-qr">
                {!noQr && props.qr ? (
                  <QRCode
                    value={props.qr.payload}
                    size={width * 0.22}
                    ecl="M"
                    color={palette.sticker.ink}
                    backgroundColor="#FFFFFF"
                  />
                ) : null}
              </div>
              <p className="pb-note">{noQr ? en.pass.no_qr : en.pass.back_note}</p>
              <div className="pb-stats">
                <div>
                  <strong>{props.stats?.rides ?? props.rides}</strong>
                  <span>{en.pass.stat_rides}</span>
                </div>
                <div>
                  <strong>{props.stats?.minutes ?? 0}</strong>
                  <span>{en.pass.stat_minutes}</span>
                </div>
                <div>
                  <strong>{props.stats?.fave_stand ?? en.pass.none}</strong>
                  <span>{en.pass.stat_fave}</span>
                </div>
                <div>
                  <strong>{props.stats?.strikes ?? 0}</strong>
                  <span>{en.pass.stat_strikes}</span>
                </div>
              </div>
            </div>
            <div className="pf-shine" />
            <div className="pf-grain" />
          </div>
        </button>
      </div>
    </View>
  );
}
