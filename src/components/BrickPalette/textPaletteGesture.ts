export interface PalettePointer {
  pointerId: number;
  clientX: number;
  clientY: number;
}

/** A small movement is a click. On phones horizontal swipes browse the basket. */
export function createTextPaletteGesture() {
  let start: PalettePointer | null = null;
  let horizontalScroll = false;
  let phase: 'pending' | 'drag' | 'scroll' = 'pending';
  return {
    start(point: PalettePointer, allowHorizontalScroll: boolean) {
      start = point;
      horizontalScroll = allowHorizontalScroll;
      phase = 'pending';
    },
    move(point: PalettePointer) {
      if (!start || point.pointerId !== start.pointerId) return 'idle' as const;
      const dx = Math.abs(point.clientX - start.clientX);
      const dy = Math.abs(point.clientY - start.clientY);
      if (phase === 'pending' && Math.max(dx, dy) >= 7) {
        phase = horizontalScroll && dx > dy ? 'scroll' : 'drag';
      }
      return phase;
    },
    finish(point: PalettePointer) {
      const result = this.move(point);
      if (result !== 'idle') start = null;
      return result;
    },
    cancel() { start = null; },
  };
}
