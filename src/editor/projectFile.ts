import type { ProjectSnapshot } from '../types/model';
import { serializeProject } from './projectModel';

export const LEGOX_FILE_EXTENSION = '.legox';
export const LEGOX_MIME_TYPE = 'application/x-legox+json';
export const LEGOX_DEFAULT_FILENAME = `我的数字积木${LEGOX_FILE_EXTENSION}`;

export function isLegoxFilename(filename: string): boolean {
  return filename.trim().toLowerCase().endsWith(LEGOX_FILE_EXTENSION);
}

export function downloadLegoxFile(
  project: ProjectSnapshot,
  filename = LEGOX_DEFAULT_FILENAME,
): void {
  const safeFilename = isLegoxFilename(filename)
    ? filename
    : `${filename}${LEGOX_FILE_EXTENSION}`;
  const blob = new Blob([serializeProject(project)], { type: LEGOX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
