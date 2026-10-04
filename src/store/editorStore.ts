import { create } from 'zustand';
import {
  BRICK_UNIT,
  HISTORY_LIMIT,
  PROJECT_STORAGE_KEY,
} from '../config/brickConfig';
import { getBrickDefinition } from '../bricks/catalog';
import { getBrickGroundY } from '../bricks/geometry';
import {
  brickPairKey,
  findNearestFreeGridPlacement,
  getCollidingBrickIds,
  hasBrickCollision,
  separateOverlappingBricks,
} from '../editor/collision/collisionEngine';
import {
  cloneProjectSnapshot,
  deserializeProject,
  isConnectionValid,
  removeConnectionsForBrick,
  serializeProject,
} from '../editor/projectModel';
import type { DropResult } from '../editor/gravity/dropEngine';
import {
  computeDropPlacement,
  keepAssemblyAboveBed,
  keepBrickAboveBed,
} from '../editor/gravity/dropEngine';
import { getBrickBodyBounds, snapBrickToGrid } from '../editor/grid/gridEngine';
import {
  computeKeyboardMove,
  getKeyboardMoveStep,
  type GridDirection,
} from '../editor/movement/keyboardMoveEngine';
import { findNextLowerSelectionPlacement } from '../editor/movement/verticalMoveEngine';
import {
  rotateBrickByWorldQuarterTurn,
  type QuarterTurnDirection,
} from '../editor/rotation/orientationEngine';
import {
  collectConnectedBrickIds,
  duplicateBrickGroup,
  getGroupAnchor,
  placeBrickGroup,
} from '../editor/selection/groupSelection';
import { getWorldConnectors, type SnapCandidate } from '../editor/snapping/snapEngine';
import type {
  BrickInstance,
  Connection,
  EulerTuple,
  ProjectSnapshot,
  Vec3Tuple,
} from '../types/model';

export type RotationDirection = 'left' | 'right' | -1 | 1;
export type FlipDirection = 'up' | 'down';
export type DragPlacementMode = 'insert' | 'top';

export interface DragPlacementOption {
  preview: BrickInstance;
  landing: BrickInstance;
  candidate: SnapCandidate | null;
  drop: DropResult | null;
}

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
  placementMode: DragPlacementMode;
  topOption: DragPlacementOption | null;
  insertOption: DragPlacementOption | null;
  insertionAnchor: Vec3Tuple;
}

export type EditorDragState = DragState;

export interface GroupCopyState {
  bricks: BrickInstance[];
  connections: Connection[];
}

export interface GroupMoveState {
  bricks: BrickInstance[];
  sourceIds: string[];
}

export interface EditorStore {
  bricks: BrickInstance[];
  connections: Connection[];
  selectedId: string | null;
  selectedIds: string[];
  multiSelectMode: boolean;
  groupCopy: GroupCopyState | null;
  groupMove: GroupMoveState | null;
  past: ProjectSnapshot[];
  future: ProjectSnapshot[];
  drag: EditorDragState | null;
  toast: string | null;
  viewRightAxis: GridDirection;

