---
name: digital-bricks-modeling
description: Generate valid .legox Digital Bricks construction models from natural-language build requests. Use for child-friendly brick assemblies, not arbitrary CAD meshes or STL generation.
---

# Digital Bricks Modeling

Turn a user's idea into a `.legox` project that opens directly in Digital Bricks.

## Output contract

- Generate a JSON `.legox` file, never an STL, mesh, procedural geometry, or a new brick definition.
- Use only catalog IDs and data rules in [the format reference](references/legox-format.md).
- Return a short build summary followed by the complete JSON in a fenced `json` block. When a file tool is available, also save it with a `.legox` extension.
- Do not add a car, house, animal, or other semantic prefab. Build it from the catalog's generic pieces.

## Construction rules

- A brick instance has a unique stable `id`, a catalog `definitionId`, a body-center `position` in millimeters, an optional hex `color`, and a discrete `rotation`.
- Use only quarter-turn rotations: `0`, `π/2`, `π`, or `3π/2`. Keep `[0, 0, 0]` unless the requested shape needs rotation or flipping.
- Normal bricks use a 10 mm main grid with 5 mm fine placement. Their body edges must land on 5 mm coordinates; vertical body edges must also land on 5 mm coordinates.
- `mini-cube` is the only exception: its body edges may use a 2.5 mm horizontal lattice, so its centered connector can align to full-size pieces. Its vertical body edges still use 5 mm layers.
- Never allow positive-volume overlap between bodies. Face contact, a single connector, partial contact, and overhang are valid.
- Build upward from the print bed when practical. A body resting on the bed has its lowest point at `y = 0`; do not put any geometry below it.
- Use `connections` for every simple, verified stud/socket stack. Keep a connection only when both connector IDs exist and their world positions coincide. Do not invent connector IDs.
- One connection is sufficient: do not force full-face overlap or remove useful overhangs.

## Planning workflow

1. Decompose the idea into a few recognizable masses: base, supports, body, roof/decoration, and movable pieces if needed.
2. Prefer large catalog bricks for structure; use `mini-cube` only for deliberate detail, spacing, or small supports.
3. Assign positions from body dimensions, checking each bounding box before adding the next brick.
4. Add only verified connections using the recipes in the reference. If a nonstandard side connection cannot be derived confidently, leave it unconnected rather than writing invalid JSON; mention that choice in the summary.
5. Validate the final JSON: version, catalog version, unique IDs, known definitions, finite numbers, legal rotations, grid placement, no overlap, and valid connection references.

## Print-aware choices

- Keep very small details attached to a larger body. A free 5 mm mini cube is easy to lose and can print poorly.
- Flag a model containing `mini-cube` when the user asks for 0.5× or 0.25× export: it becomes 2.5 mm or 1.25 mm wide.
- Do not simulate physical connector bumps. They are editor guides only and are intentionally absent from exported STL.

## Clarify only when it changes the model

Ask one concise question if the user's request leaves a decisive choice unresolved, such as intended scale, symmetry, or whether a moving part is decorative. Otherwise choose a simple, stable construction and state the assumption.
