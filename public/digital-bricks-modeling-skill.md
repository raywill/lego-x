---
name: digital-bricks-modeling
description: Generate valid Digital Bricks .legox construction models from natural-language requests. Use for child-friendly brick assemblies, never arbitrary CAD meshes or STL generation.
---

# Digital Bricks AI Modeling Skill

Use this instruction when someone asks you to make a model for the Digital Bricks web app.

## Your job

Turn the user's idea into one valid `.legox` JSON project. The file must open in Digital Bricks and must use its generic construction bricks—not a car, house, animal, or other semantic prefab.

Return a short Chinese build summary, then the complete JSON in one `json` code block. If a file-writing tool is available, also save the JSON as `<model-name>.legox`.

Never generate STL, mesh vertices, mesh faces, Three.js code, arbitrary CAD geometry, or a new brick definition.

## File format

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

- Use millimeters. `position` is the center of the brick body, not its corner.
- `color` is optional. Use a `#RRGGBB` color when it makes a structure easier to understand.
- Omit `connections` when there are no verified connections. Never store connector world positions.
- Use unique stable brick IDs such as `b1`, `b2`, `roof-left`, and `wheel-front-left`.

## Catalog: only these `definitionId` values are legal

| Group | `definitionId` | Body size `[x,y,z]` mm |
|---|---|---|
| Blocks | `cube-1` | `[10,10,10]` |
| Blocks | `mini-cube` | `[5,5,5]` |
| Blocks | `block-1x2` | `[20,10,10]` |
| Blocks | `block-2x2` | `[20,10,20]` |
| Blocks | `block-2x4` | `[40,10,20]` |
| Blocks | `beam-long` | `[60,10,10]` |
| Plates | `plate-1x1` | `[10,5,10]` |
| Plates | `plate-1x2` | `[20,5,10]` |
| Plates | `plate-3x3` | `[30,5,30]` |
| Plates | `plate-1x6` | `[60,5,10]` |
| Round | `cylinder`, `cone-1` | `[10,10,10]` |
| Round | `cone-2`, `sphere` | `[20,20,20]` |
| Round | `disc`, `ring` | `[20,5,20]` |
| Round | `rod` | `[10,40,10]` |
| Slopes | `triangle-prism`, `right-triangle-prism` | `[20,20,10]` |
| Slopes | `wedge`, `trapezoid-prism` | `[30,10,20]` |
| Slopes | `roof-wedge` | `[40,20,20]` |
| Curves | `half-cylinder` | `[30,10,20]` |
| Curves | `hemisphere` | `[20,10,20]` |
| Frames | `frame-square`, `frame-circle`, `frame-arch` | `[30,30,10]` |
| Frames | `block-concave-arc` | `[20,20,10]` |
| Frames | `block-sphere-octant-cutout` | `[20,20,20]` |
| Frames | `quarter-cylinder` | `[30,10,10]` |
| Mechanical | `wheel`, `circular-handle` | `[10,30,30]` |
| Mechanical | `axle` | `[50,10,10]` |
| Mechanical | `hinge` | `[20,10,20]` |
| Mechanical | `wheel-large` | `[10,50,50]` |

## Non-negotiable construction rules

1. Use only quarter-turn rotations: `0`, `1.5707963267948966`, `3.141592653589793`, or `4.71238898038469`. Keep `[0,0,0]` unless a rotation or flip is needed.
2. Normal bricks use the 10 mm main grid with 5 mm fine placement. Their body edges must be on 5 mm coordinates. Vertical body edges must also be on 5 mm layers.
3. `mini-cube` is the one exception: its horizontal body edges may be on the 2.5 mm lattice so its center connector can align with a normal brick. Its vertical body edges remain on 5 mm layers.
4. Do not let any two brick bodies overlap with positive volume. Face contact, partial contact, a single connector, and overhang are allowed.
5. Do not put body geometry below the print bed. A box of height `h` on the bed has center `y = h / 2`.
6. Build upward from a supported piece where practical. Unsupported overhang is allowed only when intentionally connected to the structure.
7. Do not add invisible support bricks merely to satisfy a connection rule.
8. Editor-only snap bumps are not part of the printed model; do not model them as geometry.

## Verified connector rules

For basic blocks and plates, the top and bottom connector IDs are predictable:

```text
top-stud-<column>-<row>
bottom-socket-<column>-<row>
```

Columns run along local X; rows run along local Z. For 1×1 blocks, plates, and the mini cube, use `top-stud-0-0` and `bottom-socket-0-0`.

Only add a connection when the two connector locations coincide after applying the brick positions and rotations. Do not guess side-magnet, wheel, axle, hinge, frame, or curved-piece connector IDs. If a complex side attachment cannot be proven, output valid placed bricks without that logical connection and state this choice in the build summary.

### Safe examples

- A `cube-1` on the bed: `[x,5,z]`.
- A same-footprint 10 mm cube stacked above it: `[x,15,z]`, with lower `top-stud-0-0` connected to upper `bottom-socket-0-0`.
- A `plate-1x1` on a cube: `[x,12.5,z]`, using its `bottom-socket-0-0`.
- A `mini-cube` centered on a cube's top: `[x,12.5,z]`, also using the two `0-0` IDs. Its horizontal body edges are then `x ± 2.5` and `z ± 2.5`; that is valid.

## Planning method

1. Break the request into a base, supports, main masses, roof/decoration, and optional mechanical parts.
2. Prefer larger pieces for structure. Use `mini-cube` only for deliberate small detail, spacing, or a small support.
3. Place and validate one body bounding box at a time; calculate body extents before adding the next one.
4. Use partial connection and overhang for tabletops, wings, balconies, bridges, roofs, and arms. Never require full-face overlap.
5. Add only verified simple connections after all positions are settled.
6. If a user request is ambiguous, choose the smallest stable construction and state the assumption. Ask one concise question only when a decision materially changes the model.

## Print-aware guidance

- A 5 mm mini cube is appropriate at 1× scale. At 0.5× it is 2.5 mm; at 0.25× it is 1.25 mm. Warn the user that these details may be too small for their printer.
- Keep small details attached to a larger body.
- Do not generate printer G-code or slicing instructions. The app exports STL separately.

## Final validation checklist

Before returning a file, verify all of the following:

1. `version` is `2`; `catalogVersion` is `2`.
2. Brick IDs are unique; every `definitionId` occurs in the catalog above.
3. Positions and rotations contain only finite numeric values.
4. Rotation is a discrete quarter turn.
5. Normal body edges obey the 5 mm grid; mini cube horizontal edges obey the 2.5 mm exception.
6. No body overlaps another body with positive volume.
7. No body extends below the bed.
8. Every connection has two distinct existing brick IDs and real connector IDs on the corresponding definitions.
