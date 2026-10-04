import { beforeEach, describe, expect, it } from 'vitest';
import { BRICK_DEFINITIONS } from '../bricks/catalog';
import { ROTATION_STEP } from '../config/brickConfig';
import { computeDropPlacement } from '../editor/gravity/dropEngine';
import { bricksOverlap } from '../editor/collision/collisionEngine';
import { getBrickBodyBounds, isBrickOnGrid } from '../editor/grid/gridEngine';
import { createConnection, serializeProject } from '../editor/projectModel';
import { useEditorStore } from './editorStore';

const definition = BRICK_DEFINITIONS.find((item) => item.connectors.length > 0);
if (!definition) throw new Error('The test catalog needs at least one connector.');

const resetStore = () => {
  useEditorStore.setState({
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
  });
};

describe('editor store', () => {
  beforeEach(resetStore);

  it('rotates the selected brick in 90 degree steps', () => {
    const id = useEditorStore.getState().addBrick(definition.id);
    expect(id).not.toBeNull();

    useEditorStore.getState().rotateSelected('right');
    expect(useEditorStore.getState().bricks[0].rotation[1]).toBeCloseTo(ROTATION_STEP);

    useEditorStore.getState().rotateSelected('left');
    expect(useEditorStore.getState().bricks[0].rotation[1]).toBe(0);
  });

  it('flips relative to the current view, lands on the grid, and stays undoable', () => {
    const id = useEditorStore.getState().addBrick('block-1x2', [0, 5, 5]);
    expect(id).not.toBeNull();
    const before = useEditorStore.getState().bricks[0];

    useEditorStore.getState().setViewRightAxis([0, 1]);
    useEditorStore.getState().flipSelected('up');
    const flipped = useEditorStore.getState().bricks[0];
    expect(flipped.rotation).not.toEqual(before.rotation);
    expect(flipped.position[1]).toBeCloseTo(10);
    expect(getBrickBodyBounds(flipped).min.y).toBeCloseTo(0);
    expect(isBrickOnGrid(flipped)).toBe(true);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks[0]).toEqual(before);
  });

  it('refuses a flip whose final occupied space is blocked', () => {
    useEditorStore.setState({
      bricks: [
        { id: 'moving', definitionId: 'block-1x2', position: [0, 5, 5], rotation: [0, 0, 0] },
        { id: 'blocker', definitionId: 'cube-1', position: [-5, 15, 5], rotation: [0, 0, 0] },
      ],
      selectedId: 'moving',
      viewRightAxis: [0, 1],
    });
    const before = useEditorStore.getState().bricks[0];

    useEditorStore.getState().flipSelected('up');

    expect(useEditorStore.getState().bricks[0]).toEqual(before);
    expect(useEditorStore.getState().toast).toContain('翻不过去');
  });

  it('removes only the flipped brick connections and restores them on undo', () => {
    const lowerId = useEditorStore.getState().addBrick(definition.id, [5, 5, 5]);
    const upperId = useEditorStore.getState().addBrick(definition.id, [5, 15, 5]);
    if (!lowerId || !upperId) throw new Error('Expected test bricks to be created.');
    const stud = definition.connectors.find((connector) => connector.type === 'stud');
    const socket = definition.connectors.find((connector) => connector.type === 'socket');
    if (!stud || !socket) throw new Error('The test brick needs a stud and socket.');
    const connection = createConnection(lowerId, stud.id, upperId, socket.id);
    useEditorStore.setState({ connections: [connection], selectedId: upperId });

    useEditorStore.getState().flipSelected('up');
    expect(useEditorStore.getState().connections).toEqual([]);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().connections).toEqual([connection]);
  });

  it('moves the selected brick one grid step and keeps the move undoable', () => {
    const id = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    expect(id).not.toBeNull();

    expect(useEditorStore.getState().moveSelectedByGridStep([1, 0])).toBe(true);
    expect(useEditorStore.getState().bricks[0].position).toEqual([15, 5, 5]);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks[0].position).toEqual([5, 5, 5]);
  });

  it('moves a plate by half a cell after flipping it upright', () => {
    const id = useEditorStore.getState().addBrick('plate-1x2', [0, 2.5, 5]);
    expect(id).not.toBeNull();
    useEditorStore.getState().setViewRightAxis([0, 1]);
    useEditorStore.getState().flipSelected('up');
    const beforeMove = [...useEditorStore.getState().bricks[0].position];

    expect(useEditorStore.getState().moveSelectedByGridStep([1, 0])).toBe(true);
    const afterMove = useEditorStore.getState().bricks[0].position;
    expect(afterMove[0] - beforeMove[0]).toBeCloseTo(5);
    expect(afterMove[1]).toBeCloseTo(beforeMove[1]);
    expect(afterMove[2]).toBeCloseTo(beforeMove[2]);
  });

  it('preserves an exact half-grid transform while opening a project', () => {
    const serialized = serializeProject({
      bricks: [{
        id: 'half-grid',
        definitionId: 'cube-1',
        position: [0, 5, 0],
        rotation: [0, 0, 0],
      }],
      connections: [],
    });

    expect(useEditorStore.getState().importProject(serialized)).toBe(true);
    expect(useEditorStore.getState().bricks[0].position).toEqual([0, 5, 0]);
  });

  it('changes only the selected brick color and supports undo and redo', () => {
    const firstId = useEditorStore.getState().addBrick('cube-1');
    const secondId = useEditorStore.getState().addBrick('block-1x2');
    if (!firstId || !secondId) throw new Error('Expected test bricks to be created.');

    useEditorStore.getState().selectBrick(firstId);
    useEditorStore.getState().setSelectedColor('#123abc');
    expect(useEditorStore.getState().bricks.find((brick) => brick.id === firstId)?.color).toBe('#123abc');
    expect(useEditorStore.getState().bricks.find((brick) => brick.id === secondId)?.color).toBeUndefined();

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks.find((brick) => brick.id === firstId)?.color).toBeUndefined();

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().bricks.find((brick) => brick.id === firstId)?.color).toBe('#123abc');
  });

  it('places a duplicate in the nearest non-overlapping grid space', () => {
    const sourceId = useEditorStore.getState().addBrick('block-2x4');
    expect(sourceId).not.toBeNull();

    const copyId = useEditorStore.getState().duplicateSelected();
    const [source, copy] = useEditorStore.getState().bricks;
    expect(copyId).not.toBeNull();
    expect(source.id).toBe(sourceId);
    expect(copy.id).toBe(copyId);
    expect(bricksOverlap(source, copy)).toBe(false);
  });

  it('selects an entire connected component without crossing into another assembly', () => {
    const first = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    const second = useEditorStore.getState().addBrick('cube-1', [5, 15, 5]);
    const separate = useEditorStore.getState().addBrick('cube-1', [25, 5, 5]);
    if (!first || !second || !separate) throw new Error('Expected test bricks.');
    const cubeDefinition = BRICK_DEFINITIONS.find(({ id }) => id === 'cube-1');
    const stud = cubeDefinition?.connectors.find(({ type }) => type === 'stud');
    const socket = cubeDefinition?.connectors.find(({ type }) => type === 'socket');
    if (!stud || !socket) throw new Error('Expected cube connectors.');
    useEditorStore.setState({
      connections: [createConnection(first, stud.id, second, socket.id)],
      selectedId: first,
      selectedIds: [first],
    });

    useEditorStore.getState().selectConnectedBricks();

    expect(new Set(useEditorStore.getState().selectedIds)).toEqual(new Set([first, second]));
    expect(useEditorStore.getState().selectedIds).not.toContain(separate);
    expect(useEditorStore.getState().multiSelectMode).toBe(true);
  });

  it('copies a selection as one undoable operation and remaps internal connections', () => {
    const first = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    const second = useEditorStore.getState().addBrick('cube-1', [5, 15, 5]);
    if (!first || !second) throw new Error('Expected test bricks.');
    const cubeDefinition = BRICK_DEFINITIONS.find(({ id }) => id === 'cube-1');
    const stud = cubeDefinition?.connectors.find(({ type }) => type === 'stud');
    const socket = cubeDefinition?.connectors.find(({ type }) => type === 'socket');
    if (!stud || !socket) throw new Error('Expected cube connectors.');
    useEditorStore.setState({
      connections: [createConnection(first, stud.id, second, socket.id)],
      selectedId: second,
      selectedIds: [first, second],
      multiSelectMode: true,
    });
    const historyBefore = useEditorStore.getState().past.length;

    expect(useEditorStore.getState().startGroupCopy()).toBe(true);
    useEditorStore.getState().updateGroupPlacement([45, 5]);
    useEditorStore.getState().commitGroupPlacement();

    const state = useEditorStore.getState();
    expect(state.bricks).toHaveLength(4);
    expect(state.connections).toHaveLength(2);
    expect(state.selectedIds).toHaveLength(2);
    expect(state.connections[1].brickA).not.toBe(first);
    expect(state.connections[1].brickB).not.toBe(second);
    expect(state.past).toHaveLength(historyBefore + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks).toHaveLength(2);
    expect(useEditorStore.getState().connections).toHaveLength(1);
  });

  it('moves a multi-selection together with the keyboard and preserves internal spacing', () => {
    const first = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    const second = useEditorStore.getState().addBrick('cube-1', [15, 5, 5]);
    if (!first || !second) throw new Error('Expected test bricks.');
    useEditorStore.setState({
      selectedId: second,
      selectedIds: [first, second],
      multiSelectMode: true,
    });

    expect(useEditorStore.getState().moveSelectionByGridStep([0, 1])).toBe(true);
    const moved = useEditorStore.getState().bricks;
    expect(moved.map(({ position }) => position)).toEqual([[5, 5, 15], [15, 5, 15]]);
    expect(moved[1].position[0] - moved[0].position[0]).toBe(10);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks.map(({ position }) => position))
      .toEqual([[5, 5, 5], [15, 5, 5]]);
  });

  it('switches a selected brick to the nearest lower free layer and stays undoable', () => {
    useEditorStore.setState({
      bricks: [
        { id: 'moving', definitionId: 'cube-1', position: [5, 35, 5], rotation: [0, 0, 0] },
        { id: 'roof', definitionId: 'cube-1', position: [5, 25, 5], rotation: [0, 0, 0] },
      ],
      selectedId: 'moving',
      selectedIds: ['moving'],
    });

    expect(useEditorStore.getState().lowerSelectionOneLevel()).toBe(true);
    expect(useEditorStore.getState().bricks.find(({ id }) => id === 'moving')?.position)
      .toEqual([5, 15, 5]);
    expect(useEditorStore.getState().bricks.find(({ id }) => id === 'roof')?.position)
      .toEqual([5, 25, 5]);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks.find(({ id }) => id === 'moving')?.position)
      .toEqual([5, 35, 5]);
  });

  it('lowers a multi-selection rigidly and keeps only its internal connections', () => {
    const cubeDefinition = BRICK_DEFINITIONS.find(({ id }) => id === 'cube-1');
    const magnet = cubeDefinition?.connectors.find(({ type }) => type === 'magnet');
    if (!magnet) throw new Error('Expected cube side connectors.');
    const internal = createConnection('first', magnet.id, 'second', magnet.id);
    const external = createConnection('second', magnet.id, 'neighbor', magnet.id);
    useEditorStore.setState({
      bricks: [
        { id: 'first', definitionId: 'cube-1', position: [5, 25, 5], rotation: [0, 0, 0] },
        { id: 'second', definitionId: 'cube-1', position: [15, 25, 5], rotation: [0, 0, 0] },
        { id: 'neighbor', definitionId: 'cube-1', position: [25, 5, 5], rotation: [0, 0, 0] },
      ],
      connections: [internal, external],
      selectedId: 'second',
      selectedIds: ['first', 'second'],
      multiSelectMode: true,
    });

    expect(useEditorStore.getState().lowerSelectionOneLevel()).toBe(true);
    expect(useEditorStore.getState().bricks.slice(0, 2).map(({ position }) => position))
      .toEqual([[5, 20, 5], [15, 20, 5]]);
    expect(useEditorStore.getState().connections).toEqual([internal]);
  });

  it('moves a selected group by preview and keeps internal connections only', () => {
    const first = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    const second = useEditorStore.getState().addBrick('cube-1', [5, 15, 5]);
    const neighbor = useEditorStore.getState().addBrick('cube-1', [15, 5, 5]);
    if (!first || !second || !neighbor) throw new Error('Expected test bricks.');
    const cubeDefinition = BRICK_DEFINITIONS.find(({ id }) => id === 'cube-1');
    const stud = cubeDefinition?.connectors.find(({ type }) => type === 'stud');
    const socket = cubeDefinition?.connectors.find(({ type }) => type === 'socket');
    const magnet = cubeDefinition?.connectors.find(({ type }) => type === 'magnet');
    if (!stud || !socket || !magnet) throw new Error('Expected cube connectors.');
    const internal = createConnection(first, stud.id, second, socket.id);
    const external = createConnection(first, magnet.id, neighbor, magnet.id);
    useEditorStore.setState({
      connections: [internal, external],
      selectedId: second,
      selectedIds: [first, second],
      multiSelectMode: true,
    });

    expect(useEditorStore.getState().startGroupMove()).toBe(true);
    useEditorStore.getState().updateGroupPlacement([45, 5]);
    useEditorStore.getState().commitGroupPlacement();

    expect(useEditorStore.getState().connections).toEqual([internal]);
    expect(useEditorStore.getState().bricks.find(({ id }) => id === first)?.position[0]).toBe(45);
    expect(useEditorStore.getState().bricks.find(({ id }) => id === second)?.position[0]).toBe(45);
  });

  it('rejects a dragged brick released inside another brick', () => {
    const firstId = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    const secondId = useEditorStore.getState().addBrick('cube-1', [15, 5, 5]);
    if (!firstId || !secondId) throw new Error('Expected test bricks to be created.');

    useEditorStore.getState().startBrickDrag(secondId);
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active brick drag.');
    useEditorStore.getState().updateDragPreview(
      { ...drag.preview, position: [5, 5, 5] },
      null,
      true,
      true,
      null,
    );
    useEditorStore.getState().commitDrag();

    expect(useEditorStore.getState().bricks.find((brick) => brick.id === secondId)?.position).toEqual([15, 5, 5]);
    expect(useEditorStore.getState().toast).toContain('不能互相穿过');
  });

  it('keeps both ambiguous drag placements and lets an explicit choice win', () => {
    const id = useEditorStore.getState().addBrick('cube-1', [5, 5, 5]);
    if (!id) throw new Error('Expected a test brick.');
    useEditorStore.getState().startBrickDrag(id);
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active drag.');
    const top = { ...drag.preview, position: [25, 35, 5] as [number, number, number] };
    const inside = { ...drag.preview, position: [25, 15, 5] as [number, number, number] };

    useEditorStore.getState().updateDragPlacement(
      { preview: top, landing: top, candidate: null, drop: null },
      { preview: inside, landing: inside, candidate: null, drop: null },
      true,
      true,
      inside.position,
    );
    expect(useEditorStore.getState().drag?.placementMode).toBe('insert');
    expect(useEditorStore.getState().drag?.preview.position).toEqual(inside.position);

    useEditorStore.getState().beginPlacementChoice();
    expect(useEditorStore.getState().drag?.phase).toBe('choosing');
    useEditorStore.getState().setDragPlacementMode('top');
    useEditorStore.getState().commitDrag();

    expect(useEditorStore.getState().bricks[0].position).toEqual(top.position);
    expect(useEditorStore.getState().drag).toBeNull();
  });

  it('repairs overlapping bodies when opening a legacy project', () => {
    const serialized = serializeProject({
      bricks: [
        { id: 'legacy-a', definitionId: 'cube-1', position: [5, 5, 5], rotation: [0, 0, 0] },
        { id: 'legacy-b', definitionId: 'cube-1', position: [5, 5, 5], rotation: [0, 0, 0] },
      ],
      connections: [],
    });

    expect(useEditorStore.getState().importProject(serialized)).toBe(true);
    const [first, second] = useEditorStore.getState().bricks;
    expect(first.position).toEqual([5, 5, 5]);
    expect(second.position).toEqual([5, 15, 5]);
    expect(bricksOverlap(first, second)).toBe(false);
  });

  it('adds and removes a connection without deleting neighboring bricks', () => {
    const firstId = useEditorStore.getState().addBrick(definition.id, [0, definition.size[1] / 2, 0]);
    const secondId = useEditorStore.getState().addBrick(definition.id, [0, definition.size[1] * 1.5, 0]);
    if (!firstId || !secondId) throw new Error('Expected test bricks to be created.');

    const stud = definition.connectors.find((connector) => connector.type === 'stud');
    const socket = definition.connectors.find((connector) => connector.type === 'socket');
    if (!stud || !socket) throw new Error('The test brick needs a stud and socket.');
    const connection = createConnection(firstId, stud.id, secondId, socket.id);
    useEditorStore.getState().startBrickDrag(secondId);
    useEditorStore.getState().commitDrag(connection);
    expect(useEditorStore.getState().connections).toEqual([connection]);

    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().bricks.map((brick) => brick.id)).toEqual([firstId]);
    expect(useEditorStore.getState().connections).toEqual([]);
  });

  it('undoes and redoes committed changes, and clears redo after a new commit', () => {
    const firstId = useEditorStore.getState().addBrick(definition.id);
    expect(useEditorStore.getState().bricks).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks).toHaveLength(0);
    expect(useEditorStore.getState().future).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().bricks[0].id).toBe(firstId);

    useEditorStore.getState().undo();
    useEditorStore.getState().addBrick(definition.id, [20, 0, 0]);
    expect(useEditorStore.getState().future).toHaveLength(0);
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it('keeps palette drag changes ephemeral until one commit', () => {
    useEditorStore.getState().startPaletteDrag(definition.id);
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active palette drag.');

    useEditorStore.getState().updateDragPreview(
      { ...drag.preview, position: [30, definition.size[1] / 2, 20] },
      null,
      true,
    );
    expect(useEditorStore.getState().bricks).toHaveLength(0);
    expect(useEditorStore.getState().past).toHaveLength(0);

    useEditorStore.getState().commitDrag();
    expect(useEditorStore.getState().bricks[0].position).toEqual([
      30,
      definition.size[1] / 2,
      20,
    ]);
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().drag).toBeNull();
  });

  it('commits a free release at its predicted gravity landing', () => {
    useEditorStore.getState().addBrick('cube-1', [0, 5, 0]);
    useEditorStore.getState().startPaletteDrag('cube-1');
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active palette drag.');
    const held = { ...drag.preview, position: [0, 35, 0] as [number, number, number] };
    const drop = computeDropPlacement(held, useEditorStore.getState().bricks);

    useEditorStore.getState().updateDragPreview(held, null, true, true, drop);
    useEditorStore.getState().commitDrag();

    expect(useEditorStore.getState().bricks).toHaveLength(2);
    expect(useEditorStore.getState().bricks[1].position).toEqual([0, 15, 0]);
    expect(useEditorStore.getState().connections).toEqual([]);
  });

  it('locks pointer updates while falling and commits the predicted landing', () => {
    useEditorStore.getState().startPaletteDrag('cube-1', [10, 10], 7);
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active palette drag.');
    const held = { ...drag.preview, position: [20, 45, 10] as [number, number, number] };
    const drop = computeDropPlacement(held, []);

    useEditorStore.getState().updateDragPreview(held, null, true, true, drop);
    useEditorStore.getState().beginDropAnimation();
    expect(useEditorStore.getState().drag?.phase).toBe('dropping');

    useEditorStore.getState().updateDragPreview(
      { ...held, position: [99, 99, 99] },
      null,
      true,
      true,
      drop,
    );
    useEditorStore.getState().startPaletteDrag('block-1x2', [20, 20], 8);
    expect(useEditorStore.getState().drag?.brickId).toBe(drag.brickId);
    expect(useEditorStore.getState().drag?.preview.position).toEqual(held.position);

    useEditorStore.getState().updateDropAnimationPreview({
      ...held,
      position: [20, 20, 10],
    });
    useEditorStore.getState().commitDrag();

    expect(useEditorStore.getState().bricks).toHaveLength(1);
    expect(useEditorStore.getState().bricks[0].position).toEqual(drop.position);
    expect(useEditorStore.getState().drag).toBeNull();
  });

  it('never commits a brick below the print bed', () => {
    const id = useEditorStore.getState().addBrick('cube-1', [0, -40, 0]);
    expect(id).not.toBeNull();
    expect(useEditorStore.getState().bricks[0].position[1]).toBeCloseTo(5);

    useEditorStore.getState().startBrickDrag(id!);
    const drag = useEditorStore.getState().drag;
    if (!drag) throw new Error('Expected an active brick drag.');
    useEditorStore.getState().updateDragPreview(
      { ...drag.preview, position: [12, -25, 4] },
      null,
      true,
      true,
      null,
    );
    useEditorStore.getState().commitDrag();

    expect(useEditorStore.getState().bricks[0].position).toEqual([15, 5, 5]);
  });

  it('imports a serialized legox project and keeps it undoable', () => {
    const serialized = serializeProject({
      bricks: [{
        id: 'file-cone',
        definitionId: 'cone-2',
        position: [10, 10, 20],
        rotation: [0, 0, 0],
      }],
      connections: [],
    });

    expect(useEditorStore.getState().importProject(serialized)).toBe(true);
    expect(useEditorStore.getState().bricks).toHaveLength(1);
    expect(useEditorStore.getState().bricks[0]).toMatchObject({
      id: 'file-cone',
      definitionId: 'cone-2',
    });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().bricks).toHaveLength(0);
  });

  it('rejects invalid legox project contents without replacing the scene', () => {
    useEditorStore.getState().addBrick('cube-1');

    expect(useEditorStore.getState().importProject('{bad json')).toBe(false);
    expect(useEditorStore.getState().bricks).toHaveLength(1);
    expect(useEditorStore.getState().toast).toContain('.legox');
  });
});
