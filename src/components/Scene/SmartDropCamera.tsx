import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import type { Vec3Tuple } from '../../types/model';

type CameraSignal = string | number;

export interface SmartDropCameraProps {
  /** Enable assistance for the current drag/drop interaction. */
  active: boolean;
  /** World-space point currently held by the child (a brick or connector centre). */
  heldPosition: Vec3Tuple | null;
  /** World-space point at the predicted contact location. */
  landedPosition: Vec3Tuple | null;
  /**
   * Optional outward normal of the contact face. Supplying this lets the helper
   * reveal a side face as well as the held-to-landed path.
   */
  contactNormal?: Vec3Tuple | null;
  /** Change this when a new drag starts, even if `active` never becomes false. */
  interactionSignal?: CameraSignal;
  /** Change this after HOME/TOP/FRONT/SIDE resets so the new view is the anchor. */
  resetSignal?: CameraSignal;
  /** Maximum orbit applied during one interaction. Defaults to 10 degrees. */
  maxRotationDegrees?: number;
  /** Maximum target translation during one interaction, in millimetres. */
  maxTargetShift?: number;
}

interface AssistanceSession {
  target: Vector3;
  spherical: Spherical;
}

interface ScratchVectors {
  held: Vector3;
  landed: Vector3;
  focus: Vector3;
  offset: Vector3;
  desiredTarget: Vector3;
  desiredCamera: Vector3;
  normal: Vector3;
  spherical: Spherical;
}

const MIN_HELPER_POLAR_ANGLE = MathUtils.degToRad(32);
const MAX_HELPER_POLAR_ANGLE = MathUtils.degToRad(72);
const DEFAULT_MAX_ROTATION = 10;
const DEFAULT_MAX_TARGET_SHIFT = 18;
const TARGET_RESPONSE = 3.2;
const CAMERA_RESPONSE = 2.4;
const POSITION_EPSILON_SQ = 0.0001;

function isOrbitControls(value: unknown): value is OrbitControlsImpl {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OrbitControlsImpl>;
  return candidate.target instanceof Vector3 && typeof candidate.update === 'function';
}

function shortestAngleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

function clampAngularChange(from: number, to: number, maximum: number): number {
  return from + MathUtils.clamp(shortestAngleDelta(from, to), -maximum, maximum);
}

/**
 * A deliberately small, optional camera nudge for gravity/snap previews.
 *
 * It consumes the default Drei OrbitControls installed by CameraRig. Camera
 * position and target are only eased within a bounded envelope captured at the
 * beginning of an interaction. Ending a drag leaves the camera exactly where
 * it arrived, and a manual OrbitControls gesture pauses assistance for the rest
 * of that interaction.
 */
export function SmartDropCamera({
  active,
  heldPosition,
  landedPosition,
  contactNormal = null,
  interactionSignal,
  resetSignal,
  maxRotationDegrees = DEFAULT_MAX_ROTATION,
  maxTargetShift = DEFAULT_MAX_TARGET_SHIFT,
}: SmartDropCameraProps) {
  const camera = useThree((state) => state.camera);
  const defaultControls = useThree((state) => state.controls);
  const controls = isOrbitControls(defaultControls) ? defaultControls : null;
  const session = useRef<AssistanceSession | null>(null);
  const pausedByUser = useRef(false);
  const isActive = useRef(active);
  const scratch = useRef<ScratchVectors>({
    held: new Vector3(),
    landed: new Vector3(),
    focus: new Vector3(),
    offset: new Vector3(),
    desiredTarget: new Vector3(),
    desiredCamera: new Vector3(),
    normal: new Vector3(),
    spherical: new Spherical(),
  });

  isActive.current = active;

  useEffect(() => {
    // Capture the anchor lazily on the next frame. CameraRig's reset effect can
    // therefore finish first when resetSignal changes in the same React commit.
    session.current = null;
    pausedByUser.current = false;
  }, [active, controls, interactionSignal, resetSignal]);

  useEffect(() => {
    if (!controls) return undefined;

    const pauseAssistance = () => {
      if (isActive.current) pausedByUser.current = true;
    };

    controls.addEventListener('start', pauseAssistance);
    return () => controls.removeEventListener('start', pauseAssistance);
  }, [controls]);

  useFrame((_state, delta) => {
    if (
      !active
      || pausedByUser.current
      || !controls
      || !heldPosition
      || !landedPosition
    ) return;

    if (!session.current) {
      scratch.current.offset.copy(camera.position).sub(controls.target);
      session.current = {
        target: controls.target.clone(),
        spherical: new Spherical().setFromVector3(scratch.current.offset),
      };
    }

    const anchor = session.current;
    const work = scratch.current;
    work.held.set(...heldPosition);
    work.landed.set(...landedPosition);

    // Bias toward contact while retaining enough of the fall path in frame.
    work.focus.copy(work.held).multiplyScalar(0.42).addScaledVector(work.landed, 0.58);
    work.offset.copy(work.focus).sub(anchor.target);
    const targetLimit = Math.max(0, maxTargetShift);
    if (work.offset.lengthSq() > targetLimit * targetLimit) {
      work.offset.setLength(targetLimit);
    }
    work.desiredTarget.copy(anchor.target).add(work.offset);

    const maxRotation = MathUtils.degToRad(Math.max(0, maxRotationDegrees));
    let desiredPhi = anchor.spherical.phi;
    if (desiredPhi < MIN_HELPER_POLAR_ANGLE) {
      desiredPhi = Math.min(MIN_HELPER_POLAR_ANGLE, desiredPhi + maxRotation);
    } else if (desiredPhi > MAX_HELPER_POLAR_ANGLE) {
      desiredPhi = Math.max(MAX_HELPER_POLAR_ANGLE, desiredPhi - maxRotation);
    }
    desiredPhi = MathUtils.clamp(
      desiredPhi,
      Math.max(controls.minPolarAngle, 0.001),
      Math.min(controls.maxPolarAngle, Math.PI - 0.001),
    );

    let desiredTheta = anchor.spherical.theta;
    if (contactNormal) {
      work.normal.set(...contactNormal);
      work.normal.y = 0;
      if (work.normal.lengthSq() > 0.000001) {
        work.normal.normalize();
        const faceTheta = Math.atan2(work.normal.x, work.normal.z);
        desiredTheta = clampAngularChange(desiredTheta, faceTheta, maxRotation);
        desiredTheta = MathUtils.clamp(
          desiredTheta,
          controls.minAzimuthAngle,
          controls.maxAzimuthAngle,
        );
      }
    }

    work.spherical.set(anchor.spherical.radius, desiredPhi, desiredTheta);
    work.desiredCamera.setFromSpherical(work.spherical).add(work.desiredTarget);

    // Exponential easing is frame-rate independent. The dead band prevents the
    // helper from continuously rewriting a settled OrbitControls camera.
    const targetAlpha = 1 - Math.exp(-TARGET_RESPONSE * Math.min(delta, 0.1));
    const cameraAlpha = 1 - Math.exp(-CAMERA_RESPONSE * Math.min(delta, 0.1));
    let changed = false;
    if (controls.target.distanceToSquared(work.desiredTarget) > POSITION_EPSILON_SQ) {
      controls.target.lerp(work.desiredTarget, targetAlpha);
      changed = true;
    }
    if (camera.position.distanceToSquared(work.desiredCamera) > POSITION_EPSILON_SQ) {
      camera.position.lerp(work.desiredCamera, cameraAlpha);
      changed = true;
    }
    if (changed) camera.lookAt(controls.target);
  });

  return null;
}
