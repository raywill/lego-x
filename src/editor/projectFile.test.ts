import { describe, expect, it } from 'vitest';

import {
  LEGOX_DEFAULT_FILENAME,
  LEGOX_FILE_EXTENSION,
  LEGOX_MIME_TYPE,
  createLegoxBlob,
  isLegoxFilename,
  isSavePickerCancellation,
  withLegoxExtension,
} from './projectFile';

describe('legox project files', () => {
  it('uses a dedicated local project filename and MIME type', () => {
    expect(LEGOX_FILE_EXTENSION).toBe('.legox');
    expect(LEGOX_DEFAULT_FILENAME).toMatch(/\.legox$/);
    expect(LEGOX_MIME_TYPE).toBe('application/x-legox+json');
  });

  it('recognizes the extension case-insensitively', () => {
    expect(isLegoxFilename('小汽车.legox')).toBe(true);
    expect(isLegoxFilename('小汽车.LEGOX')).toBe(true);
    expect(isLegoxFilename('小汽车.json')).toBe(false);
  });

  it('adds the legox extension without duplicating it', () => {
    expect(withLegoxExtension('小汽车')).toBe('小汽车.legox');
    expect(withLegoxExtension('小汽车.legox')).toBe('小汽车.legox');
    expect(withLegoxExtension('  ')).toBe(LEGOX_DEFAULT_FILENAME);
  });

  it('builds a versioned legox project blob', async () => {
    const blob = createLegoxBlob({ bricks: [], connections: [] });
    expect(blob.type).toBe(LEGOX_MIME_TYPE);
    expect(JSON.parse(await blob.text())).toEqual({
      version: 1,
      bricks: [],
      connections: [],
    });
  });

  it('recognizes a cancelled native save dialog', () => {
    expect(isSavePickerCancellation({ name: 'AbortError' })).toBe(true);
    expect(isSavePickerCancellation(new Error('disk full'))).toBe(false);
  });
});
