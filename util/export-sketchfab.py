"""Blender: open the packed still scene, then --python this file -- --out DIR.

Export portable glTF materials without modifying the source .blend file.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.out.mkdir(parents=True, exist_ok=True)
source_path = bpy.data.filepath
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1

# Camera-facing smoke cards and Cycles volumes are render effects, not solids
# that should accompany an orbitable architectural model.
removed = []
for obj in list(scene.objects):
    if obj.name.startswith('Smoke puff') or obj.name == 'Altar fire volume':
        removed.append(obj.name)
        bpy.data.objects.remove(obj, do_unlink=True)

normal_images = {}
used_materials = {slot.material for obj in scene.objects if obj.type == 'MESH'
                  for slot in obj.material_slots if slot.material}
if not any(mat.name == 'shadow' for mat in used_materials):
    raise RuntimeError('Entrance backdrops missing; rebuild the packed scene with export-still.js')
for mat in used_materials:
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    old = nodes.get('Principled BSDF')
    if old is None:
        raise RuntimeError('No portable surface for ' + mat.name)
    rough = old.inputs['Roughness'].default_value
    metallic = old.inputs['Metallic'].default_value
    image = next((n.image for n in nodes if n.type == 'TEX_IMAGE'
                  and n.image and n.image.name == mat.name + '.png'), None)
    if image is None:
        raise RuntimeError('Missing packed base texture: ' + mat.name)
    normal = next((n.image for n in nodes if n.type == 'TEX_IMAGE'
                   and n.image and '_normal' in n.image.name), None)
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    bs = nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metallic
    if mat.name == 'shadow':
        bs.inputs['Specular IOR Level'].default_value = 0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    links.new(bs.outputs['BSDF'], output.inputs['Surface'])
    if mat.name == 'lattice':
        links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])
        mat.surface_render_method = 'DITHERED'
    if mat.name == 'fire':
        bs.inputs['Emission Color'].default_value = (1, 0.035, 0.001, 1)
        bs.inputs['Emission Strength'].default_value = 0.35
    if mat.name == 'water':
        # A core metallic/roughness water surface is more portable than the
        # Cycles transmission setup; retain its color and smooth reflection.
        bs.inputs['IOR'].default_value = 1.333
    if normal:
        # The still renderer flips the normal-map green channel after flipping
        # the canvas UVs. Encode that in pixels for glTF's normalTexture input.
        if normal.name not in normal_images:
            pixels = np.empty(normal.size[0]*normal.size[1]*4, dtype=np.float32)
            normal.pixels.foreach_get(pixels)
            pixels[1::4] = 1-pixels[1::4]
            portable = bpy.data.images.new(mat.name + ' glTF normal',
                                           width=normal.size[0], height=normal.size[1])
            portable.colorspace_settings.name = 'Non-Color'
            portable.pixels.foreach_set(pixels)
            portable.pack()
            normal_images[normal.name] = portable
        nt = nodes.new('ShaderNodeTexImage')
        nt.image = normal_images[normal.name]
        nm = nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.45
        links.new(nt.outputs['Color'], nm.inputs['Color'])
        links.new(nm.outputs['Normal'], bs.inputs['Normal'])

expected = sum(len(o.data.polygons) for o in scene.objects if o.type == 'MESH')
camera = scene.camera
manifest = {
    'source': Path(source_path).name,
    'units': 'meters',
    'triangles': expected,
    'materials': sorted(m.name for m in used_materials),
    'omitted': ['Cycles fire volume', 'camera-facing smoke cards',
                'procedural world sky', 'world-space procedural grain and color variation'],
    'blender_camera': {
        'position': list(camera.location),
        'rotation_euler': list(camera.rotation_euler),
        'horizontal_fov_degrees': math.degrees(camera.data.angle),
    },
}
destination = args.out / 'temple-mount-sketchfab.glb'
bpy.ops.export_scene.gltf(
    filepath=str(destination), export_format='GLB', export_materials='EXPORT',
    export_cameras=True, export_lights=False, export_animations=False,
    export_yup=True, export_normals=True, export_tangents=True,
)

# Round-trip through Blender's glTF importer: geometry and embedded images must
# survive without the original scene or texture files being present.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(destination))
actual = sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
if actual != expected:
    raise RuntimeError(f'Triangle count changed: {expected} -> {actual}')
images = [im for im in bpy.data.images if im.type == 'IMAGE']
for im in images:
    # The importer creates lazy packed images; accessing pixels forces decode.
    if len(im.pixels):
        _ = im.pixels[0]
if not images or any(not im.has_data or not im.packed_file for im in images):
    raise RuntimeError('Round-trip lost embedded textures')
manifest['validation'] = {'round_trip_triangles': actual, 'embedded_images': len(images)}
(args.out / 'export-details.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Verified upload file:', destination, actual, 'triangles;', len(images), 'images', flush=True)
