'use client';
import { useEffect, useState } from 'react';

export function useViewportWidth(): number {
  const [w, setW] = useState<number>(0);
  useEffect(() => {
    const update = () => setW(window.innerWidth);
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  return w;
}
