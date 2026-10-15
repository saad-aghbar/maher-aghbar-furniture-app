'use client';

import { animate, motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import './portal-switch.css';

export interface PortalOption<T extends string> {
  value: T;
  label: string;
}

const THUMB_SPRING = { type: 'spring' as const, duration: 0.45, bounce: 0.18 };
const PRESS_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

export function PortalSwitch<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: PortalOption<T>[];
  label: string;
}) {
  const reduce = useReducedMotion();
  const groupRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const velocity = useRef(0);
  const currentLeft = useRef(0);
  const animation = useRef<{ stop: () => void } | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const thumb = thumbRef.current;
    if (!group || !thumb) return;
    const active = group.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!active) return;
    const left = active.offsetLeft;
    thumb.style.width = `${active.offsetWidth}px`;
    const write = (next: number) => {
      thumb.style.transform = `translate3d(${next}px, 0, 0)`;
    };
    if (!placed.current || reduce) {
      animation.current?.stop();
      currentLeft.current = left;
      write(left);
      placed.current = true;
      return;
    }
    const from = currentLeft.current;
    let last = from;
    let lastTime = performance.now();
    animation.current?.stop();
    animation.current = animate(from, left, {
      ...THUMB_SPRING,
      velocity: velocity.current,
      onUpdate: (latest) => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        if (dt > 0) velocity.current = (latest - last) / dt;
        last = latest;
        lastTime = now;
        currentLeft.current = latest;
        write(latest);
      },
    });
  }, [reduce, value]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const forward = event.key === 'ArrowRight' ? !rtl : event.key === 'ArrowLeft' ? rtl : false;
    const nextIndex =
      event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (forward ? 1 : -1) + options.length) % options.length;
    const target = options[nextIndex];
    if (!target) return;
    onChange(target.value);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative flex w-full gap-0.5 rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-[3px]"
    >
      <span
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute top-[3px] bottom-[3px] left-0 rounded-[9px] bg-[var(--maher-surface)] shadow-card"
      />
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <motion.button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            whileTap={{ scale: 0.97 }}
            transition={PRESS_SPRING}
            className="portal-switch__option relative z-[1] flex min-h-11 flex-1 items-center justify-center rounded-[9px] px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}
