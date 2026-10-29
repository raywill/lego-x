import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createTextPaletteGesture } from './textPaletteGesture';

function isCanvasTarget(x: number, y: number): boolean {
  return Boolean(document.elementFromPoint(x, y)?.matches('.scene-panel canvas'));
}

export function useTextPaletteDrag(disabled: boolean, openForm: () => void) {
  const gesture = useRef(createTextPaletteGesture());
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; overCanvas: boolean } | null>(null);

  useEffect(() => {
    const cancel = () => {
      gesture.current.cancel();
      suppressClick.current = true;
      setGhost(null);
    };
    if (disabled) { cancel(); return; }
    const move = (event: PointerEvent) => {
      const phase = gesture.current.move(event);
      if (phase === 'scroll') suppressClick.current = true;
      if (phase !== 'drag') return;
      event.preventDefault();
      suppressClick.current = true;
      setGhost({ x: event.clientX, y: event.clientY, overCanvas: isCanvasTarget(event.clientX, event.clientY) });
    };
    const up = (event: PointerEvent) => {
      const phase = gesture.current.finish(event);
      if (phase === 'idle') return;
      setGhost(null);
      if (phase === 'pending') return; // Let the button's normal click open the form.
      suppressClick.current = true;
      if (phase === 'drag' && isCanvasTarget(event.clientX, event.clientY)) openForm();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { suppressClick.current = true; cancel(); }
    };
    const pointerCancel = (event: PointerEvent) => {
      if (gesture.current.move(event) !== 'idle') { suppressClick.current = true; cancel(); }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      cancel();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [disabled, openForm]);

  return {
    ghost,
    onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
      if (disabled || event.button !== 0 || !event.isPrimary) return;
      suppressClick.current = false;
      gesture.current.start({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
        event.pointerType === 'touch' && window.matchMedia('(max-width: 780px)').matches);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      // Keyboard activation remains available after a cancelled pointer gesture.
      if (!disabled && (event.detail === 0 || !suppressClick.current)) openForm();
    },
  };
}
