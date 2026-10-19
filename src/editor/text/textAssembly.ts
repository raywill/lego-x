import { Group } from 'three';
import type { BrickInstance, TextDecoration } from '../../types/model';
import { createTextMesh } from './textGeometry';

export function addTextsToAssembly(assembly: Group, bricks: readonly BrickInstance[], texts: readonly TextDecoration[]): void {
  for (const text of texts) {
    const host = bricks.find((brick) => brick.id === text.hostBrickId);
    if (!host) continue;
    const parent = new Group();
    parent.position.set(...host.position);
    parent.rotation.set(...host.rotation);
    parent.add(createTextMesh(text));
    assembly.add(parent);
  }
}
