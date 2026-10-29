import { describe, expect, it } from 'vitest';
import { createTextPaletteGesture } from './textPaletteGesture';

const point = (clientX = 20, clientY = 30, pointerId = 1) => ({ clientX, clientY, pointerId });

describe('text palette pointer gesture', () => {
  it('leaves a click and minor pointer jitter as normal button activation', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), false);
    expect(gesture.move(point(23, 35))).toBe('pending');
    expect(gesture.finish(point(23, 35))).toBe('pending');
    expect(gesture.finish(point())).toBe('idle');
  });

  it('recognizes dragging right to the desktop canvas and finishes only once', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), false);
    expect(gesture.move(point(200, 30))).toBe('drag');
    expect(gesture.finish(point(400, 80))).toBe('drag');
    expect(gesture.finish(point(400, 80))).toBe('idle');
  });

  it('keeps a drag active when it returns to the starting position', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), false);
    gesture.move(point(200, 30));
    expect(gesture.finish(point())).toBe('drag');
  });

  it('allows horizontal touch swipes to scroll rather than opening a dialog', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), true);
    expect(gesture.move(point(60, 35))).toBe('scroll');
    expect(gesture.finish(point(60, 200))).toBe('scroll');
  });

  it('allows a downward touch drag into the mobile canvas', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), true);
    expect(gesture.move(point(22, 50))).toBe('drag');
    expect(gesture.finish(point(50, 200))).toBe('drag');
  });

  it('ignores other pointers without ending the active drag', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), false);
    expect(gesture.move(point(200, 30, 2))).toBe('idle');
    expect(gesture.finish(point(200, 30, 2))).toBe('idle');
    expect(gesture.finish(point(200, 30))).toBe('drag');
  });

  it('cancels cleanly on Escape, pointer cancellation or losing focus', () => {
    const gesture = createTextPaletteGesture();
    gesture.start(point(), false);
    gesture.move(point(200, 30));
    gesture.cancel();
    expect(gesture.finish(point(400, 80))).toBe('idle');
    gesture.start(point(), false);
    expect(gesture.finish(point())).toBe('pending');
  });
});
