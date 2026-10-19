import { Euler, Matrix3, Matrix4, Mesh, Quaternion, Raycaster, Vector3 } from 'three';
import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import type { BrickInstance, TextDecoration, Vec3Tuple } from '../../types/model';
import { createTextGeometry } from './textGeometry';

export function textFitsSurface(text: TextDecoration, host: BrickInstance): boolean {
  const definition = getBrickDefinition(host.definitionId);
  if (!definition) return false;
  const normal = new Vector3(0, 0, 1).applyEuler(new Euler(...text.rotation));
  // Only the six axis-aligned, flat local faces are supported in this version.
  if (normal.toArray().filter((n) => Math.abs(n) > 1e-5).length !== 1) return false;
  const body = createBrickGroup(definition, { includeConnectorGeometry: false });
  const geometry = createTextGeometry(text.content, text.size);
  try {
    const bounds = geometry.boundingBox!;
    const matrix = new Matrix4().compose(new Vector3(...text.position), new Quaternion().setFromEuler(new Euler(...text.rotation)), new Vector3(1, 1, 1));
    body.updateMatrixWorld(true);
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const columns = Math.max(1, Math.ceil(width / 0.5));
    const rows = Math.max(1, Math.ceil(height / 0.5));
    const ray = new Raycaster();
    ray.far = 0.35;
    for (let x = 0; x <= columns; x++) for (let y = 0; y <= rows; y++) {
      const contact = new Vector3(bounds.min.x + width * x / columns, bounds.min.y + height * y / rows, 0).applyMatrix4(matrix);
      ray.set(contact.clone().addScaledVector(normal, 0.25), normal.clone().negate());
      const hit = ray.intersectObject(body, true)[0];
      if (!hit?.face || Math.abs(hit.distance - 0.25) > 0.025
        || hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().dot(normal) < 0.999) return false;
    }
    return true;
  } finally {
    geometry.dispose();
    body.traverse((object) => {
      if (object instanceof Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); }
    });
  }
}

export function textRotationForNormal(normal: Vector3): Vec3Tuple {
  // Readable horizontal text for side faces, with stable orientation on top/bottom.
  const up = Math.abs(normal.y) > 0.99 ? new Vector3(0, 0, -Math.sign(normal.y)) : new Vector3(0, 1, 0);
  const right = up.clone().cross(normal).normalize();
  const euler = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(right, normal.clone().cross(right), normal));
  return [euler.x, euler.y, euler.z];
}
