import { useEffect } from 'react';

let activeLocks = 0;
let originalOverflow = '';
let originalPaddingInlineEnd = '';

function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => undefined;
  }

  const body = document.body;
  if (activeLocks === 0) {
    originalOverflow = body.style.overflow;
    originalPaddingInlineEnd = body.style.paddingInlineEnd;
    const scrollbarWidth = document.documentElement.clientWidth > 0
      ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      : 0;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingInlineEnd = `${scrollbarWidth}px`;
    body.dataset.scrollLocked = 'true';
  }
  activeLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) {
      body.style.overflow = originalOverflow;
      body.style.paddingInlineEnd = originalPaddingInlineEnd;
      delete body.dataset.scrollLocked;
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    return lockBodyScroll();
  }, [active]);
}

export function getActiveBodyScrollLocksForTest() {
  return activeLocks;
}
