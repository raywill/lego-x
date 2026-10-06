# `.legox` format and catalog reference

Use millimeters. The body transform is its center position, not a corner.

```json
{
  "version": 2,
  "catalogVersion": 2,
  "bricks": [
    {
      "id": "b1",
      "definitionId": "cube-1",
      "position": [0, 5, 0],
      "rotation": [0, 0, 0],
      "color": "#ff6b5f"
    }
  ],
  "connections": [
    {
      "brickA": "b1",
      "connectorA": "top-stud-0-0",
      "brickB": "b2",
      "connectorB": "bottom-socket-0-0"
    }
  ]
}
```

`color` is optional. Omit `connections` when there are none. Do not store derived connector world positions.

## Available catalog IDs

| Group | IDs |
|---|---|
| Blocks and plates | `cube-1`, `mini-cube`, `block-1x2`, `block-2x2`, `block-2x4`, `beam-long`, `plate-1x1`, `plate-1x2`, `plate-3x3`, `plate-1x6` |
| Round | `cylinder`, `cone-1`, `cone-2`, `disc`, `rod`, `ring` |
| Slopes | `triangle-prism`, `right-triangle-prism`, `wedge`, `roof-wedge`, `trapezoid-prism` |
| Curves and openings | `half-cylinder`, `hemisphere`, `sphere`, `frame-square`, `frame-circle`, `frame-arch`, `block-concave-arc`, `block-sphere-octant-cutout`, `quarter-cylinder` |
| Mechanical | `wheel`, `axle`, `hinge`, `wheel-large`, `circular-handle` |

## Key body sizes

| ID | Size `[x, y, z]` mm |
|---|---|
| `cube-1` | `[10, 10, 10]` |
| `mini-cube` | `[5, 5, 5]` |
| `block-1x2` | `[20, 10, 10]` |
| `block-2x2` | `[20, 10, 20]` |
| `block-2x4` | `[40, 10, 20]` |
| `beam-long` | `[60, 10, 10]` |
| `plate-1x1` | `[10, 5, 10]` |
| `plate-1x2` | `[20, 5, 10]` |
| `plate-3x3` | `[30, 5, 30]` |
| `plate-1x6` | `[60, 5, 10]` |

For a box with height `h`, a bed placement has `position.y = h / 2`. A same-footprint box stacked on it has `position.y = h + nextHeight / 2`.

## Verified stack connector recipes

Basic blocks and plates use explicit top studs and bottom sockets:

```text
top-stud-<column>-<row>
bottom-socket-<column>-<row>
```

Columns run across local X; rows run across local Z. For 1×1 pieces, use `top-stud-0-0` and `bottom-socket-0-0`.

Examples:

- Stack a 10 mm `cube-1` on another at the same X/Z: lower `[x, 5, z]`, upper `[x, 15, z]`, connected with the two `0-0` IDs.
- Stack `mini-cube` on `cube-1`: lower `[x, 5, z]`, mini `[x, 12.5, z]`, using the same `0-0` IDs. This is legal even though the mini cube's horizontal body edges are at `x ± 2.5` and `z ± 2.5`.
- Stack a `plate-1x1` on a cube: its center is `y = 12.5` and it uses `bottom-socket-0-0`.

For side, wall, axle, ring, hinge, and complex curved connections, use connection IDs only when they can be derived from the installed catalog. Otherwise output valid placed bricks without a guessed logical connection.

## Mandatory validation checklist

Before returning the file, verify:

1. Every `definitionId` is listed above and every brick ID is unique.
2. Each `position` and `rotation` is a finite number.
3. Normal-body edges are on the 5 mm grid; mini-cube horizontal edges may be on 2.5 mm grid.
4. No two body bounding boxes overlap with positive volume.
5. No body extends below the bed.
6. Each connection references two distinct existing bricks and valid connector IDs on those definitions.
