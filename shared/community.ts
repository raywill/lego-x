import type { ProjectSnapshot } from '../src/types/model';

export const COMMUNITY_CATALOG_VERSION = 2 as const;
export const MAX_PUBLISHED_BRICKS = 500;
export const MAX_PROJECT_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 250 * 1024;
export const KNOWN_BRICK_DEFINITION_IDS = new Set([
  'cube-1', 'mini-cube', 'block-1x2', 'block-2x2', 'block-2x4', 'beam-long', 'plate-1x1', 'plate-1x2', 'plate-3x3', 'plate-1x6',
  'cylinder', 'cone-1', 'cone-2', 'disc', 'rod', 'ring', 'triangle-prism', 'right-triangle-prism', 'wedge', 'roof-wedge',
  'trapezoid-prism', 'half-cylinder', 'hemisphere', 'sphere', 'frame-square', 'frame-circle', 'frame-arch', 'block-concave-arc',
  'block-sphere-octant-cutout', 'quarter-cylinder', 'wheel', 'axle', 'hinge', 'wheel-large', 'circular-handle',
]);

export type WorkStatus = 'published' | 'unpublished' | 'hidden';

export interface RemixOrigin {
  sourceWorkId: string;
  sourceVersionId: string;
}

export interface PublishedProject extends ProjectSnapshot {
  version: number;
  catalogVersion: number;
  provenance?: RemixOrigin;
}

export interface PublicProfile {
  publicId: string;
  nickname: string;
  works: PublicWorkSummary[];
}

export interface PublicWorkSummary {
  id: string;
  title: string;
  author: { publicId: string; nickname: string };
  thumbnailUrl: string;
  publishedAt: string;
  brickCount: number;
  connectionCount: number;
  remixOf?: { workId: string; versionId: string; authorNickname: string };
  likes: number;
  remixes: number;
  views: number;
  hotScore?: number;
  likedByViewer?: boolean;
}

export interface PublicWork extends PublicWorkSummary {
  versionId: string;
  project: PublishedProject;
  sourceStatus?: WorkStatus;
}

export interface CurrentUser {
  userId: string;
  publicId: string;
  nickname: string;
  guardianApproved: boolean;
}

export function validatePublishedProject(value: unknown): PublishedProject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('作品数据格式不正确');
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 && candidate.version !== 2) throw new Error('暂不支持这个作品版本');
  if (!Array.isArray(candidate.bricks) || !Array.isArray(candidate.connections)) throw new Error('作品缺少积木或连接');
  if (candidate.bricks.length > MAX_PUBLISHED_BRICKS) throw new Error('作品积木数量太多');
  const ids = new Set<string>();
  for (const item of candidate.bricks) {
    if (!item || typeof item !== 'object') throw new Error('积木数据格式不正确');
    const brick = item as Record<string, unknown>;
    if (typeof brick.id !== 'string' || ids.has(brick.id)) throw new Error('积木 ID 不正确');
    if (typeof brick.definitionId !== 'string' || !KNOWN_BRICK_DEFINITION_IDS.has(brick.definitionId)) throw new Error('积木类型不正确');
    if (!Array.isArray(brick.position) || !Array.isArray(brick.rotation)) throw new Error('积木位置不正确');
    if (brick.position.length !== 3 || brick.rotation.length !== 3) throw new Error('积木位置不正确');
    if ([...brick.position, ...brick.rotation].some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
      throw new Error('积木变换不正确');
    }
    ids.add(brick.id);
  }
  for (const item of candidate.connections) {
    if (!item || typeof item !== 'object') throw new Error('连接数据格式不正确');
    const connection = item as Record<string, unknown>;
    if (![connection.brickA, connection.connectorA, connection.brickB, connection.connectorB].every((v) => typeof v === 'string')) {
      throw new Error('连接数据格式不正确');
    }
    if (connection.brickA === connection.brickB) throw new Error('连接不能指向同一块积木');
    if (!ids.has(connection.brickA as string) || !ids.has(connection.brickB as string)) throw new Error('连接引用了不存在的积木');
  }
  const provenance = candidate.provenance;
  if (provenance !== undefined) {
    if (!provenance || typeof provenance !== 'object') throw new Error('二创来源格式不正确');
    const origin = provenance as Record<string, unknown>;
    if (typeof origin.sourceWorkId !== 'string' || typeof origin.sourceVersionId !== 'string') throw new Error('二创来源格式不正确');
  }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (jsonBytes > MAX_PROJECT_JSON_BYTES) throw new Error('作品文件太大');
  return {
    version: Number(candidate.version),
    catalogVersion: typeof candidate.catalogVersion === 'number' ? candidate.catalogVersion : COMMUNITY_CATALOG_VERSION,
    bricks: candidate.bricks as PublishedProject['bricks'],
    connections: candidate.connections as PublishedProject['connections'],
    ...(provenance ? { provenance: provenance as RemixOrigin } : {}),
  };
}
