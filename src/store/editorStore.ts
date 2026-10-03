import { create } from 'zustand';
import {
  BRICK_UNIT,
  HISTORY_LIMIT,
  PROJECT_STORAGE_KEY,
  ROTATION_STEP,
} from '../config/brickConfig';
import { getBrickDefinition } from '../bricks/catalog';
import { getBrickGroundY } from '../bricks/geometry';
import {
  cloneProjectSnapshot,
  deserializeProject,
  isConnectionValid,
  removeConnectionsForBrick,
  serializeProject,
} from '../editor/projectModel';
import type { DropResult } from '../editor/gravity/dropEngine';
import type { SnapCandidate } from '../editor/snapping/snapEngine';
import type {
  BrickInstance,
  Connection,
  EulerTuple,
  ProjectSnapshot,
  Vec3Tuple,
} from '../types/model';

export type RotationDirection = 'left' | 'right' | -1 | 1;

export interface DragState {
  phase: 'dragging' | 'dropping';
  source: 'palette' | 'brick';
  definitionId: string;
  brickId: string;
  preview: BrickInstance;
  candidate: SnapCandidate | null;
  drop: DropResult | null;
  overScene: boolean;
  planeY: number;
  pointerStart: [number, number] | null;
  pointerId: number | null;
  grabOffset: Vec3Tuple;
  hasMoved: boolean;
  freeRotation: EulerTuple;
}

export type EditorDragState = DragState;

export interface EditorStore {
  bricks: BrickInstance[];
  connections: Connection[];
  selectedId: string | null;
  past: ProjectSnapshot[];
  future: ProjectSnapshot[];
  drag: EditorDragState | null;
  toast: string | null;

  addBrick: (
    definitionId: string,
    position?: Vec3Tuple,
    rotation?: EulerTuple,
    color?: string,
  ) => string | null;
  selectBrick: (id: string | null) => void;
  rotateSelected: (direction: RotationDirection) => void;
  duplicateSelected: () => string | null;
  deleteSelected: () => void;
  clearProject: () => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => boolean;
  loadProject: () => boolean;
  startPaletteDrag: (
    definitionId: string,
    pointerStart?: [number, number],
    pointerId?: number,
  ) => void;
  startBrickDrag: (
    brickId: string,
    pointerStart?: [number, number],
    pointerId?: number,
    grabOffset?: Vec3Tuple,
  ) => void;
  updateDragPreview: (
    preview: BrickInstance,
    candidate: SnapCandidate | null,
    overScene?: boolean,
    hasMoved?: boolean,
    drop?: DropResult | null,
  ) => void;
  beginDropAnimation: () => void;
  updateDropAnimationPreview: (preview: BrickInstance) => void;
  commitDrag: (connection?: Connection) => void;
  cancelDrag: () => void;
  setToast: (toast: string | null) => void;
}