  addBrick: (
    definitionId: string,
    position?: Vec3Tuple,
    rotation?: EulerTuple,
    color?: string,
  ) => string | null;
  selectBrick: (id: string | null) => void;
  setMultiSelectMode: (enabled: boolean) => void;
  toggleBrickSelection: (id: string) => void;
  setSelectedBricks: (ids: readonly string[]) => void;
  selectConnectedBricks: () => void;
  startGroupCopy: () => boolean;
  startGroupMove: () => boolean;
  updateGroupPlacement: (targetXZ: readonly [number, number]) => void;
  commitGroupPlacement: () => void;
  cancelGroupPlacement: () => void;
  moveSelectionByGridStep: (direction: GridDirection) => boolean;
  lowerSelectionOneLevel: () => boolean;
  rotateSelected: (direction: RotationDirection) => void;
  flipSelected: (direction: FlipDirection) => void;
  moveSelectedByGridStep: (direction: GridDirection) => boolean;
  setViewRightAxis: (axis: GridDirection) => void;
  setSelectedColor: (color?: string) => void;
  duplicateSelected: () => string | null;
  deleteSelected: () => void;
  clearProject: () => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => boolean;
  loadProject: () => boolean;
  importProject: (serialized: string) => boolean;
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
  updateDragPlacement: (
    topOption: DragPlacementOption,
    insertOption: DragPlacementOption | null,
    overScene: boolean,
    hasMoved: boolean,
    insertionAnchor?: Vec3Tuple,
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

const clonePlacementOption = (option: DragPlacementOption): DragPlacementOption => ({
  preview: cloneBrick(option.preview),
  landing: cloneBrick(option.landing),
  candidate: option.candidate,
  drop: option.drop ? {
    ...option.drop,
    position: [...option.drop.position],
    rotation: [...option.drop.rotation],
    contact: {
      ...option.drop.contact,
      polygon: option.drop.contact.polygon.map((point) => [...point]) as typeof option.drop.contact.polygon,
    },
  } : null,
});

const safeBrick = (brick: BrickInstance): BrickInstance =>
  keepBrickAboveBed(snapBrickToGrid(cloneBrick(brick)));

const normaliseProject = (
  bricks: readonly BrickInstance[],
  connections: readonly Connection[],
): ProjectSnapshot => {
  const alignedBricks = keepAssemblyAboveBed(bricks.map(safeBrick));
  const alignedConnections: Connection[] = [];
  for (const connection of connections) {
    if (isConnectionValid(connection, alignedBricks, alignedConnections)) {
      alignedConnections.push({ ...connection });
    }
  }
  const connectedPairs = new Set(alignedConnections
    .filter((connection) => connectionUsesSlopedSurface(connection, alignedBricks))
    .map((connection) => brickPairKey(connection.brickA, connection.brickB)));
  const collisionFreeBricks = separateOverlappingBricks(alignedBricks, connectedPairs);
  const validConnections: Connection[] = [];
  for (const connection of alignedConnections) {
    if (isConnectionValid(connection, collisionFreeBricks, validConnections)) {
      validConnections.push({ ...connection });
    }
  }
  return { bricks: collisionFreeBricks, connections: validConnections };
};

const snapshotOf = (state: Pick<EditorStore, 'bricks' | 'connections'>): ProjectSnapshot =>
  cloneProjectSnapshot({ bricks: state.bricks, connections: state.connections });

const appendHistory = (
  history: readonly ProjectSnapshot[],
  snapshot: ProjectSnapshot,
): ProjectSnapshot[] => [...history, snapshot].slice(-HISTORY_LIMIT);

const sameTuple = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const connectionKey = (connection: Connection): string => {
  const left = `${connection.brickA}\u0000${connection.connectorA}`;
  const right = `${connection.brickB}\u0000${connection.connectorB}`;
  return left < right ? `${left}\u0001${right}` : `${right}\u0001${left}`;
};

const isAxisAlignedNormal = (normal: readonly number[]): boolean =>
  normal.filter((component) => Math.abs(component) > 1e-5).length === 1;

const connectionUsesSlopedSurface = (
  connection: Connection,
  bricks: readonly BrickInstance[],
): boolean => {
  const brickA = bricks.find((brick) => brick.id === connection.brickA);
  const brickB = bricks.find((brick) => brick.id === connection.brickB);
  if (!brickA || !brickB) return false;
  const definitionA = getBrickDefinition(brickA.definitionId);
  const definitionB = getBrickDefinition(brickB.definitionId);
  if (!definitionA || !definitionB) return false;
  const connectorA = getWorldConnectors(brickA, definitionA)
    .find((connector) => connector.connectorId === connection.connectorA);
  const connectorB = getWorldConnectors(brickB, definitionB)
    .find((connector) => connector.connectorId === connection.connectorB);
  return Boolean(
    connectorA && connectorB
    && (!isAxisAlignedNormal(connectorA.normal) || !isAxisAlignedNormal(connectorB.normal)),
  );
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

function rotateAndLand(
  selected: BrickInstance,
  others: readonly BrickInstance[],
  worldAxis: Vec3Tuple,
  direction: QuarterTurnDirection,
): BrickInstance | null {
  const originalBottom = getBrickBodyBounds(selected).min.y;
  const turned = rotateBrickByWorldQuarterTurn(selected, worldAxis, direction);
  const turnedBounds = getBrickBodyBounds(turned);
  const held = keepBrickAboveBed(snapBrickToGrid({
    ...turned,
    position: [
      turned.position[0],
      turned.position[1] + originalBottom - turnedBounds.min.y,
      turned.position[2],
    ],
    rotation: [...turned.rotation],
  }));
  const drop = computeDropPlacement(held, others);
  const landed = safeBrick({
    ...held,
    position: [...drop.position],
    rotation: [...drop.rotation],
  });
  return hasBrickCollision(landed, others) ? null : landed;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  bricks: [],
  connections: [],
  selectedId: null,
  selectedIds: [],
  multiSelectMode: false,
  groupCopy: null,
  groupMove: null,
  past: [],
  future: [],
  drag: null,
  toast: null,
  viewRightAxis: [1, 0],

  addBrick: (definitionId, position, rotation = [0, 0, 0], color) => {
    const definition = getBrickDefinition(definitionId);
    if (!definition) {
      set({ toast: '找不到这个积木' });
      return null;
    }

    const id = makeBrickId();
    const brick = safeBrick({
      id,
      definitionId,
      position: [...(position ?? [0, getBrickGroundY(definition), 0])],
      rotation: [...rotation],
      ...(color === undefined ? {} : { color }),
    });
    set((state) => {
      const placedBrick = findNearestFreeGridPlacement(brick, state.bricks);
      return withCommittedProject(state, [...state.bricks.map(cloneBrick), placedBrick], [
        ...state.connections.map((connection) => ({ ...connection })),
      ], { selectedId: id, selectedIds: [id], multiSelectMode: false });
    });
    return id;
  },

  selectBrick: (id) => {
    if (id !== null && !get().bricks.some((brick) => brick.id === id)) return;
    set({
      selectedId: id,
      selectedIds: id ? [id] : [],
      multiSelectMode: false,
    });
  },

  setMultiSelectMode: (enabled) => {
    set((state) => {
      if (state.drag || state.groupCopy || state.groupMove) return state;
      return {
        multiSelectMode: enabled,
        selectedIds: enabled
          ? state.selectedIds.length > 0
            ? [...state.selectedIds]
            : state.selectedId ? [state.selectedId] : []
          : state.selectedId ? [state.selectedId] : [],
      };
    });
  },

  toggleBrickSelection: (id) => {
    set((state) => {
      if (!state.bricks.some((brick) => brick.id === id)) return state;
      if (!state.multiSelectMode) {
        return { selectedId: id, selectedIds: [id] };
      }
      const selected = new Set(state.selectedIds);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      const selectedIds = [...selected];
      return {
        selectedIds,
        selectedId: selectedIds.at(-1) ?? null,
      };
    });
  },

  setSelectedBricks: (ids) => {
    set((state) => {
      const existing = new Set(state.bricks.map((brick) => brick.id));
      const selectedIds = [...new Set(ids)].filter((id) => existing.has(id));
      return {
        selectedIds,
        selectedId: selectedIds.at(-1) ?? null,
      };
    });
  },

  selectConnectedBricks: () => {
    set((state) => {
      const seeds = state.selectedIds.length > 0
        ? state.selectedIds
        : state.selectedId ? [state.selectedId] : [];
      if (seeds.length === 0) return state;
      const selectedIds = collectConnectedBrickIds(seeds, state.connections)
        .filter((id) => state.bricks.some((brick) => brick.id === id));
      return {
        selectedIds,
        selectedId: selectedIds.at(-1) ?? null,
        multiSelectMode: true,
        toast: selectedIds.length > seeds.length
          ? `已选中 ${selectedIds.length} 块相连积木`
          : '没有找到更多相连积木',
      };
    });
  },

  startGroupCopy: () => {
    const state = get();
    const selectedIds = state.selectedIds.length > 0
      ? state.selectedIds
      : state.selectedId ? [state.selectedId] : [];
    if (selectedIds.length === 0 || state.drag || state.groupCopy || state.groupMove) return false;
    const duplicated = duplicateBrickGroup(
      state.bricks,
      state.connections,
      selectedIds,
      makeBrickId,
    );
    if (duplicated.bricks.length === 0) return false;
    const anchor = getGroupAnchor(duplicated.bricks);
    const copies = placeBrickGroup(
      duplicated.bricks,
      state.bricks,
      [anchor[0] + BRICK_UNIT, anchor[2] + BRICK_UNIT],
    );
    set({
      groupCopy: { bricks: copies, connections: duplicated.connections },
      toast: '移动整组副本，点击放下',
    });
    return true;
  },

  startGroupMove: () => {
    const state = get();
    const sourceIds = state.selectedIds.length > 0
      ? state.selectedIds
      : state.selectedId ? [state.selectedId] : [];
    if (sourceIds.length === 0 || state.drag || state.groupCopy || state.groupMove) return false;
    const selected = new Set(sourceIds);
    const bricks = state.bricks.filter((brick) => selected.has(brick.id)).map(cloneBrick);
    if (bricks.length === 0) return false;
    set({
      groupMove: { bricks, sourceIds: bricks.map((brick) => brick.id) },
      toast: '移动整组，点击放下',
    });
    return true;
  },

  updateGroupPlacement: (targetXZ) => {
    set((state) => {
      if (state.groupCopy) {
        return {
          groupCopy: {
            ...state.groupCopy,
            bricks: placeBrickGroup(state.groupCopy.bricks, state.bricks, targetXZ),
          },
        };
      }
      if (!state.groupMove) return state;
      const movedIds = new Set(state.groupMove.sourceIds);
      const obstacles = state.bricks.filter((brick) => !movedIds.has(brick.id));
      return {
        groupMove: {
          ...state.groupMove,
          bricks: placeBrickGroup(state.groupMove.bricks, obstacles, targetXZ),
        },
      };
    });
  },

  commitGroupPlacement: () => {
    set((current) => {
      if (current.groupCopy) {
        const copiedIds = current.groupCopy.bricks.map((brick) => brick.id);
        return withCommittedProject(
          current,
          [...current.bricks.map(cloneBrick), ...current.groupCopy.bricks.map(cloneBrick)],
          [
            ...current.connections.map((connection) => ({ ...connection })),
            ...current.groupCopy.connections.map((connection) => ({ ...connection })),
          ],
          {
            selectedId: copiedIds.at(-1) ?? null,
            selectedIds: copiedIds,
            multiSelectMode: true,
            groupCopy: null,
            groupMove: null,
            toast: `已复制 ${copiedIds.length} 块积木`,
          },
        );
      }
      if (!current.groupMove) return current;
      const movedIds = new Set(current.groupMove.sourceIds);
      const movedById = new Map(current.groupMove.bricks.map((brick) => [brick.id, brick]));
      const changed = current.groupMove.bricks.some((brick) => {
        const original = current.bricks.find((item) => item.id === brick.id);
        return !original || !sameTuple(original.position, brick.position);
      });
      if (!changed) return { groupMove: null, toast: null };
      const bricks = current.bricks.map((brick) => cloneBrick(movedById.get(brick.id) ?? brick));
      const connections = current.connections.filter((connection) => {
        const aMoved = movedIds.has(connection.brickA);
        const bMoved = movedIds.has(connection.brickB);
        return aMoved === bMoved;
      }).map((connection) => ({ ...connection }));
      const sourceIds = [...current.groupMove.sourceIds];
      return withCommittedProject(current, bricks, connections, {
        selectedId: sourceIds.at(-1) ?? null,
        selectedIds: sourceIds,
        multiSelectMode: true,
        groupMove: null,
        toast: `已移动 ${sourceIds.length} 块积木`,
      });
    });
  },

  cancelGroupPlacement: () => set({ groupCopy: null, groupMove: null, toast: null }),

  moveSelectionByGridStep: (direction) => {
    let moved = false;
    set((state) => {
      if (state.drag || state.groupCopy || state.groupMove || state.selectedIds.length < 2) {
        return state;
      }
      const selectedIds = new Set(state.selectedIds);
      const selected = state.bricks.filter((brick) => selectedIds.has(brick.id));
      if (selected.length === 0) return state;
      const obstacles = state.bricks.filter((brick) => !selectedIds.has(brick.id));
      const anchor = getGroupAnchor(selected);
      const step = Math.min(...selected.map(getKeyboardMoveStep));
      const target: [number, number] = [
        anchor[0] + direction[0] * step,
        anchor[2] + direction[1] * step,
      ];
      const placed = placeBrickGroup(selected, obstacles, target);
      const placedById = new Map(placed.map((brick) => [brick.id, brick]));
      if (placed.every((brick) => {
        const original = state.bricks.find((item) => item.id === brick.id);
        return original && sameTuple(original.position, brick.position);
      })) return state;
      moved = true;
      const bricks = state.bricks.map((brick) => cloneBrick(placedById.get(brick.id) ?? brick));
      const connections = state.connections.filter((connection) => {
        const aMoved = selectedIds.has(connection.brickA);
        const bMoved = selectedIds.has(connection.brickB);
        return aMoved === bMoved;
      }).map((connection) => ({ ...connection }));
      return withCommittedProject(state, bricks, connections, {
        selectedId: state.selectedIds.at(-1) ?? null,
        selectedIds: [...state.selectedIds],
        multiSelectMode: true,
      });
    });
    return moved;
  },

  lowerSelectionOneLevel: () => {
    let moved = false;
    set((state) => {
      if (state.drag || state.groupCopy || state.groupMove || !state.selectedId) return state;
      const ids = state.selectedIds.length > 0
        ? [...state.selectedIds]
        : [state.selectedId];
      const selectedIds = new Set(ids);
      const selected = state.bricks.filter((brick) => selectedIds.has(brick.id));
      if (selected.length === 0) return state;
      const obstacles = state.bricks.filter((brick) => !selectedIds.has(brick.id));
      const result = findNextLowerSelectionPlacement(selected, obstacles);
      if (!result) return { toast: '下面没有能放下的空间了' };

      moved = true;
      const loweredById = new Map(result.bricks.map((brick) => [brick.id, brick]));
      const bricks = state.bricks.map((brick) => cloneBrick(loweredById.get(brick.id) ?? brick));
      const connections = state.connections.filter((connection) => {
        const aMoved = selectedIds.has(connection.brickA);
        const bMoved = selectedIds.has(connection.brickB);
        return aMoved === bMoved;
      }).map((connection) => ({ ...connection }));
      return withCommittedProject(state, bricks, connections, {
        selectedId: state.selectedId,
        selectedIds: ids,
        multiSelectMode: state.multiSelectMode,
        toast: result.descendedLayers === 1
          ? '向下移动了一层'
          : `已切换到下方 ${result.descendedLayers} 层的位置`,
      });
    });
    return moved;
  },

  rotateSelected: (direction) => {
    const { selectedId } = get();
    if (!selectedId) return;
    const directionMultiplier = direction === 'right' || direction === 1 ? 1 : -1;
    set((state) => {
      const selected = state.bricks.find((brick) => brick.id === selectedId);
      if (!selected) return state;
      const rotated = rotateAndLand(
        selected,
        state.bricks,
        [0, 1, 0],
        directionMultiplier as QuarterTurnDirection,
      );
      if (!rotated) {
        return { toast: '这里空间不够，积木转不过去' };
      }
      const bricks = state.bricks.map((brick): BrickInstance =>
        brick.id === selectedId ? rotated : cloneBrick(brick));
      return withCommittedProject(
        state,
        bricks,
        removeConnectionsForBrick(state.connections, selectedId),
        { selectedId, selectedIds: [selectedId] },
      );
    });
  },

  flipSelected: (direction) => {
    const { selectedId } = get();
    if (!selectedId) return;
    set((state) => {
      if (state.drag) return state;
      const selected = state.bricks.find((brick) => brick.id === selectedId);
      if (!selected) return state;
      const [axisX, axisZ] = state.viewRightAxis;
      const flipped = rotateAndLand(
        selected,
        state.bricks,
        [axisX, 0, axisZ],
        direction === 'up' ? 1 : -1,
      );
      if (!flipped) {
        return { toast: '这里空间不够，积木翻不过去' };
      }
      const bricks = state.bricks.map((brick): BrickInstance => (
        brick.id === selectedId ? flipped : cloneBrick(brick)
      ));
      return withCommittedProject(
        state,
        bricks,
        removeConnectionsForBrick(state.connections, selectedId),
        { selectedId, selectedIds: [selectedId] },
      );
    });
  },

  moveSelectedByGridStep: (direction) => {
    let moved = false;
    set((state) => {
      if (state.drag || !state.selectedId) return state;
      const selected = state.bricks.find((brick) => brick.id === state.selectedId);
      if (!selected) return state;
      const result = computeKeyboardMove(selected, state.bricks, direction);
      if (!result) return { toast: '这个方向被挡住了，积木过不去' };
      moved = true;
      const bricks = state.bricks.map((brick) =>
        brick.id === selected.id ? cloneBrick(result.brick) : cloneBrick(brick));
      return withCommittedProject(
        state,
        bricks,
        removeConnectionsForBrick(state.connections, selected.id),
        {
          selectedId: selected.id,
          selectedIds: [selected.id],
          toast: result.climbedLayers > 0
            ? `自动向上跨了 ${result.climbedLayers} 层`
            : null,
        },
      );
    });
    return moved;
  },

  setViewRightAxis: (axis) => {
    if (Math.abs(axis[0]) + Math.abs(axis[1]) !== 1) return;
    set((state) => (
      state.viewRightAxis[0] === axis[0] && state.viewRightAxis[1] === axis[1]
        ? state
        : { viewRightAxis: [...axis] as GridDirection }
    ));
  },

  setSelectedColor: (color) => {
    const { selectedId } = get();
    if (!selectedId) return;
    set((state) => {
      const selected = state.bricks.find((brick) => brick.id === selectedId);
      if (!selected || selected.color === color) return state;
      const bricks = state.bricks.map((brick) => {
        const next = cloneBrick(brick);
        if (brick.id !== selectedId) return next;
        if (color === undefined) delete next.color;
        else next.color = color;
        return next;
      });
      return withCommittedProject(
        state,
        bricks,
        state.connections.map((connection) => ({ ...connection })),
        { selectedId, selectedIds: [selectedId] },
      );
    });
  },

  duplicateSelected: () => {
    const { selectedId, bricks } = get();
    const source = bricks.find((brick) => brick.id === selectedId);
    if (!source) return null;

    const id = makeBrickId();
    const requestedDuplicate = safeBrick({
      ...cloneBrick(source),
      id,
      position: [
        source.position[0] + BRICK_UNIT,
        source.position[1],
        source.position[2] + BRICK_UNIT,
      ],
    });
    set((state) => {
      const duplicate = findNearestFreeGridPlacement(requestedDuplicate, state.bricks);
      return withCommittedProject(
        state,
        [...state.bricks.map(cloneBrick), duplicate],
        state.connections.map((connection) => ({ ...connection })),
        { selectedId: id, selectedIds: [id], multiSelectMode: false },
      );
    });
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
        { selectedId: null, selectedIds: [], multiSelectMode: false },
      );
    });
  },

