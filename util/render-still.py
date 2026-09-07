"""Blender background script: -- --scene DIR [--preview] [--samples N]."""
import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--scene', type=Path, required=True)
parser.add_argument('--preview', action='store_true')
parser.add_argument('--samples', type=int)
parser.add_argument('--width', type=int, help='Image width; keeps the 4:3 aspect ratio')
parser.add_argument('--view', choices=['close', 'overview'], default='close')
parser.add_argument('--sun-size', type=float, default=3.0, help='Sun angular diameter in degrees')
parser.add_argument('--detail', action='store_true', help='Render a crop around the altar for material review')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
data = json.loads((args.scene / 'scene.json').read_text())
if args.width is not None and args.width < 1:
    parser.error('--width must be positive')
if not 0 < args.sun_size <= 20:
    parser.error('--sun-size must be between 0 and 20 degrees')
camera_spec = data.get('cameras', {'close': data['camera']})[args.view]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.render.threads_mode = 'FIXED'
scene.render.threads = min(8, os.cpu_count() or 1)
scene.cycles.samples = args.samples or (24 if args.preview else 128)
scene.cycles.use_denoising = True
scene.cycles.adaptive_threshold = 0.04 if args.preview else 0.015
scene.cycles.max_bounces = 8
scene.cycles.transparent_max_bounces = 64
# Select a supported compute device when available, otherwise keep CPU.
prefs = bpy.context.preferences.addons['cycles'].preferences
for backend in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == backend]
        if devices:
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = 'GPU'
            print('Rendering device:', backend, [d.name for d in devices], flush=True)
            break
    except (TypeError, RuntimeError):
        pass

def coord(p):
    # Proper rotation, preserving winding: world Y-up -> Blender Z-up.
    return (p[0], -p[2], p[1])