const makeBrickId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  return randomUuid
    ? `brick-${randomUuid()}`
    : `brick-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const cloneBrick = (brick: BrickInstance): BrickInstance => ({
  ...brick,
  position: [...brick.position],
  rotation: [...brick.rotation],
});

const snapshotOf = (state: Pick<EditorStore, 'bricks' | 'connections'>): ProjectSnapshot =>
  cloneProjectSnapshot({ bricks: state.bricks, connections: state.connections });

const appendHistory = (
  history: readonly ProjectSnapshot[],
  snapshot: ProjectSnapshot,
): ProjectSnapshot[] => [...history, snapshot].slice(-HISTORY_LIMIT);

const normaliseQuarterTurn = (angle: number): number => {
  const fullTurn = Math.PI * 2;
  let value = angle % fullTurn;
  if (value > Math.PI) value -= fullTurn;
  if (value <= -Math.PI) value += fullTurn;
  return Math.abs(value) < 1e-10 ? 0 : value;
};

const sameTuple = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const connectionKey = (connection: Connection): string => {
  const left = `${connection.brickA}\u0000${connection.connectorA}`;
  const right = `${connection.brickB}\u0000${connection.connectorB}`;
  return left < right ? `${left}\u0001${right}` : `${right}\u0001${left}`;
};

const validConnection = (
  connection: Connection,
  bricks: readonly BrickInstance[],
  draggedBrickId: string,
  existingConnections: readonly Connection[],
): boolean => {
  if (
    connection.brickA === connection.brickB ||
    (connection.brickA !== draggedBrickId && connection.brickB !== draggedBrickId)
  ) {
    return false;
  }

  return isConnectionValid(connection, bricks, existingConnections);
};

const withCommittedProject = (
  state: EditorStore,
  bricks: BrickInstance[],
  connections: Connection[],
  extras: Partial<EditorStore> = {},
): Partial<EditorStore> => ({
  bricks,
  connections,
  past: appendHistory(state.past, snapshotOf(state)),
  future: [],
  drag: null,
  ...extras,
});

export const useEditorStore = create<EditorStore>((set, get) => ({
  bricks: [],
  connections: [],
  selectedId: null,
  past: [],
  future: [],
  drag: null,
  toast: null,

  addBrick: (definitionId, position, rotation = [0, 0, 0], color) => {
    const definition = getBrickDefinition(definitionId);
    if (!definition) {
      set({ toast: '找不到这个积木' });
      return null;
    }

    const id = makeBrickId();
    const brick: BrickInstance = {
      id,
      definitionId,
      position: [...(position ?? [0, getBrickGroundY(definition), 0])],
      rotation: [...rotation],
      ...(color === undefined ? {} : { color }),
    };
    set((state) =>
      withCommittedProject(state, [...state.bricks.map(cloneBrick), brick], [
        ...state.connections.map((connection) => ({ ...connection })),
      ], { selectedId: id }),
    );
    return id;
  },

  selectBrick: (id) => {
    if (id !== null && !get().bricks.some((brick) => brick.id === id)) return;
    set({ selectedId: id });
  },

  rotateSelected: (direction) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const directionMultiplier = direction === 'right' || direction === 1 ? 1 : -1;
    set((state) => {
      if (!state.bricks.some((brick) => brick.id === selectedId)) return state;
      const bricks = state.bricks.map((brick): BrickInstance => {
        if (brick.id !== selectedId) return cloneBrick(brick);
        const rotation: EulerTuple = [
          brick.rotation[0],
          normaliseQuarterTurn(brick.rotation[1] + directionMultiplier * ROTATION_STEP),
          brick.rotation[2],
        ];
        return { ...cloneBrick(brick), rotation };
      });
      return withCommittedProject(
        state,
        bricks,
        removeConnectionsForBrick(state.connections, selectedId),
      );
    });
  },

  duplicateSelected: () => {
    const { selectedId, bricks } = get();
    const source = bricks.find((brick) => brick.id === selectedId);
    if (!source) return null;

    const id = makeBrickId();
    const duplicate: BrickInstance = {
      ...cloneBrick(source),
      id,
      position: [
        source.position[0] + BRICK_UNIT,
        source.position[1],
        source.position[2] + BRICK_UNIT,
      ],
    };
    set((state) =>
      withCommittedProject(
        state,
        [...state.bricks.map(cloneBrick), duplicate],
        state.connections.map((connection) => ({ ...connection })),
        { selectedId: id },
      ),
    );
    return id;
  },

  deleteSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;
    set((state) => {
      if (!state.bricks.some((brick) => brick.id === selectedId)) return state;
      return withCommittedProject(
        state,
        state.bricks.filter((brick) => brick.id !== selectedId).map(cloneBrick),
        removeConnectionsForBrick(state.connections, selectedId),
        { selectedId: null },
      );
    });
  },

  clearProject: () => {
    set((state) => {
      if (state.bricks.length === 0 && state.connections.length === 0) {
        return { selectedId: null, drag: null };
      }
      return withCommittedProject(state, [], [], { selectedId: null });
    });
  },

  undo: () => {
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const restored = cloneProjectSnapshot(previous);
      return {
        bricks: restored.bricks,
        connections: restored.connections,
        selectedId: null,
        past: state.past.slice(0, -1),
        future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT),
        drag: null,
      };
    });
  },

  redo: () => {
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      const restored = cloneProjectSnapshot(next);
      return {
        bricks: restored.bricks,
        connections: restored.connections,
        selectedId: null,
        past: appendHistory(state.past, snapshotOf(state)),
        future: state.future.slice(1),
        drag: null,
      };
    });
  },

  saveProject: () => {
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage is unavailable.');
      const state = get();
      localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(snapshotOf(state)));
      set({ toast: '作品已保存' });
      return true;
    } catch {
      set({ toast: '保存失败，请检查浏览器存储设置' });
      return false;
    }
  },

  loadProject: () => {
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage is unavailable.');
      const serialized = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (serialized === null) {
        set({ toast: '还没有保存的作品' });
        return false;
      }
      const project = deserializeProject(serialized);
      set((state) =>
        withCommittedProject(
          state,
          project.bricks.map(cloneBrick),
          project.connections.map((connection) => ({ ...connection })),
          { selectedId: null, toast: '作品已载入' },
        ),
      );
      return true;
    } catch {
      set({ toast: '载入失败，保存的数据可能已损坏' });
      return false;
    }
  },

  startPaletteDrag: (definitionId, pointerStart, pointerId) => {
    if (get().drag) return;
    const definition = getBrickDefinition(definitionId);
    if (!definition) {
      set({ toast: '找不到这个积木' });
      return;
    }
    const brickId = makeBrickId();
    const groundY = getBrickGroundY(definition);
    set({
      selectedId: null,
      drag: {
        phase: 'dragging',
        source: 'palette',
        brickId,
        definitionId,
        preview: {
          id: brickId,
          definitionId,
          position: [0, groundY, 0],
          rotation: [0, 0, 0],
        },
        candidate: null,
        drop: null,
        overScene: false,
        planeY: groundY,
        pointerStart: pointerStart ?? null,
        pointerId: pointerId ?? null,
        grabOffset: [0, 0, 0],
        hasMoved: false,
        freeRotation: [0, 0, 0],
      },
    });
  },

  startBrickDrag: (brickId, pointerStart, pointerId, grabOffset = [0, 0, 0]) => {
    if (get().drag) return;
    const brick = get().bricks.find((item) => item.id === brickId);
    if (!brick) return;
    set({
      selectedId: brickId,
      drag: {
        phase: 'dragging',
        source: 'brick',
        definitionId: brick.definitionId,
        brickId,
        preview: cloneBrick(brick),
        candidate: null,
        drop: null,
        overScene: true,
        planeY: brick.position[1],
        pointerStart: pointerStart ?? null,
        pointerId: pointerId ?? null,
        grabOffset: [...grabOffset],
        hasMoved: false,
        freeRotation: [...brick.rotation],
      },
    });
  },

  updateDragPreview: (preview, candidate, overScene = true, hasMoved = true, drop = null) => {
    set((state) => {
      if (!state.drag || state.drag.phase !== 'dragging') return state;
      if (preview.id !== state.drag.brickId) return state;
      return {
        drag: {
          ...state.drag,
          preview: cloneBrick(preview),
          candidate,
          drop,
          overScene,
          hasMoved: state.drag.hasMoved || hasMoved,
        },
      };
    });
  },

  beginDropAnimation: () => {
    set((state) => {
      if (!state.drag || state.drag.phase !== 'dragging' || !state.drag.drop) return state;
      return { drag: { ...state.drag, phase: 'dropping' } };
    });
  },

  updateDropAnimationPreview: (preview) => {
    set((state) => {
      if (!state.drag || state.drag.phase !== 'dropping') return state;
      if (preview.id !== state.drag.brickId) return state;
      return { drag: { ...state.drag, preview: cloneBrick(preview) } };
    });
  },

  commitDrag: (connection) => {
    set((state) => {
      const { drag } = state;
      if (!drag) return state;
      const committedConnection =
        connection ?? (drag.candidate?.committable ? drag.candidate.connection : undefined);
      const finalPreview: BrickInstance = drag.candidate?.committable || !drag.drop
        ? cloneBrick(drag.preview)
        : {
            ...cloneBrick(drag.preview),
            position: [...drag.drop.position],
            rotation: [...drag.drop.rotation],
          };

      if (drag.source === 'palette') {
        if (!drag.overScene) return { drag: null };
        const brick = finalPreview;
        const bricks = [...state.bricks.map(cloneBrick), brick];
        const connections = state.connections.map((item) => ({ ...item }));
        if (
          committedConnection &&
          validConnection(committedConnection, bricks, drag.brickId, connections)
        ) {
          const key = connectionKey(committedConnection);
          if (!connections.some((item) => connectionKey(item) === key)) {
            connections.push({ ...committedConnection });
          }
        }
        return withCommittedProject(state, bricks, connections, { selectedId: drag.brickId });
      }

      const original = state.bricks.find((brick) => brick.id === drag.brickId);
      if (!original) return { drag: null };
      const moved =
        !sameTuple(original.position, finalPreview.position) ||
        !sameTuple(original.rotation, finalPreview.rotation);
      if (!moved && !committedConnection) return { drag: null };
      const bricks = state.bricks.map((brick) =>
        brick.id === drag.brickId ? cloneBrick(finalPreview) : cloneBrick(brick),
      );
      const connections = (moved
        ? removeConnectionsForBrick(state.connections, drag.brickId)
        : state.connections.map((item) => ({ ...item }))) as Connection[];
      if (
        committedConnection &&
        validConnection(committedConnection, bricks, drag.brickId, connections)
      ) {
        const key = connectionKey(committedConnection);
        if (!connections.some((item) => connectionKey(item) === key)) {
          connections.push({ ...committedConnection });
        }
      }
      return withCommittedProject(state, bricks, connections, { selectedId: drag.brickId });
    });
  },

  cancelDrag: () => set({ drag: null }),
  setToast: (toast) => set({ toast }),
}));
