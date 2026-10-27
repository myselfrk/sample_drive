# SignalDrive

A physics mini-game. The car accelerates by itself; you control the brake at traffic signals. A live
**speed–time graph** is drawn as you drive, then ten questions ask about *your* graph (slope = acceleration,
area = distance). Styled after GravityGrid; 3D assets were modelled in Blender and shipped as compressed GLBs.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (predev checks every GLB is compressed + under 1.5 MB)
npm run build      # tsc + vite build (same model guard)
npm run lint
npm run sim:smoke  # runs a scripted drive: slopes must be exactly +2 / 0 / -5, areas must sum to distance
```

Controls: hold **Space** or **↓** (or the on-screen Brake button) to brake. The tab pauses on blur.

## How it works

| Piece | Where |
|---|---|
| Physics (fixed 1/120 s step, a = +2 / 0 / −5 m/s², v clamps at 0 and 16 m/s) | `src/sim/DriveSim.ts`, `constants.ts` |
| Signals (seeded: 3 of 4 turn red, 1 stays green), scoring | `src/sim/signals.ts`, `DriveSim.ts` |
| Segment detection, area/slope helpers, sample drive | `src/sim/analysis.ts`, `autopilot.ts` |
| Question bank (10 per round: 6 from your graph + 4 more, ≥2 conceptual) | `src/sim/questions.ts` |
| 3D scene (chunked street, golden-hour lighting, bloom) | `src/scene/*` |
| Live graph (canvas) / result graph (SVG) | `src/ui/LiveGraph.tsx`, `ResultGraph.tsx` |

The sim is a plain class: the render loop steps it and writes to refs, and the HUD reads it ~10×/s.
Nothing calls React `setState` per frame.

Adding a question means adding an entry in `src/sim/questions.ts` (a builder for data questions, or a row in
`CONCEPTS`), not editing the UI. Dev builds expose the sim as `window.__sim` for automated play-throughs.

## Rebuilding the 3D models

Models are built procedurally in Blender (via the Blender MCP) from `blender/scripts/`:

```
00_common.py  10_car.py  20_signal.py  30_road.py  40_props.py  50_buildings.py
```

Run them in that order inside Blender (they share one namespace), export `blender/exports/*.raw.glb`, then:

```bash
npm run models:optimize   # gltf-transform: meshopt + webp; car/signal/buildings keep node + material names
node scripts/glb-names.mjs public/models/car.glb   # confirm Wheel_FL/FR/RL/RR, BrakeLight, Headlight, Lamp_* survived
```

Gotchas: procedural Blender shader nodes don't survive glTF export, so every texture is a numpy-generated PNG.
The compressor bakes a quantisation offset into node transforms, so the app never overwrites a node's position
(see `Building` in `src/scene/Street.tsx`). Wheels spin about local **Y** (their axle), not Z.
# sample_drive