  clearProject: () => {
    set((state) => {
      if (state.bricks.length === 0 && state.connections.length === 0) {
        return {
          selectedId: null,
          selectedIds: [],
          multiSelectMode: false,
          groupCopy: null,
          groupMove: null,
          drag: null,
        };
      }
      return withCommittedProject(state, [], [], {
        selectedId: null,
        selectedIds: [],
        multiSelectMode: false,
        groupCopy: null,
        groupMove: null,
      });
    });
  },

  undo: () => {
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const restored = cloneProjectSnapshot(previous);
      const normalised = normaliseProject(restored.bricks, restored.connections);
      return {
        bricks: normalised.bricks,
        connections: normalised.connections,
        selectedId: null,
        selectedIds: [],
        multiSelectMode: false,
        groupCopy: null,
        groupMove: null,
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
      const normalised = normaliseProject(restored.bricks, restored.connections);
      return {
        bricks: normalised.bricks,
        connections: normalised.connections,
        selectedId: null,
        selectedIds: [],
        multiSelectMode: false,
        groupCopy: null,
        groupMove: null,
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
      const loaded = get().importProject(serialized);
      if (loaded) set({ toast: '作品已载入' });
      return loaded;
    } catch {
      set({ toast: '载入失败，保存的数据可能已损坏' });
      return false;
    }
  },

  importProject: (serialized) => {
    try {
      const project = deserializeProject(serialized);
      const normalised = normaliseProject(project.bricks, project.connections);
      set((state) =>
        withCommittedProject(
          state,
          normalised.bricks,
          normalised.connections,
          {
            selectedId: null,
            selectedIds: [],
            multiSelectMode: false,
            groupCopy: null,
            groupMove: null,
            toast: '作品文件已打开',
          },
        ),
      );
      return true;
    } catch {
      set({ toast: '无法打开：这不是有效的 .legox 作品文件' });
      return false;
    }
  },

  startPaletteDrag: (definitionId, pointerStart, pointerId) => {
    if (get().drag || get().groupCopy || get().groupMove) return;
    const definition = getBrickDefinition(definitionId);
    if (!definition) {
      set({ toast: '找不到这个积木' });
      return;
    }
    const brickId = makeBrickId();
    const groundY = getBrickGroundY(definition);
    set({
      selectedId: null,
      selectedIds: [],
      multiSelectMode: false,
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
        placementMode: 'top',
        topOption: null,
        insertOption: null,
        insertionAnchor: [0, groundY, 0],
      },
    });
  },