materials = {}
for name, info in data['materials'].items():
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(args.scene / (name+'.png')))
    links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    rough = 0.67
    if name in ['marble','marbleFloor']: rough = 0.3
    if name in ['gold','bronze']:
        # Match the browser's beaten gold rather than a polished ideal metal.
        # Broad horizontal sheets otherwise reflect blue sky as a dark green
        # band while the sun-facing facade remains yellow.
        rough = 0.45 if name == 'gold' else 0.34
        bs.inputs['Metallic'].default_value = info.get('metal', 1) if name == 'gold' else 1
    if name == 'water':
        rough = 0.12
        bs.inputs['Transmission Weight'].default_value = 0.65
        bs.inputs['IOR'].default_value = 1.333
    bs.inputs['Roughness'].default_value = rough
    if name == 'shadow':
        # These are the model's unmodeled tunnel interiors, not stone faces.
        bs.inputs['Roughness'].default_value = 1
        bs.inputs['Specular IOR Level'].default_value = 0
    if name == 'fire':
        links.remove(bs.inputs['Base Color'].links[0])
        bs.inputs['Base Color'].default_value = (0.15,0.015,0.002,1)
        bs.inputs['Emission Color'].default_value = (1,0.035,0.001,1)
        bs.inputs['Emission Strength'].default_value = 0.35
    if info.get('alpha'):
        links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])
    # World-scale microtexture; original UV textures retain archaeological coursing.
    geo = nodes.new('ShaderNodeNewGeometry')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 75 if name in ['gold','bronze'] else 32
    noise.inputs['Detail'].default_value = 3
    links.new(geo.outputs['Position'], noise.inputs['Vector'])
    # Broad variation breaks up repeated paving without baked dark corners.
    if info.get('blotch'):
        broad = nodes.new('ShaderNodeTexNoise')
        broad.inputs['Scale'].default_value = 0.25
        broad.inputs['Detail'].default_value = 3
        links.new(geo.outputs['Position'], broad.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.65,0.60,0.52,1)
        ramp.color_ramp.elements[1].color = (1,1,1,1)
        links.new(broad.outputs['Fac'], ramp.inputs['Fac'])
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = min(0.8, info['blotch'])
        links.new(tex.outputs['Color'],mix.inputs[1])
        links.new(ramp.outputs['Color'],mix.inputs[2])
        links.new(mix.outputs[0],bs.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.22
    bump.inputs['Distance'].default_value = 0.001 if name in ['gold','bronze'] else 0.008
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    normal_path = args.scene / (name+'_normal.png')
    if normal_path.exists():
        nt = nodes.new('ShaderNodeTexImage')
        nt.image = bpy.data.images.load(str(normal_path))
        nt.image.colorspace_settings.name = 'Non-Color'
        nm = nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.45
        # Flipping image V below also reverses the tangent bitangent; invert
        # normal-map green so stone relief keeps the source orientation.
        flip = nodes.new('ShaderNodeVectorMath')
        flip.operation = 'MULTIPLY_ADD'
        flip.inputs[1].default_value = (1,-1,1)
        flip.inputs[2].default_value = (0,1,0)
        links.new(nt.outputs['Color'],flip.inputs[0])
        links.new(flip.outputs[0], nm.inputs['Color'])
        links.new(nm.outputs['Normal'], bump.inputs['Normal'])
    links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    materials[name] = mat

for group in data['groups']:
    name = group['mat']+'_'+group['layer']
    pos = np.asarray(group['pos'], dtype=np.float32).reshape(-1,3)
    pos = pos[:, [0,2,1]].copy()
    pos[:,1] *= -1
    idx = np.asarray(group['idx'], dtype=np.int32)
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(len(pos))
    mesh.vertices.foreach_set('co', pos.ravel())
    mesh.loops.add(len(idx))
    mesh.loops.foreach_set('vertex_index', idx)
    mesh.polygons.add(len(idx)//3)
    mesh.polygons.foreach_set('loop_start', np.arange(0,len(idx),3,dtype=np.int32))
    mesh.polygons.foreach_set('loop_total', np.full(len(idx)//3,3,dtype=np.int32))
    uv = np.asarray(group['uv'],dtype=np.float32).reshape(-1,2)[idx].copy()
    # Canvas row zero is the top; Blender image UV zero is the bottom.
    uv[:,1] = 1-uv[:,1]
    mesh.uv_layers.new(name='UVMap').data.foreach_set('uv', uv.ravel())
    mesh.update()
    normals = np.asarray(group['nrm'],dtype=np.float32).reshape(-1,3)[:,[0,2,1]].copy()
    normals[:,1] *= -1
    mesh.polygons.foreach_set('use_smooth', np.ones(len(idx)//3,dtype=bool))
    mesh.normals_split_custom_set_from_vertices(normals.tolist())
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(materials[group['mat']])
    print('Imported',name,len(idx)//3,'triangles',flush=True)

world = bpy.data.worlds.new('Jerusalem morning sky')
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
sky = wn.new('ShaderNodeTexSky')
sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_elevation = data['sun']['alt']
sun_dir = coord(data['sun']['dir'])
# Nishita rotation starts at +Y and turns toward +X, unlike atan2(y,x).
# This reproduces the HTML sun vector after the world-to-Blender rotation.
sky.sun_rotation = math.atan2(sun_dir[0],sun_dir[1])
sky.sun_disc = True
sky.sun_size = math.radians(args.sun_size)
# The sky model handles disc size; keep its daylight intensity unchanged.
sky.sun_intensity = 1.0
sky.altitude = 740
sky.air_density = 1.0
world.node_tree.links.new(sky.outputs['Color'],wn.get('Background').inputs['Color'])
wn.get('Background').inputs['Strength'].default_value = 0.3

camera_data = bpy.data.cameras.new('Demo camera')
camera = bpy.data.objects.new('Demo camera',camera_data)
scene.collection.objects.link(camera)
camera.location = coord(camera_spec['eye'])
direction = Vector(coord(camera_spec['target']))-camera.location
camera.rotation_euler = direction.to_track_quat('-Z','Y').to_euler()
camera_data.type = 'PERSP'
camera_data.sensor_fit = 'HORIZONTAL'
camera_data.angle = math.radians(camera_spec['fov'])
camera_data.clip_end = 5000
scene.camera = camera
# Smoke retains the browser's particle placement at t=2 seconds. Fire is a
# procedural volume over the real ember bed, not repeated flame silhouettes.
grid = np.linspace(-1,1,128,dtype=np.float32)
xx, yy = np.meshgrid(grid,grid)
radius = np.sqrt(xx*xx+yy*yy)
shape = (np.maximum(0,1-radius)**1.8 *
         np.clip(0.72+0.17*np.sin(xx*19+np.sin(yy*13))*np.cos(yy*17)+
                 0.11*np.sin(xx*37+yy*29),0,1))
pixels = np.ones((128,128,4),dtype=np.float32)
pixels[:,:,3] = shape
sprite = bpy.data.images.new('Soft turbulent smoke',width=128,height=128,alpha=True)
sprite.pixels.foreach_set(pixels.ravel())
sprite.pack()
right = camera.rotation_euler.to_matrix() @ Vector((1,0,0))
up = camera.rotation_euler.to_matrix() @ Vector((0,1,0))

def smooth(a,b,x):
    t = max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

for number, p in enumerate(data.get('particles', [])):
    x,y,z,_,_,seed,size,rise,kind = p
    # Furniture is hidden in this closed exterior scene.
    if size < 0.4 or not kind:
        continue
    life = (2/(8.5 if kind else 1.35)+seed)%1
    fade = smooth(0,0.10,life)*(1-smooth(0.58 if kind else 0.40,1,life))
    if fade < 0.01:
        continue
    drift = (2.6 if kind else 0.30)*life
    center = Vector(coord((x+math.sin(seed*31.4+2*0.55)*drift,
                           y+life*rise+(0 if kind else 0.85),
                           z+math.cos(seed*17.7+2*0.47)*drift)))
    extent = size*(0.45+2.6*life if kind else 1-0.5*life)
    corners = [(-1,-1),(1,-1),(1,1),(-1,1)]
    vertices = [center+(right*a*(1 if kind else 0.65)+
                        up*b*(1 if kind else 1.5))*extent for a,b in corners]
    mesh = bpy.data.meshes.new('Smoke puff' if kind else 'Flame tongue')
    mesh.from_pydata(vertices,[],[(0,1,2,3)])
    mesh.uv_layers.new().data.foreach_set('uv',[0,0,1,0,1,1,0,1])
    obj = bpy.data.objects.new(mesh.name+' '+str(number),mesh)
    scene.collection.objects.link(obj)
    obj.visible_shadow = False
    mat = bpy.data.materials.new(obj.name)
    mat.use_nodes = True
    n,l = mat.node_tree.nodes,mat.node_tree.links
    n.clear()
    output = n.new('ShaderNodeOutputMaterial')
    mix = n.new('ShaderNodeMixShader')
    transparent = n.new('ShaderNodeBsdfTransparent')
    tex = n.new('ShaderNodeTexImage')
    tex.image = sprite
    multiply = n.new('ShaderNodeMath')
    multiply.operation = 'MULTIPLY'
    multiply.inputs[1].default_value = fade*(0.22 if kind else 1)
    l.new(tex.outputs['Alpha'],multiply.inputs[0])
    l.new(multiply.outputs[0],mix.inputs[0])
    l.new(transparent.outputs[0],mix.inputs[1])
    shader = n.new('ShaderNodeBsdfDiffuse')
    shade = 0.48-0.22*life
    shader.inputs['Color'].default_value = (shade,shade*0.96,shade*0.91,1)
    l.new(shader.outputs[0],mix.inputs[2])
    l.new(mix.outputs[0],output.inputs['Surface'])
    obj.data.materials.append(mat)

# A small, irregular emitting volume, bounded by the actual hearth. Noise
# varies through its depth, with thinner and cooler tongues toward the top.
ember = next(g for g in data['groups'] if g['mat'] == 'fire')
ep = np.asarray(ember['pos']).reshape(-1,3)
mid = (ep.min(axis=0)+ep.max(axis=0))*0.5
fire_height = 4.5
bpy.ops.mesh.primitive_cube_add(size=1, location=coord((mid[0],ep[:,1].max()+fire_height/2,mid[2])))
fire_obj = bpy.context.object
fire_obj.name = 'Altar fire volume'
fire_obj.scale = (7,7,fire_height)
mat = bpy.data.materials.new('Turbulent amber fire')
mat.use_nodes = True
n,l = mat.node_tree.nodes, mat.node_tree.links
n.clear()

def calc(operation, a, b=None):
    node = n.new('ShaderNodeMath')
    node.operation = operation
    for i,value in enumerate([a,b]):
        if value is None:
            continue
        if isinstance(value,(int,float)):
            node.inputs[i].default_value = value
        else:
            l.new(value,node.inputs[i])
    return node.outputs[0]

tc = n.new('ShaderNodeTexCoord')
xyz = n.new('ShaderNodeSeparateXYZ')
l.new(tc.outputs['Generated'],xyz.inputs[0])
center = n.new('ShaderNodeVectorMath')
center.operation = 'SUBTRACT'
center.inputs[1].default_value = (0.5,0.5,0)
l.new(tc.outputs['Generated'],center.inputs[0])
scale = n.new('ShaderNodeVectorMath')
scale.operation = 'MULTIPLY'
scale.inputs[1].default_value = (2,2,0)
l.new(center.outputs[0],scale.inputs[0])
length = n.new('ShaderNodeVectorMath')
length.operation = 'LENGTH'
l.new(scale.outputs[0],length.inputs[0])
radial = calc('MAXIMUM',calc('SUBTRACT',calc('SUBTRACT',1,length.outputs['Value']),
                          calc('MULTIPLY',xyz.outputs['Z'],0.45)),0)
stretch = n.new('ShaderNodeVectorMath')
stretch.operation = 'MULTIPLY'
stretch.inputs[1].default_value = (5,5,2)
l.new(tc.outputs['Generated'],stretch.inputs[0])
noise = n.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3
noise.inputs['Detail'].default_value = 3
noise.inputs['Roughness'].default_value = 0.7
l.new(stretch.outputs[0],noise.inputs['Vector'])
threshold = calc('ADD',0.43,calc('MULTIPLY',xyz.outputs['Z'],0.15))
turbulence = calc('MAXIMUM',calc('MULTIPLY',calc('SUBTRACT',noise.outputs['Fac'],threshold),8),0)
columns = n.new('ShaderNodeTexVoronoi')
columns.voronoi_dimensions = '2D'
columns.inputs['Scale'].default_value = 3.4
l.new(tc.outputs['Generated'],columns.inputs['Vector'])
random_height = n.new('ShaderNodeSeparateColor')
l.new(columns.outputs['Color'],random_height.inputs[0])
top = calc('ADD',0.40,calc('MULTIPLY',random_height.outputs[0],0.55))
taper = calc('MAXIMUM',calc('SUBTRACT',1,calc('DIVIDE',xyz.outputs['Z'],top)),0)
width = calc('MULTIPLY',taper,0.38)
core = calc('MAXIMUM',calc('SUBTRACT',width,columns.outputs['Distance']),0)
field = calc('MINIMUM',calc('MULTIPLY',calc('MULTIPLY',radial,core),
                         calc('MULTIPLY',turbulence,16)),1)
volume = n.new('ShaderNodeVolumePrincipled')
volume.inputs['Blackbody Intensity'].default_value = 0
l.new(calc('MULTIPLY',field,0.10),volume.inputs['Density'])
volume.inputs['Color'].default_value = (0.12,0.09,0.065,1)
l.new(calc('MULTIPLY',field,1.8),volume.inputs['Emission Strength'])
blackbody = n.new('ShaderNodeBlackbody')
l.new(calc('ADD',2050,calc('MULTIPLY',field,300)),blackbody.inputs['Temperature'])
l.new(blackbody.outputs['Color'],volume.inputs['Emission Color'])
output = n.new('ShaderNodeOutputMaterial')
l.new(volume.outputs['Volume'],output.inputs['Volume'])
fire_obj.data.materials.append(mat)

scene.render.resolution_x = 1000 if args.preview else 2400
scene.render.resolution_y = 750 if args.preview else 1800
if args.width:
    scene.render.resolution_x = args.width
    scene.render.resolution_y = round(args.width*3/4)
scene.render.resolution_percentage = 100
if args.detail:
    scene.render.resolution_x = 3200
    scene.render.resolution_y = 2400
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = 0.47, 0.58
    scene.render.border_min_y, scene.render.border_max_y = 0.51, 0.65
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -2.3
name = 'temple-preview' if args.preview else 'temple-demo'
if args.width or args.view != 'close':
    name = 'temple-'+args.view+'-blender'
if args.detail:
    name = 'temple-fire-detail'
# Windows image viewers may hold the previous PNG open. Preserve prior renders
# and choose a fresh filename so an open preview cannot lose a finished render.
image_path = args.scene / (name+'.png')
revision = 2
while image_path.exists():
    image_path = args.scene / (name+'-'+str(revision)+'.png')
    revision += 1
scene.render.filepath = str(image_path)
bpy.ops.file.pack_all()
if not args.detail:
    bpy.ops.wm.save_as_mainfile(filepath=str(args.scene / (name+'.blend')))
print('Rendering', scene.render.resolution_x, 'x', scene.render.resolution_y,
      'at', scene.cycles.samples, 'samples on', scene.cycles.device,
      'to', scene.render.filepath, flush=True)
bpy.ops.render.render(write_still=True)
print('Rendered',scene.render.filepath,flush=True)
