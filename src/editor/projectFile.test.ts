import { describe, expect, it } from 'vitest';

import {
  LEGOX_DEFAULT_FILENAME,
  LEGOX_FILE_EXTENSION,
  LEGOX_MIME_TYPE,
  isLegoxFilename,
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
});