  startBrickDrag: (brickId, pointerStart, pointerId, grabOffset = [0, 0, 0]) => {
    if (get().drag || get().groupCopy || get().groupMove || get().multiSelectMode) return;
    const brick = get().bricks.find((item) => item.id === brickId);
    if (!brick) return;
    set({
      selectedId: brickId,
      selectedIds: [brickId],
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
        placementMode: 'top',
        topOption: null,
        insertOption: null,
        insertionAnchor: [...brick.position],
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

  updateDragPlacement: (
    topOption,
    insertOption,
    overScene,
    hasMoved,
    insertionAnchor,
  ) => {
    set((state) => {
      if (!state.drag || state.drag.phase !== 'dragging') return state;
      const placementMode: DragPlacementMode = 'top';
      const selectedOption = topOption;
      return {
        drag: {
          ...state.drag,
          preview: cloneBrick(selectedOption.preview),
          candidate: selectedOption.candidate,
          drop: selectedOption.drop,
          overScene,
          hasMoved: state.drag.hasMoved || hasMoved,
          placementMode,
          topOption: clonePlacementOption(topOption),
          insertOption: insertOption ? clonePlacementOption(insertOption) : null,
          insertionAnchor: insertionAnchor
            ? [...insertionAnchor]
            : [...state.drag.insertionAnchor],
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
      const rawFinalPreview: BrickInstance = drag.candidate?.committable || !drag.drop
        ? cloneBrick(drag.preview)
        : {
            ...cloneBrick(drag.preview),
            position: [...drag.drop.position],
            rotation: [...drag.drop.rotation],
          };
      const finalPreview = safeBrick(rawFinalPreview);
      const snapContactBrickIds = drag.candidate?.committable
        ? new Set([
            { source: drag.candidate.source, target: drag.candidate.target },
            ...drag.candidate.contacts,
          ].filter(({ source, target }) => (
            !isAxisAlignedNormal(source.normal) || !isAxisAlignedNormal(target.normal)
          )).map(({ target }) => target.brickId))
        : new Set<string>();
      const collidingBrickIds = getCollidingBrickIds(
        finalPreview,
        state.bricks,
        snapContactBrickIds,
      );
      if (collidingBrickIds.length > 0) {
        return {
          drag: null,
          selectedId: drag.source === 'brick' ? drag.brickId : state.selectedId,
          selectedIds: drag.source === 'brick' ? [drag.brickId] : state.selectedIds,
          toast: '积木不能互相穿过，请换一个位置',
        };
      }

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
        return withCommittedProject(state, bricks, connections, {
          selectedId: drag.brickId,
          selectedIds: [drag.brickId],
          multiSelectMode: false,
        });
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
      return withCommittedProject(state, bricks, connections, {
        selectedId: drag.brickId,
        selectedIds: [drag.brickId],
        multiSelectMode: false,
      });
    });
  },

  cancelDrag: () => set({ drag: null }),
  setToast: (toast) => set({ toast }),
}));
