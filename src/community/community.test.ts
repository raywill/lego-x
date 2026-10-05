import { describe, expect, it } from 'vitest';
import { validatePublishedProject } from '../../shared/community';

const brick = (id: string, definitionId = 'cube-1') => ({
  id,
  definitionId,
  position: [0, 5, 0],
  rotation: [0, 0, 0],
});

describe('published community project validation', () => {
  it('accepts a v2 snapshot and preserves remix provenance', () => {
    const project = validatePublishedProject({
      version: 2,
      catalogVersion: 1,
      bricks: [brick('a')],
      connections: [],
      provenance: { sourceWorkId: 'work-a', sourceVersionId: 'version-a' },
    });
    expect(project.provenance?.sourceWorkId).toBe('work-a');
    expect(project.catalogVersion).toBe(1);
  });

  it('rejects duplicate IDs, unknown definitions and self-connections', () => {
    expect(() => validatePublishedProject({ version: 1, bricks: [brick('a'), brick('a')], connections: [] })).toThrow(/ID/);
    expect(() => validatePublishedProject({ version: 1, bricks: [brick('a', 'not-a-brick')], connections: [] })).toThrow(/类型/);
    expect(() => validatePublishedProject({ version: 1, bricks: [brick('a')], connections: [{ brickA: 'a', connectorA: 'x', brickB: 'a', connectorB: 'y' }] })).toThrow(/同一/);
  });

  it('rejects non-finite transforms', () => {
    expect(() => validatePublishedProject({ version: 1, bricks: [{ ...brick('a'), position: [0, Number.NaN, 0] }], connections: [] })).toThrow(/变换/);
  });
});
