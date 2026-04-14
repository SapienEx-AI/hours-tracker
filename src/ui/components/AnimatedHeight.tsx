import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Transition duration in ms. Default 300. */
  durationMs?: number;
  className?: string;
};

/**
 * Smoothly transitions wrapper height when the wrapped content's natural
 * height changes. ResizeObserver measures the inner element; the wrapper
 * gets an explicit pixel height with a CSS transition.
 *
 * First measurement snaps (no animation, since there's no FROM value).
 * Subsequent measurements animate from the current value to the new one.
 */
export function AnimatedHeight({
  children,
  durationMs = 300,
  className = '',
}: Props): JSX.Element {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (innerRef.current === null) return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next !== undefined) setHeight(next);
    });
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        height: height !== undefined ? `${height}px` : undefined,
        transition: `height ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
