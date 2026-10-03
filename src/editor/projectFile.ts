import type { ProjectSnapshot } from '../types/model';
import { serializeProject } from './projectModel';

export const LEGOX_FILE_EXTENSION = '.legox';
export const LEGOX_MIME_TYPE = 'application/x-legox+json';
export const LEGOX_DEFAULT_FILENAME = `我的数字积木${LEGOX_FILE_EXTENSION}`;

interface LegoxWritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface LegoxFileHandle {
  createWritable(): Promise<LegoxWritableFile>;
}

interface LegoxSavePickerOptions {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

type LegoxPickerWindow = Window & {
  showSaveFilePicker?: (options: LegoxSavePickerOptions) => Promise<LegoxFileHandle>;
};

export type LegoxSaveMethod = 'picker' | 'download';

export function isLegoxFilename(filename: string): boolean {
  return filename.trim().toLowerCase().endsWith(LEGOX_FILE_EXTENSION);
}

export function withLegoxExtension(filename: string): string {
  const trimmed = filename.trim() || LEGOX_DEFAULT_FILENAME;
  return isLegoxFilename(trimmed) ? trimmed : `${trimmed}${LEGOX_FILE_EXTENSION}`;
}

export function createLegoxBlob(project: ProjectSnapshot): Blob {
  return new Blob([serializeProject(project)], { type: LEGOX_MIME_TYPE });
}

export function supportsLegoxSavePicker(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as LegoxPickerWindow).showSaveFilePicker === 'function';
}

export function isSavePickerCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function downloadLegoxFile(
  project: ProjectSnapshot,
  filename = LEGOX_DEFAULT_FILENAME,
): void {
  const safeFilename = withLegoxExtension(filename);
  const blob = createLegoxBlob(project);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Opens the browser's native Save As dialog when available, allowing both the
 * filename and destination folder to be chosen. Other browsers fall back to a
 * regular download using the caller-provided filename.
 */
export async function saveLegoxFile(
  project: ProjectSnapshot,
  filename = LEGOX_DEFAULT_FILENAME,
): Promise<LegoxSaveMethod> {
  const safeFilename = withLegoxExtension(filename);
  const picker = typeof window === 'undefined'
    ? undefined
    : (window as LegoxPickerWindow).showSaveFilePicker;
  if (!picker) {
    downloadLegoxFile(project, safeFilename);
    return 'download';
  }

  const handle = await picker.call(window, {
    suggestedName: safeFilename,
    types: [{
      description: 'LEGOX 数字积木作品',
      accept: { [LEGOX_MIME_TYPE]: [LEGOX_FILE_EXTENSION] },
    }],
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(createLegoxBlob(project));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
  return 'picker';
}
