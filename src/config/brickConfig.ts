export const BRICK_UNIT = 10;
export const BRICK_LAYER = BRICK_UNIT / 2;
/** The one deliberate exception to the main grid: a 5 mm mini cube needs a
 * 2.5 mm body-edge lattice to keep its connector centered on full-size bricks. */
export const MINI_PLACEMENT_GRID = BRICK_LAYER / 2;
/** Smallest legal placement increment after a thin piece is turned upright. */
export const PLACEMENT_GRID = BRICK_LAYER;

export const BRICK_CONFIG = {
  unit: BRICK_UNIT,
  layer: BRICK_LAYER,
  placementGrid: PLACEMENT_GRID,
  miniPlacementGrid: MINI_PLACEMENT_GRID,
  plateHeight: BRICK_LAYER,
  discHeight: BRICK_LAYER,
  rodRadius: BRICK_UNIT * 0.5,
  studRadius: BRICK_UNIT * 0.27,
  studHeight: BRICK_UNIT * 0.18,
  snapDistance: BRICK_UNIT * 0.68,
  matingOverlap: 0.65,
} as const;

export const PRINT_BED = {
  width: BRICK_UNIT * 24,
  depth: BRICK_UNIT * 18,
  height: BRICK_UNIT * 18,
} as const;

export const PROJECT_STORAGE_KEY = 'digital-bricks-project-v1';
export const PROJECT_VERSION = 1 as const;
export const BRICK_CATALOG_VERSION = 2 as const;
export const HISTORY_LIMIT = 60;
export const ROTATION_STEP = Math.PI / 2;
