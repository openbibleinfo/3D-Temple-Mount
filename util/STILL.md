# Blender demo still

From WSL, with Node, Microsoft Edge, and Windows Blender 5.2 installed:

```bash
bash util/render-still.sh --preview
bash util/render-still.sh --preview --detail
bash util/render-still.sh
```

For matching 1024 x 768 HTML and Blender comparisons, including an overview
with the southern Royal Stoa's terracotta roof:

```bash
bash util/render-still.sh --width 1024 --samples 48 --view close
bash util/capture-still.sh
bash util/render-still.sh --width 1024 --samples 48 --view overview
```

These produce `temple-close-html.png`, `temple-close-blender.png`,
`temple-overview-html.png`, and `temple-overview-blender.png` in
`captures/still/`, plus a packed Blender file for each rendered view.
The close view preserves the original demo camera. The overview looks from
the northeast toward the Royal Stoa. `views.json` records the browser queries;
they convert Blender's horizontal field of view to WebGL's vertical field of
view so both renderers frame the same geometry. Figures are off in both.

Both use the HTML model's 9 a.m. sun vector, from the southeast. Blender's
sky rotation is measured from +Y toward +X (see the
[Cycles sky shader](https://github.com/blender/blender/blob/main/intern/cycles/kernel/svm/sky.h)),
after rotating the model into Blender coordinates. `--sun-size 3` is the
default angular diameter in degrees for softer shadows, retaining the sky
model's default daylight intensity.

The preview is 1000 x 750 at 24 samples. The final is 2400 x 1800 at
128 samples; `--samples 64` overrides the sample count. Cycles tries supported
GPU backends, falling back to CPU. Override `BLENDER_BIN` or `EDGE_BIN` with
the WSL path to either executable if installed elsewhere.
`--detail` renders only a close crop around the altar for reviewing the fire.

Outputs are in the ignored `captures/still/` directory:

- `temple-preview.png` or `temple-demo.png`: rendered image.
- `temple-demo.blend`: editable scene with packed texture images.
- `scene.json` and material PNGs: intermediate export.

Existing PNGs are preserved; subsequent renders get `-2`, `-3`, etc. suffixes
so a preview open in a Windows image viewer does not block saving a new image.

The exporter runs the same scene construction functions as the browser.
It checks finite vertex attributes and valid triangle indices, preserves UVs
and shading normals, and rotates the Y-up scene into Blender's Z-up frame
without reversing winding. The camera uses precinct-local cubits, transformed
through `precinctToWorld`; its coordinates and the sun hour are near the end
of the exporter's VM script.

This is a render study of the existing architecture. Cycles replaces the
browser's lighting, reflections, and ambient occlusion; materials retain the
generated image textures with added procedural microrelief. The export omits
figures, explanatory overlays, cutaway furniture, and markers. Dark entrance
backdrops are retained: they represent unmodeled underground interiors, and
removing them exposes the stone behind the southern and western gates.
Gold retains the browser's 0.88 metallic weight and uses 0.45
roughness for beaten sheet: a polished ideal metal made horizontal facade
caps reflect the blue sky as a dark green band.
Fire is a procedural emitting volume above the actual ember bed.
Smoke uses soft textured cards with the browser's particle anchors, drift and
lifetimes frozen at two seconds. This is not a fluid simulation. The scene
includes roofs and the closed Sanctuary.
It does not add new architectural detail or claim photorealistic asset quality.

To adjust the camera or lighting without exporting again, open the packed
Blender file. To rerun only the rendering script from WSL:

```bash
"/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
  --background --factory-startup --python-exit-code 1 \
  --python "$(wslpath -w "$PWD/util/render-still.py")" \
  -- --scene "$(wslpath -w "$PWD/captures/still")" --preview
```

No changes to `src/` or the generated web page are required.

## Sketchfab upload

After rendering the final overview, export its packed scene as a portable GLB:

```bash
"/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" \
  --background "$(wslpath -w "$PWD/captures/still/temple-overview-blender.blend")" \
  --python-exit-code 1 --python "$(wslpath -w "$PWD/util/export-sketchfab.py")" \
  -- --out "$(wslpath -w "$PWD/captures/sketchfab")"
```

Upload `captures/sketchfab/temple-mount-sketchfab.glb` directly to Sketchfab.
It embeds textures, normals, the overview camera, and metallic/roughness
materials at meter scale. The exporter reimports the result to check triangle
counts and embedded texture availability; `export-details.json` records this.
The source Blender file is left intact.

The GLB includes the closed exterior architecture and terrain used in the
stills. Cycles fire volume, camera-facing smoke cards, procedural sky, and
world-space material noise are omitted; the ember bed retains its glow.
Sketchfab supplies its own lighting. Set a starting view after upload, since
automatic framing may include the full extent of the terrain. The packed
Blender source retains the complete still-render setup and effects.
