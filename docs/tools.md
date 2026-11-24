# AE Bridge Tools Reference

Auto-generated reference documentation for all **165 MCP tools** provided by the AE Bridge server.

## Table of Contents

- [Core & Health](#core-health) (3 tools)
- [Compositions](#compositions) (8 tools)
- [Layers & Transform](#layers-transform) (12 tools)
- [Animation & Keyframes](#animation-keyframes) (7 tools)
- [Effects](#effects) (5 tools)
- [Titles & Lower Thirds](#titles-lower-thirds) (4 tools)
- [Footage & Media](#footage-media) (6 tools)
- [Timeline & Editing](#timeline-editing) (7 tools)
- [Transitions](#transitions) (2 tools)
- [Time Remapping & Speed](#time-remapping-speed) (5 tools)
- [Audio Management](#audio-management) (6 tools)
- [Color Grading & Looks](#color-grading-looks) (3 tools)
- [3D Layers & Extrusions](#3d-layers-extrusions) (7 tools)
- [Cameras & Motion](#cameras-motion) (5 tools)
- [Lighting & Shading](#lighting-shading) (3 tools)
- [3D Motion Graphics Scenes](#3d-motion-graphics-scenes) (3 tools)
- [Cinematic Looks & Presets](#cinematic-looks-presets) (2 tools)
- [Particle Systems](#particle-systems) (2 tools)
- [Procedural Backgrounds](#procedural-backgrounds) (1 tools)
- [Distortion & Glitch](#distortion-glitch) (3 tools)
- [Motion & Physics Rigs](#motion-physics-rigs) (5 tools)
- [Vision & Preview](#vision-preview) (4 tools)
- [Quality Assurance (QA)](#quality-assurance-qa-) (3 tools)
- [Project & Checkpoints](#project-checkpoints) (10 tools)
- [Rendering & Export](#rendering-export) (6 tools)
- [Social Variants & Reframe](#social-variants-reframe) (2 tools)
- [Essential Graphics & Templates](#essential-graphics-templates) (4 tools)
- [Asset & Beat Analysis](#asset-beat-analysis) (3 tools)
- [Brand Identity Kit](#brand-identity-kit) (2 tools)
- [Storyboard & Director](#storyboard-director) (3 tools)
- [Video Production Recipes](#video-production-recipes) (3 tools)
- [Render Quality & Standards](#render-quality-standards) (1 tools)
- [Motion Language & Easing](#motion-language-easing) (2 tools)
- [Design Styles & Aesthetics](#design-styles-aesthetics) (3 tools)
- [Finishing Pass & Compositing](#finishing-pass-compositing) (2 tools)
- [Reference Matching & Palette](#reference-matching-palette) (3 tools)
- [Blender 3D Photoreal Engine](#blender-3d-photoreal-engine) (13 tools)
- [Blender AE Compositing & Sync](#blender-ae-compositing-sync) (2 tools)

---

## Core & Health

### `ae_ping`

Ping After Effects to check connection, version, and active project.

*No parameters required.*

### `ae_get_project_info`

Get information about the open project and compositions in After Effects.

*No parameters required.*

### `ae_execute_extendscript`

LAST RESORT: run raw ExtendScript only when no dedicated ae_ tool can do the job.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `code` | `string` | **Yes** | ExtendScript code to execute in After Effects | - |

---

## Compositions

### `ae_create_comp`

Create a new composition in After Effects with custom dimensions, duration, and frame rate.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | **Yes** | Name of the new composition | - |
| `width` | `integer` | No | Width in pixels (default 1920) | `1920` |
| `height` | `integer` | No | Height in pixels (default 1080) | `1080` |
| `duration` | `number` | No | Duration in seconds (default 10) | `10` |
| `frameRate` | `number` | No | Frame rate in fps (default 30) | `30` |
| `pixelAspect` | `number` | No | Pixel aspect ratio (default 1.0) | `1` |
| `bgColor` | `array | string` | No | Background color of the composition | - |

### `ae_list_comps`

List all compositions in the current After Effects project with their dimensions and layer counts.

*No parameters required.*

### `ae_get_comp`

Get detailed composition settings, dimensions, frame rate, and summaries of all layers.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |

### `ae_update_comp`

Update settings of an existing composition such as dimensions, duration, frame rate, or work area.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | No | New composition name | - |
| `width` | `integer` | No | New width in pixels | - |
| `height` | `integer` | No | New height in pixels | - |
| `duration` | `number` | No | New duration in seconds | - |
| `frameRate` | `number` | No | New frame rate in fps | - |
| `pixelAspect` | `number` | No | New pixel aspect ratio | - |
| `bgColor` | `array | string` | No | New background color | - |
| `workAreaStart` | `number` | No | Work area start time in seconds | - |
| `workAreaDuration` | `number` | No | Work area duration in seconds | - |

### `ae_open_comp`

Open a composition in the active After Effects viewer panel.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |

### `ae_precompose`

Precompose selected layers into a new nested composition within After Effects.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | List of layer references to precompose | - |
| `name` | `string` | **Yes** | Name of the new precomposition | - |
| `moveAllAttributes` | `boolean` | No | Move all attributes into new comp (default true) | `true` |

### `ae_duplicate_comp`

Duplicate an existing composition in the project with an optional new name.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `newName` | `string` | No | Optional new name for the duplicated composition | - |

### `ae_delete_item`

Delete a project item (composition, footage, or folder) from After Effects by its item ID.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemId` | `integer` | **Yes** | ID of the project item to delete | - |

---

## Layers & Transform

### `ae_add_solid`

Add a colored solid or adjustment layer to a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | **Yes** | Name of the solid layer | - |
| `color` | `array | string` | **Yes** | Color of the solid layer | - |
| `width` | `integer` | No | Width in pixels (defaults to comp width) | - |
| `height` | `integer` | No | Height in pixels (defaults to comp height) | - |
| `adjustment` | `boolean` | No | Whether to create as an adjustment layer | `false` |

### `ae_add_null`

Add a null object layer to a composition for parenting, rigging, and motion control.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | **Yes** | Name of the null layer | - |

### `ae_add_text`

Add a text layer with formatting, font, size, fill color, and alignment to a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `text` | `string` | **Yes** | Text string content to display | - |
| `font` | `string` | No | Font family or PostScript font name | - |
| `fontSize` | `number` | No | Font size in points (default 100) | `100` |
| `fillColor` | `array | string` | No | Text fill color | - |
| `justification` | `"left" | "center" | "right"` | No | Paragraph text alignment | - |
| `position` | `array` | No | 2D position [x, y] in pixels (defaults to comp center) | - |

### `ae_add_shape`

Add a parametric shape layer (rectangle, ellipse, star, or polygon) with optional fill, stroke, and roundness.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | **Yes** | Name of the shape layer | - |
| `shape` | `"rectangle" | "ellipse" | "star" | "polygon"` | **Yes** | Parametric shape geometry | - |
| `size` | `array` | **Yes** | Shape dimensions [width, height] in pixels | - |
| `fillColor` | `array | string` | No | Shape fill color | - |
| `strokeColor` | `any` | No | Shape stroke color | - |
| `strokeWidth` | `number` | No | Stroke width in pixels | - |
| `roundness` | `number` | No | Corner roundness in pixels | - |

### `ae_add_camera`

Add a 3D camera layer to a composition with an optional lens preset and 3D position.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | **Yes** | Name of the camera layer | - |
| `preset` | `"35mm" | "50mm" | "85mm"` | No | Lens focal length preset | - |
| `position` | `array` | No | Initial 3D position [x, y, z] in pixels | - |

### `ae_add_light`

Add a light layer (point, spot, parallel, or ambient) to illuminate 3D layers in a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `name` | `string` | **Yes** | Name of the light layer | - |
| `type` | `"point" | "spot" | "parallel" | "ambient"` | **Yes** | Type of light | - |
| `color` | `array | string` | No | Color of emitted light | - |
| `intensity` | `number` | No | Light intensity percentage (default 100) | - |

### `ae_list_layers`

List all layers in a composition with summaries of their types, switches, timing, and parent hierarchy.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |

### `ae_update_layer`

Update layer properties including switches, timing, blend mode, label color, and parent link.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to update | - |
| `name` | `string` | No | New layer name | - |
| `enabled` | `boolean` | No | Layer visibility switch | - |
| `solo` | `boolean` | No | Layer solo switch | - |
| `locked` | `boolean` | No | Layer lock switch | - |
| `shy` | `boolean` | No | Layer shy switch | - |
| `threeD` | `boolean` | No | Layer 3D switch | - |
| `inPoint` | `number` | No | Layer in-point time in seconds | - |
| `outPoint` | `number` | No | Layer out-point time in seconds | - |
| `startTime` | `number` | No | Layer start time in seconds | - |
| `parent` | `object | null` | No | Parent layer reference, or null to unparent | - |
| `blendMode` | `string` | No | Layer blending mode ('normal', 'add', 'screen', 'multiply', 'overlay', 'softLight', etc.) | - |
| `label` | `integer` | No | Label color index (0-16) | - |

### `ae_set_transform`

Set static transform values (anchorPoint, position, scale, rotation, opacity) on a layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to modify transform on | - |
| `anchorPoint` | `array` | No | Anchor point [x, y] or [x, y, z] in pixels | - |
| `position` | `array` | No | Position [x, y] or [x, y, z] in pixels | - |
| `scale` | `number | array` | No | Scale percentage as uniform number or [x, y, z] array | - |
| `rotation` | `number` | No | Rotation angle in degrees (Z-axis rotation for 3D layers) | - |
| `rotationX` | `number` | No | X-axis rotation angle in degrees for 3D layers | - |
| `rotationY` | `number` | No | Y-axis rotation angle in degrees for 3D layers | - |
| `rotationZ` | `number` | No | Z-axis rotation angle in degrees for 3D layers | - |
| `orientation` | `array` | No | 3D orientation [x, y, z] in degrees | - |
| `opacity` | `number` | No | Opacity percentage (0-100) | - |

### `ae_duplicate_layer`

Duplicate an existing layer within a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to duplicate | - |

### `ae_delete_layer`

Delete a layer from a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to delete | - |

### `ae_reorder_layer`

Change the stacking order index of a layer in a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to move | - |
| `newIndex` | `integer` | **Yes** | Target 1-based index in the layer stack | - |

---

## Animation & Keyframes

### `ae_list_properties`

List animatable properties and groups of a layer in After Effects up to a given depth.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to inspect | - |
| `path` | `string | array` | No | Optional property or group path to start from | - |
| `depth` | `integer` | No | Traversal depth for child groups (default 2) | `2` |

### `ae_get_property`

Get detailed information, current value, keyframe list, and expression for a property.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path (e.g. ['Transform', 'Position'] or shortcut 'position') | - |

### `ae_set_property`

Set the static value of an After Effects property (number, array, hex color, boolean, or string).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path (e.g. ['Transform', 'Opacity'] or shortcut 'opacity') | - |
| `value` | `number | string | boolean | array` | **Yes** | Value to assign (scalar, number array, or hex color string) | - |

### `ae_add_keyframes`

Add or update keyframes on a property with professional easing curves (linear, easeIn, easeOut, easyEase, hold, bezier).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path (e.g. ['Transform', 'Position'] or 'scale') | - |
| `keyframes` | `array` | **Yes** | List of keyframes to set with time, value, and optional easing parameters | - |

### `ae_remove_keyframes`

Remove keyframes from an After Effects property by times or clear all keyframes.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path | - |
| `times` | `array` | No | Optional array of keyframe times in seconds to delete. If omitted, all keyframes are removed. | - |

### `ae_set_expression`

Set or remove an expression on an After Effects property. Pass an empty string to remove.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path | - |
| `expression` | `string` | **Yes** | Expression script string to assign, or empty string to disable and remove | - |

### `ae_animate`

Apply quick professional motion presets ('fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'scalePop', 'spinIn', 'blurIn', 'typewriter') with snappy ease-out curves.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to animate | - |
| `preset` | `"fadeIn" | "fadeOut" | "slideInLeft" | "slideInRight" | "slideInUp" | "slideInDown" | "scalePop" | "spinIn" | "blurIn" | "typewriter"` | **Yes** | Motion graphics animation preset | - |
| `startTime` | `number` | No | Animation start time in seconds (default 0) | `0` |
| `duration` | `number` | No | Animation duration in seconds (default 0.6) | `0.6` |
| `options` | `object` | No | Optional preset parameters (e.g. { distance: 1920, rotations: 2, blurriness: 80 }) | - |

---

## Effects

### `ae_list_installed_effects`

List all installed After Effects plugins and effects with display names, matchNames, and categories.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `filter` | `string` | No | Case-insensitive keyword to filter effect names, matchNames, or categories | - |

### `ae_add_effect`

Add an effect to a layer in After Effects and optionally initialize its property values.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `effect` | `string` | **Yes** | Effect display name or matchName (e.g. 'Gaussian Blur' or 'ADBE Gaussian Blur 2') | - |
| `properties` | `object` | No | Initial property values to assign (e.g. { 'Blurriness': 25 }) | - |

### `ae_set_effect_property`

Set the value of an effect parameter on a layer (supports numbers, arrays, booleans, and colors).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `effect` | `string,number` | **Yes** | Effect display name, matchName, or 1-based index | - |
| `property` | `string` | **Yes** | Property name on the effect (e.g. 'Blurriness' or 'Color') | - |
| `value` | `number | string | boolean | array` | **Yes** | Value to assign (scalar, array, or hex color) | - |

### `ae_list_layer_effects`

List all effects applied to a layer including their enabled state and current parameter values.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |

### `ae_remove_effect`

Remove an effect from a layer by name or 1-based index.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `effect` | `string,number` | **Yes** | Effect name, matchName, or 1-based index to remove | - |

---

## Titles & Lower Thirds

### `ae_create_title_card`

Create a complete cinematic title card composition with typography, gold/color accent, atmosphere background, and coordinated animations.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compName` | `string` | No | Composition name (default: title + ' — Title Card') | - |
| `title` | `string` | **Yes** | Main title text to display (e.g. 'THE LAST SIGNAL') | - |
| `subtitle` | `string` | No | Subtitle text to display below the title (e.g. 'A film by Alex Rivera') | - |
| `accentColor` | `array | string` | No | Accent element color (hex or [r,g,b] array, default gold '#D4AF37') | - |
| `titleColor` | `any` | No | Main title text color (default platinum white '#F5F5F7') | - |
| `subtitleColor` | `any` | No | Subtitle text color (default matches accentColor) | - |
| `bgColor` | `any` | No | Background atmosphere color (default '#08090D') | - |
| `accentStyle` | `"line" | "bar" | "box" | "glow" | "none"` | No | Style of visual accent element | `line` |
| `style` | `"cinematic" | "minimal" | "bold" | "dramatic" | "neon"` | No | Overall aesthetic style preset | `cinematic` |
| `width` | `integer` | No | Width in pixels (default 1920) | `1920` |
| `height` | `integer` | No | Height in pixels (default 1080) | `1080` |
| `duration` | `number` | No | Duration in seconds (default 8) | `8` |
| `frameRate` | `number` | No | Frame rate in fps (default 24) | `24` |
| `animate` | `boolean` | No | Whether to generate professional push-in, reveal, and fade animations | `true` |

### `ae_create_lower_third`

Create a broadcast-quality lower third composition or layer group in bar, modern, or boxed style.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compName` | `string` | No | Composition name (default: name + ' — Lower Third') | - |
| `compRef` | `object` | No | Optional reference to an existing composition to add the lower third into | - |
| `name` | `string` | **Yes** | Primary name text (e.g. 'Alex Rivera') | - |
| `title` | `string` | No | Secondary role/title text (e.g. 'Motion Designer') | - |
| `style` | `"bar" | "minimal" | "boxed" | "modern" | "line"` | No | Visual style preset of the lower third | `bar` |
| `accentColor` | `array | string` | No | Accent bar color (default gold '#D4AF37') | - |
| `primaryColor` | `any` | No | Primary text color (default '#FFFFFF') | - |
| `secondaryColor` | `any` | No | Secondary text color (default '#D4AF37') | - |
| `plateColor` | `any` | No | Background container plate color (default '#0F141F') | - |
| `plateOpacity` | `number` | No | Plate opacity percentage (0-100) | `92` |
| `position` | `array` | No | Anchor [x, y] position in pixels (default lower-left [260, 880]) | - |
| `width` | `integer` | No | Width in pixels (default 1920) | `1920` |
| `height` | `integer` | No | Height in pixels (default 1080) | `1080` |
| `duration` | `number` | No | Duration in seconds (default 6) | `6` |
| `frameRate` | `number` | No | Frame rate in fps (default 30) | `30` |
| `animate` | `boolean` | No | Whether to generate intro wipe, hold, and outro resolve animations | `true` |

### `ae_apply_title_preset`

Apply high-level title styling or motion preset to a text layer ('fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'scalePop', 'spinIn', 'blurIn', 'typewriter', 'cinematicPush', 'trackingOut').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target text layer | - |
| `preset` | `"fadeUpChars" | "blurReveal" | "trackingCollapse" | "popWords" | "typewriter" | "flip3D" | "slideMaskUp" | "glitchIn" | "scaleDownSettle" | "lineByLine" | "fadeIn" | "fadeOut" | "slideInLeft" | "slideInRight" | "slideInUp" | "slideInDown" | "scalePop" | "spinIn" | "blurIn" | "cinematicPush" | "trackingOut"` | **Yes** | Title motion preset | - |
| `startTime` | `number` | No | Start time in seconds (default 0) | `0` |
| `duration` | `number` | No | Duration in seconds (default 0.6) | `0.6` |
| `options` | `object` | No | Optional animation tuning parameters (e.g. tracking, blur, rotations) | - |

### `ae_add_text_animator`

Add an After Effects Text Animator group with custom animated properties (opacity, tracking, position, scale, rotation, blur, color) and Range or Wiggly selectors.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target text layer | - |
| `name` | `string` | No | Name of the animator group | `Text Animator` |
| `properties` | `object` | **Yes** | Map of animator properties to add | - |
| `selectorType` | `"range" | "wiggly"` | No | Selector type | `range` |
| `basedOn` | `"characters" | "charactersExcludingSpaces" | "words" | "lines"` | No | Units selection basis | `characters` |
| `start` | `number` | No | Selector start percentage (0-100) | - |
| `end` | `number` | No | Selector end percentage (0-100) | - |
| `offset` | `number` | No | Selector offset percentage (-100 to 100) | - |
| `animate` | `object` | No | Optional keyframed selector animation specification | - |

---

## Footage & Media

### `ae_import_files`

Import one or more media files (video, audio, image, image sequence) into the After Effects project.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `paths` | `array` | **Yes** | Array of absolute file paths to import | - |
| `folderName` | `string` | No | Optional project folder name to organize imported files into (created if missing) | - |
| `asSequence` | `boolean` | No | Whether to import files as a numbered image sequence | `false` |

### `ae_import_folder`

Import all supported media files from a local directory into a dedicated After Effects project bin folder.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `folderPath` | `string` | **Yes** | Absolute path to the local directory to import | - |
| `extensions` | `array` | No | File extension filters (default: video, audio, graphics) | `mp4,mov,png,jpg,wav,mp3,psd,ai` |
| `recursive` | `boolean` | No | Whether to recursively scan nested subdirectories | `false` |

### `ae_list_footage`

List all footage, media assets, and solids currently in the After Effects project with resolution, duration, and file paths.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `filter` | `string` | No | Optional case-insensitive search filter for footage name or file path | - |

### `ae_interpret_footage`

Modify footage interpretation settings including frame rate conforming, alpha mode, and looping.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemId` | `integer` | **Yes** | Project item ID of the footage item to interpret | - |
| `conformFrameRate` | `number` | No | Conform footage playback frame rate in fps (e.g. 24, 29.97, 60) | - |
| `alphaMode` | `"straight" | "premultiplied" | "ignore"` | No | Alpha channel interpretation | - |
| `loop` | `integer` | No | Number of times to loop playback | - |

### `ae_replace_footage`

Replace a footage item's source file with a new file path while preserving all timeline uses and layer edits.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemId` | `integer` | **Yes** | Project item ID of the footage to replace | - |
| `newPath` | `string` | **Yes** | Absolute path to the replacement file | - |

### `ae_create_comp_from_footage`

Create a new composition from one or multiple footage items, optionally sequencing them sequentially.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemIds` | `array` | **Yes** | Array of project footage item IDs to add to the new comp | - |
| `name` | `string` | No | Composition name (defaults to first footage item name + ' Comp') | - |
| `sequence` | `boolean` | No | Whether to sequence layers back-to-back in timeline order | `false` |
| `useFootageSettings` | `boolean` | No | Whether to inherit composition dimensions and framerate from the lead footage | `true` |

---

## Timeline & Editing

### `ae_add_footage_to_comp`

Add a footage asset from the project bins into a composition with optional trim, timing, and aspect scaling.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `itemId` | `integer` | **Yes** | Project item ID of the footage or media asset | - |
| `startTime` | `number` | No | Timeline start time in seconds (default 0) | `0` |
| `inPoint` | `number` | No | Optional source in-point trim in seconds | - |
| `outPoint` | `number` | No | Optional source out-point trim in seconds | - |
| `fit` | `"none" | "fit" | "fill" | "stretch"` | No | Aspect ratio fit mode | `none` |

### `ae_trim_layer`

Trim a layer's in-point and/or out-point without moving its source content or keyframe timing.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to trim | - |
| `inPoint` | `number` | No | New layer in-point time in seconds | - |
| `outPoint` | `number` | No | New layer out-point time in seconds | - |

### `ae_split_layer`

Split a layer into two at a specific point in time (creates a duplicate with matching in/out cuts).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Layer to split | - |
| `time` | `number` | **Yes** | Split timestamp in seconds | - |

### `ae_sequence_layers`

Arrange multiple layers back-to-back in timeline order with optional gap or overlap.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | Ordered array of layer references to sequence | - |
| `startTime` | `number` | No | Start time in seconds for the first clip (default 0) | `0` |
| `gap` | `number` | No | Gap in seconds between clips (negative values create cross-fade overlaps) | `0` |

### `ae_ripple_delete`

Delete a layer from the composition and shift all subsequent layers to close the gap.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to ripple delete | - |

### `ae_fit_layer`

Scale and center a layer to fit, fill, or stretch to the composition dimensions.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to fit | - |
| `mode` | `"fit" | "fill" | "stretch"` | **Yes** | Fitting mode ('fit' preserves aspect, 'fill' crops, 'stretch' skews) | - |

### `ae_build_edit`

High-level AI timeline builder: construct an entire edited video composition from a structured edit decision list (EDL) in one call.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Optional existing comp to place the edit into (if omitted, a new comp is created) | - |
| `name` | `string` | No | Name of the newly created composition (default 'AI Master Edit') | - |
| `width` | `integer` | No | Composition width in pixels | `1920` |
| `height` | `integer` | No | Composition height in pixels | `1080` |
| `frameRate` | `number` | No | Composition frame rate in fps | `30` |
| `clips` | `array` | **Yes** | List of clips in timeline order | - |
| `musicItemId` | `integer` | No | Optional background music track footage item ID | - |

---

## Transitions

### `ae_add_transition`

Add a smooth, high-impact motion graphic transition between two overlapping or adjacent layers in a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerA` | `object` | **Yes** | Outgoing layer | - |
| `layerB` | `object` | **Yes** | Incoming layer | - |
| `type` | `"crossDissolve" | "dipToBlack" | "dipToWhite" | "slideLeft" | "slideRight" | "pushUp" | "zoomIn" | "zoomBlur" | "linearWipe" | "radialWipe" | "glitchCut" | "whipPan"` | **Yes** | Transition type preset | - |
| `duration` | `number` | No | Transition duration in seconds (default 0.5) | `0.5` |

### `ae_list_transitions`

List all available video transition types with categories and animation descriptions.

*No parameters required.*

---

## Time Remapping & Speed

### `ae_set_speed`

Change layer playback speed percentage using stretch (e.g. 100 for normal, 200 for 2x fast-motion, 50 for slow-motion, -100 for reverse).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to change speed | - |
| `speed` | `number` | **Yes** | Speed percentage (positive for forward, negative for reverse playback) | - |

### `ae_enable_time_remap`

Enable time remapping on a layer to allow non-linear retiming, freeze frames, and variable speed ramps.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to enable time remapping | - |

### `ae_speed_ramp`

Apply a smooth multi-point speed ramp curve (e.g. fast-to-slow-to-fast) using time remapping with bezier easing.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to speed ramp | - |
| `points` | `array` | **Yes** | Array of keyframe points defining the speed curve | - |

### `ae_freeze_frame`

Freeze video playback at a specific timestamp using a hold time-remapping keyframe.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to freeze | - |
| `time` | `number` | **Yes** | Timestamp in seconds to freeze | - |
| `duration` | `number` | No | Optional duration to extend the held frame | - |

### `ae_set_frame_blending`

Configure frame blending on a retimed or stretched layer for ultra-smooth optical flow or frame mix interpolation.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `mode` | `"off" | "frameMix" | "pixelMotion"` | **Yes** | Frame blending mode ('pixelMotion' uses optical flow vector interpolation) | - |

---

## Audio Management

### `ae_set_audio_level`

Set a layer's static audio gain/volume level in decibels (0 dB = unity gain, -12 dB = background bed, -48 dB = muted).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target audio or video layer | - |
| `db` | `number` | **Yes** | Audio level in decibels (dB) | - |

### `ae_fade_audio`

Apply smooth audio fade-in and/or fade-out ramps to a layer using -48 dB threshold keyframes.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target audio or video layer | - |
| `fadeIn` | `number` | No | Fade-in duration in seconds from layer in-point | - |
| `fadeOut` | `number` | No | Fade-out duration in seconds leading to layer out-point | - |

### `ae_duck_audio`

Automatically duck background music volume while a dialogue, narration, or voiceover layer is actively speaking.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `musicLayer` | `object` | **Yes** | Background music layer to be ducked | - |
| `voiceLayer` | `object` | **Yes** | Dialogue or voiceover reference layer controlling the duck timing | - |
| `duckDb` | `number` | No | Ducked attenuation level in dB (default -12 dB) | `-12` |

### `ae_audio_to_keyframes`

Convert audio amplitude waveform into animated keyframe slider values (Both Channels, Left, Right) for audio-reactive motion graphics.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Source audio layer to analyze | - |

### `ae_add_markers`

Add timeline or beat markers to a composition or specific layer with custom labels and durations.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | No | Target layer (if omitted, markers are added to the composition timeline) | - |
| `markers` | `array` | **Yes** | List of markers to create | - |

### `ae_cut_to_markers`

Automatically snap and sequence an array of video clips to composition markers (rhythm/beat synchronization).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | Ordered array of video clip layers to snap to comp beat markers | - |

---

## Color Grading & Looks

### `ae_color_grade`

Apply cinematic Lumetri color grading parameters (exposure, contrast, highlights, shadows, saturation, temperature, tint, vibrance) to any clip or adjustment layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target video clip or adjustment layer to grade | - |
| `exposure` | `number` | No | Exposure compensation in stops (e.g. -1.0 to +1.0) | - |
| `contrast` | `number` | No | Contrast adjustment (-100 to +100) | - |
| `highlights` | `number` | No | Highlight recovery/boost (-100 to +100) | - |
| `shadows` | `number` | No | Shadow lift/crush (-100 to +100) | - |
| `saturation` | `number` | No | Color saturation percentage (0 = black & white, 100 = neutral, 200 = hyper-saturated) | - |
| `temperature` | `number` | No | White balance color temperature (-100 cool/blue to +100 warm/amber) | - |
| `tint` | `number` | No | White balance tint (-100 green to +100 magenta) | - |
| `vibrance` | `number` | No | Smart skin-tone protective vibrance (-100 to +100) | - |

### `ae_apply_lut`

Load and apply a 3D LUT (.cube, .3dl, .look) file to a layer using After Effects' native Apply Color LUT effect.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target video clip or adjustment layer | - |
| `lutPath` | `string` | **Yes** | Absolute file path to the 3D LUT file (.cube, .3dl) | - |

### `ae_add_adjustment_grade`

Add a master adjustment layer on top of the composition with a curated cinematic color look preset.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `look` | `"cinematic" | "tealOrange" | "warm" | "cool" | "bw" | "vintage" | "highContrast"` | **Yes** | Curated color grading aesthetic preset | - |

---

## 3D Layers & Extrusions

### `ae_set_3d_renderer`

Configure composition 3D rendering engine ('classic' for Classic 3D, 'advanced' for Advanced 3D with extrusions, 'cinema4d' for C4D engine).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `renderer` | `"classic" | "advanced" | "cinema4d"` | **Yes** | Target 3D rendering engine | - |

### `ae_make_3d`

Toggle 3D layer switch on one or multiple layers in a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | List of target layers to toggle 3D | - |
| `enabled` | `boolean` | No | Whether 3D should be enabled or disabled | `true` |

### `ae_set_extrusion`

Set 3D geometric extrusion depth and bevel parameters on text or shape layers (auto-switches comp renderer to Advanced 3D if needed).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target text or shape layer | - |
| `depth` | `number` | **Yes** | Extrusion depth in pixels | - |
| `bevelStyle` | `"none" | "angular" | "concave" | "convex"` | No | Bevel edge profile style | - |
| `bevelDepth` | `number` | No | Bevel edge depth in pixels | - |
| `holeBevelDepth` | `number` | No | Bevel depth for interior holes (e.g. letters 'O', 'A') | - |

### `ae_set_material`

Set 3D physical material options (shadow casting, light reception, ambient, diffuse, specular, shininess, metal, reflection) on any 3D layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target 3D layer | - |
| `castsShadows` | `boolean` | No | Whether layer casts shadows (on/off) | - |
| `acceptsShadows` | `boolean` | No | Whether layer receives shadows from other objects | - |
| `acceptsLights` | `boolean` | No | Whether layer is illuminated by scene lights | - |
| `ambient` | `number` | No | Ambient light reflection percentage (0-100) | - |
| `diffuse` | `number` | No | Diffuse light reflection percentage (0-100) | - |
| `specular` | `number` | No | Specular highlight intensity percentage (0-100) | - |
| `shininess` | `number` | No | Specular shininess/roughness percentage (0-100) | - |
| `metal` | `number` | No | Metallic specular reflection percentage (0-100) | - |
| `reflection` | `number` | No | Surface environment reflection intensity percentage (0-100) | - |

### `ae_import_3d_model`

Import an external 3D model (.glb, .gltf, .obj) into the After Effects project and place it in a 3D composition (After Effects 2024+).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `path` | `string` | **Yes** | Absolute file path to the 3D model file (.glb, .gltf, .obj) | - |
| `compRef` | `object` | No | Optional composition to add the 3D model into | - |
| `position` | `array` | No | 3D position [x, y, z] in pixels | - |
| `scale` | `array` | No | 3D scale [x, y, z] percentage | - |

### `ae_create_3d_primitive`

Create a procedural 3D geometric primitive ('box', 'cylinder', 'plane', 'ring') as an extruded shape layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `type` | `"box" | "cylinder" | "plane" | "ring"` | **Yes** | Primitive geometry type | - |
| `size` | `array` | **Yes** | Dimensions [width, height, depth] in pixels | - |
| `color` | `array | string` | No | Surface color (hex string or [r, g, b] array) | - |
| `name` | `string` | No | Custom layer name | - |

### `ae_arrange_3d`

Arrange multiple 3D layers in space according to geometric patterns ('grid', 'circle', 'spiral', 'depthStack', 'random', 'helix').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | Ordered list of 3D layers to arrange | - |
| `pattern` | `"grid" | "circle" | "spiral" | "depthStack" | "random" | "helix"` | **Yes** | Spatial arrangement pattern | - |
| `spacing` | `number` | No | Distance/spacing between layers in pixels | `200` |
| `radius` | `number` | No | Radius for circular, spiral, or helix patterns | `500` |

---

## Cameras & Motion

### `ae_camera_rig`

Build a professional cinematography camera rig in a composition (creates camera if missing, attached to a 3D null controller for orbital and dolly maneuvers).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `cameraRef` | `object` | No | Optional reference to an existing camera layer | - |
| `type` | `"orbitNull" | "twoNode"` | No | Rig architecture | `orbitNull` |

### `ae_camera_move`

Execute an authored 3D camera cinematic move ('orbit', 'orbitHalf', 'dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'pushIn', 'flyThrough', 'spiral', 'parallaxDrift', 'dutchRoll', 'whipTo').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `cameraRef` | `object` | No | Reference to a layer (by 1-based index or name) | - |
| `move` | `"orbit" | "orbitHalf" | "dollyIn" | "dollyOut" | "truckLeft" | "truckRight" | "craneUp" | "craneDown" | "pushIn" | "flyThrough" | "spiral" | "parallaxDrift" | "dutchRoll" | "whipTo"` | **Yes** | Camera motion preset | - |
| `startTime` | `number` | No | Timeline start time in seconds (default 0) | `0` |
| `duration` | `number` | No | Move duration in seconds (default 4) | `4` |
| `amount` | `number` | No | Movement intensity / speed multiplier (default 1.0) | `1` |
| `options` | `object` | No | Additional move options (e.g. targetLayer for 'whipTo') | - |

### `ae_camera_look_at`

Dynamically bind camera Point of Interest (look-at target) to a 3D layer using an automated expression link.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `cameraRef` | `object` | No | Reference to a layer (by 1-based index or name) | - |
| `targetLayer` | `object` | **Yes** | Target layer for camera to track and look at | - |

### `ae_set_depth_of_field`

Configure camera optical depth of field (DoF), aperture, blur level, and optional dynamic focal tracking to a subject layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `cameraRef` | `object` | No | Reference to a layer (by 1-based index or name) | - |
| `enabled` | `boolean` | No | Enable or disable depth of field | `true` |
| `focusLayer` | `any` | No | Optional target layer to automatically track focal plane distance to | - |
| `aperture` | `number` | No | Lens aperture in pixels (higher = shallower depth of field / more blur) | - |
| `blurLevel` | `number` | No | Bokeh blur level percentage (default 100%) | - |

### `ae_add_camera_shake`

Add organic handheld camera shake or action tremor using a continuous procedural expression on the camera rig.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `cameraRef` | `object` | No | Reference to a layer (by 1-based index or name) | - |
| `amount` | `number` | No | Camera shake displacement magnitude in pixels (default 5) | `5` |
| `frequency` | `number` | No | Camera shake oscillations per second in Hz (default 1.5) | `1.5` |

---

## Lighting & Shading

### `ae_setup_lighting`

Deploy a complete 3D lighting rig preset ('threePoint', 'dramatic', 'neon', 'studio', 'sunset', 'moody', 'soft') with configured key, fill, rim lights and shadow parameters.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `preset` | `"threePoint" | "dramatic" | "neon" | "studio" | "sunset" | "moody" | "soft"` | **Yes** | Lighting aesthetic preset | - |
| `shadows` | `boolean` | No | Whether scene lights should cast physical shadows | `true` |

### `ae_set_light`

Fine-tune light parameters (intensity, color, cone angle, cone feather, shadows, shadow darkness, shadow diffusion) on any light layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target light layer | - |
| `intensity` | `number` | No | Light intensity percentage (default 100%) | - |
| `color` | `array | string` | No | Light emission color (hex string or [r, g, b] array) | - |
| `coneAngle` | `number` | No | Spotlight cone angle in degrees (0 - 180) | - |
| `coneFeather` | `number` | No | Spotlight cone edge feather percentage (0 - 100) | - |
| `castsShadows` | `boolean` | No | Enable or disable shadow casting | - |
| `shadowDarkness` | `number` | No | Shadow density percentage (0 - 100) | - |
| `shadowDiffusion` | `number` | No | Soft shadow edge penumbra diffusion in pixels | - |

### `ae_add_environment_light`

Add an Image-Based Lighting (IBL) Environment Light to illuminate 3D models and extruded objects with HDR reflections (After Effects 2024+ Advanced 3D).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `hdriItemId` | `integer` | No | Optional project item ID of an HDRI or EXR panorama footage item | - |
| `intensity` | `number` | No | Environment lighting emission intensity percentage | `100` |

---

## 3D Motion Graphics Scenes

### `ae_create_3d_text`

Generate a complete cinematic 3D extruded text scene with typography, bevels, physical materials, lighting rig, camera animation, and shadow-catching floor.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `text` | `string` | **Yes** | Main 3D text title content | - |
| `font` | `string` | No | Optional PostScript font name or family | - |
| `color` | `array | string` | No | Text front face color (hex string or [r, g, b] array) | - |
| `depth` | `number` | No | Extrusion depth in pixels (default 40) | `40` |
| `bevel` | `boolean` | No | Whether to apply convex edge beveling | `true` |
| `metal` | `boolean` | No | Whether to apply a high-reflectivity metallic material finish | `false` |
| `lighting` | `"threePoint" | "dramatic" | "neon" | "studio" | "sunset" | "moody" | "soft"` | No | Lighting aesthetic rig | `dramatic` |
| `cameraMove` | `"orbit" | "orbitHalf" | "dollyIn" | "pushIn" | "flyThrough" | "spiral" | "parallaxDrift"` | No | Cinematic camera motion preset | `pushIn` |
| `floor` | `boolean` | No | Whether to generate a 3D reflective floor plate receiving shadows | `false` |
| `duration` | `number` | No | Scene duration in seconds (default 6) | `6` |

### `ae_create_3d_scene`

Generate an authored high-level 3D motion graphics scene ('extrudedLogoReveal', 'floatingCards', 'cubeGrid', 'infiniteTunnel', 'layeredParallax', 'orbitingShowcase', 'helixText').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `preset` | `"extrudedLogoReveal" | "floatingCards" | "cubeGrid" | "infiniteTunnel" | "layeredParallax" | "orbitingShowcase" | "helixText"` | **Yes** | 3D scene design preset | - |
| `text` | `string` | No | Title or typography content for the scene | - |
| `colors` | `object` | No | Color palette overrides | - |
| `duration` | `number` | No | Scene duration in seconds (default 8) | `8` |

### `ae_list_3d_presets`

List all available high-level 3D motion graphics scene presets with their design descriptions.

*No parameters required.*

---

## Cinematic Looks & Presets

### `ae_apply_look`

Apply a polished stylistic look or film emulation effect stack to a layer, or across the whole composition as a top adjustment layer ('filmGrain', 'vignette', 'chromaticAberration', 'vhs', 'glitch', 'neonGlow', 'dreamy', 'lightLeak', 'filmBurn', 'halftone', 'posterizeTime', 'scanlines', 'bloom', 'cinemaBars').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | No | Target layer to style. If omitted, generates a new full-comp adjustment layer on top | - |
| `look` | `"filmGrain" | "vignette" | "chromaticAberration" | "vhs" | "glitch" | "neonGlow" | "dreamy" | "lightLeak" | "filmBurn" | "halftone" | "posterizeTime" | "scanlines" | "bloom" | "cinemaBars"` | **Yes** | Stylistic look preset name | - |
| `intensity` | `number` | No | Multiplier for effect parameters and intensity (default 1) | `1` |

### `ae_list_looks`

List all available stylistic visual looks, film emulations, descriptions, and the effects used by each stack.

*No parameters required.*

---

## Particle Systems

### `ae_add_particles`

Generate a procedural particle system solid layer using CC Particle World / Systems II (or Trapcode Particular if installed and requested). Presets: 'dust', 'sparks', 'snow', 'rain', 'bokeh', 'embers', 'confetti', 'magicTrail', 'explosion', 'starfield'.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `preset` | `"dust" | "sparks" | "snow" | "rain" | "bokeh" | "embers" | "confetti" | "magicTrail" | "explosion" | "starfield"` | **Yes** | Particle physics and aesthetic preset | - |
| `color` | `array | string` | No | Primary tint color for birth/sparks | - |
| `amount` | `number` | No | Particle quantity multiplier (default 1) | `1` |
| `startTime` | `number` | No | In-point time on comp timeline (seconds) | `0` |
| `duration` | `number` | No | Duration in seconds (default: remaining comp length) | - |
| `options` | `object` | No | Additional configuration options | - |

### `ae_list_particle_presets`

List all available particle presets with physics descriptions, particle types, and recommended usage.

*No parameters required.*

---

## Procedural Backgrounds

### `ae_create_background`

Generate an animated procedural motion graphic background layer ('gradient', 'radialGlow', 'fractalClouds', 'liquid', 'grid', 'stripes', 'noiseTexture', 'aurora') placed at the bottom of the layer stack.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `type` | `"gradient" | "radialGlow" | "fractalClouds" | "liquid" | "grid" | "stripes" | "noiseTexture" | "aurora"` | **Yes** | Motion graphic background type | - |
| `colors` | `object` | No | Custom color palette overrides | - |
| `animated` | `boolean` | No | Whether to animate procedural evolution, drift, or scrolling (default true) | `true` |
| `duration` | `number` | No | Duration in seconds (default: composition duration) | - |

---

## Distortion & Glitch

### `ae_apply_distortion`

Apply animated optical warping, liquid displacement, wave ripples, twirls, shatter, or mosaic pixelation to a layer ('waveWarp', 'turbulent', 'ripple', 'bulge', 'twirl', 'heatHaze', 'liquify-style displace', 'shatter', 'pixelate').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to distort | - |
| `type` | `"waveWarp" | "turbulent" | "ripple" | "bulge" | "twirl" | "heatHaze" | "liquify-style displace" | "shatter" | "pixelate"` | **Yes** | Distortion effect algorithm | - |
| `amount` | `number` | No | Intensity multiplier for distortion parameters (default 1) | `1` |
| `animate` | `boolean` | No | Whether to animate procedural evolution, wave phase, or turbulence (default true) | `true` |

### `ae_add_light_effect`

Add cinematic volumetric light rays, optical lens flares, metallic light sweeps, god rays, or radial shines ('lightRays', 'lensFlare', 'lightSweep', 'godRays', 'shine').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | No | Layer to apply effect directly to. If omitted, generates an adjustment layer on top | - |
| `type` | `"lightRays" | "lensFlare" | "lightSweep" | "godRays" | "shine"` | **Yes** | Optical light effect preset | - |
| `position` | `array` | No | 2D position coordinates [x, y] in pixels | - |
| `color` | `array | string` | No | Light tint or glow color | - |

### `ae_add_audio_visualizer`

Generate an animated reactive audio visualizer ('spectrum', 'waveform', or 'circularSpectrum') synchronized to an audio or video track.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `audioLayer` | `object` | **Yes** | Audio or footage layer containing audio to drive the visualizer | - |
| `type` | `"spectrum" | "waveform" | "circularSpectrum"` | No | Visualizer geometry aesthetic | `spectrum` |
| `color` | `array | string` | No | Primary wave/frequency band color (hex string or [r, g, b] array) | - |
| `position` | `array` | No | Center origin position [x, y] in pixels (default comp center) | - |

---

## Motion & Physics Rigs

### `ae_add_expression_control`

Add an expression control effect to a layer ('slider', 'angle', 'checkbox', 'color', 'point', 'point3d', 'layer', 'dropdown') to drive dynamic rigs and parameters.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to receive the expression control | - |
| `type` | `"slider" | "angle" | "checkbox" | "color" | "point" | "point3d" | "layer" | "dropdown"` | **Yes** | Type of expression control | - |
| `name` | `string` | **Yes** | User-facing label/name of the control | - |
| `value` | `number | boolean | string | array` | No | Initial control value | - |

### `ae_link_property`

Create a pick-whip dynamic link connecting targetLayer's property to sourceLayer's property with optional multiplier and offset.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `sourceLayer` | `object` | **Yes** | Source layer being observed | - |
| `sourcePath` | `string | array` | **Yes** | Property path on source layer | - |
| `targetLayer` | `object` | **Yes** | Target layer receiving the expression | - |
| `targetPath` | `any | any` | **Yes** | Property path on target layer to be driven | - |
| `multiplier` | `number` | No | Multiplier scalar for the driven property | `1` |
| `offset` | `number` | No | Constant offset added to the driven property | `0` |

### `ae_apply_rig`

Apply a modular dynamic animation expression rig with exposed UI slider controls ('wiggle', 'smoothWiggle', 'loop', 'bounce', 'elastic', 'pendulum', 'orbit', 'flicker', 'counter', 'typeCursor', 'delayFollow', 'audioReact', 'autoFade', 'lookAt', 'breathing', 'scaleToBeat').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer | - |
| `path` | `string | array` | **Yes** | Property path or shortcut (e.g. 'position', 'scale', 'rotation', 'opacity', 'Source Text') | - |
| `rig` | `"wiggle" | "smoothWiggle" | "loop" | "bounce" | "elastic" | "pendulum" | "orbit" | "flicker" | "counter" | "typeCursor" | "delayFollow" | "audioReact" | "autoFade" | "lookAt" | "breathing" | "scaleToBeat"` | **Yes** | Animation rig algorithm to apply | - |
| `options` | `object` | No | Rig-specific configuration options | - |

### `ae_list_rigs`

List all available procedural expression rigs with descriptions, applicable properties, and UI controls added.

*No parameters required.*

### `ae_bake_expression`

Bake an active expression into explicit keyframes across the layer duration, then remove the expression for performance and stability.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Layer containing the expression | - |
| `path` | `string | array` | **Yes** | Property path or shortcut with active expression to bake | - |

---

## Vision & Preview

### `ae_preview_frame`

Capture and inspect a rendered frame from After Effects at a specific time (or current playhead). Returns visual image content along with composition dimensions.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `time` | `number` | No | Time in seconds to preview. If omitted, uses current comp playhead time | - |
| `maxWidth` | `integer` | No | Maximum image width in pixels for the preview (default 960) | `960` |

### `ae_contact_sheet`

Render multiple frames evenly across the composition (or work area) and combine them into a single contact sheet grid image with time stamps for visual QA.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `count` | `integer` | No | Number of frames to sample evenly across duration (default 6, overridden by times) | `6` |
| `times` | `array` | No | Explicit array of sample times in seconds to capture | - |
| `columns` | `integer` | No | Number of columns in contact sheet grid (default 3) | `3` |
| `maxWidth` | `integer` | No | Maximum width of contact sheet grid in pixels (default 1600) | `1600` |

### `ae_preview_layer_isolated`

Temporarily solo a single layer, render a preview frame, and cleanly restore all layer solo switches. Useful for inspecting titles, masks, shapes or particle elements in isolation.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer to isolate and preview | - |
| `time` | `number` | No | Time in seconds to preview. If omitted, uses current comp playhead time | - |
| `maxWidth` | `integer` | No | Maximum image width in pixels (default 960) | `960` |

### `ae_set_preview_time`

Move the After Effects composition timeline playhead (current time) to a specific time in seconds.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `time` | `number` | **Yes** | Target playhead time in seconds | - |

---

## Quality Assurance (QA)

### `ae_get_layer_bounds`

Calculate composition-space 2D bounding boxes (left, top, right, bottom, width, height) and opacity for all visible/active layers at a specific time (or current playhead). 3D layers are flagged with approximate bounding box.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `time` | `number` | No | Time in seconds to evaluate layer boundaries. If omitted, uses current comp playhead time | - |

### `ae_qa_check`

Run an automated quality assurance inspection across a composition: checks for title-safe violations (10% margins), off-screen or clipped typography, overlapping text layers, broken expressions, missing footage assets, disabled effects, wasted 0-opacity layers, out-of-bounds keyframes, rapid flicker (<4 frames), tiny text (<24px at 1080p), low contrast (<3:1), and static openings. Returns a structured report with severity, category, and actionable suggested fixes.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `checkTimes` | `integer | array` | No | Sample times for layout and collision checks (defaults to 5 evenly spaced sample points) | - |

### `ae_timeline_summary`

Generate a structured, human-readable timeline summary of the composition: layers in stacking order with their in/out times, layer types, 3D status, keyframed properties and ranges, active effects, and expressions. Provides a quick mental model of the entire composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |

---

## Project & Checkpoints

### `ae_save_project`

Save the current After Effects project to disk (or Save As if path is specified or project is untitled). Defaults to Documents/ae-bridge-projects/<name>.aep.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `path` | `string` | No | Destination file path (.aep). If omitted and project is untitled, defaults to Documents/ae-bridge-projects/<name>.aep | - |

### `ae_open_project`

Open an existing After Effects project file (.aep) from disk. Warns if the current project has unsaved modifications unless force=true.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `path` | `string` | **Yes** | File path of the .aep project file to open | - |
| `force` | `boolean` | No | Set true to discard unsaved changes in current project | `false` |

### `ae_new_project`

Create a new blank After Effects project. Warns if the current project has unsaved changes unless force=true.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `force` | `boolean` | No | Set true to discard unsaved changes in current project | `false` |

### `ae_project_status`

Inspect the current project state: saved file path, dirty flag (unsaved changes), counts of comps, footage, and folders, After Effects version, and available 3D renderers.

*No parameters required.*

### `ae_organize_project`

Organize project items into clean standard folders: 'Comps', 'Precomps', 'Footage', 'Audio', 'Images', and 'Solids'.

*No parameters required.*

### `ae_reduce_project`

Reduce the project to only the specified compositions, deleting all unreferenced assets, unused comps, and unused footage.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `keepComps` | `array` | **Yes** | List of composition references to preserve | - |

### `ae_reload_tools`

Re-evaluate and hot-reload all ExtendScript helper libraries and tool script files in the active CEP panel without restarting After Effects.

*No parameters required.*

### `ae_checkpoint`

Create a timestamped project backup copy in <project>_checkpoints/<timestamp>_<label>.aep before making destructive changes. The active project remains the original file.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `label` | `string` | **Yes** | Descriptive label for this milestone (e.g. 'before_reframe', 'pre_color_grade', 'v1_client') | - |

### `ae_list_checkpoints`

List all available project checkpoint backups in the project's checkpoints directory sorted newest first.

*No parameters required.*

### `ae_restore_checkpoint`

Open and restore a previously saved project checkpoint file (.aep). Warns if the current project has unsaved modifications unless force=true.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `file` | `string` | **Yes** | Checkpoint file name (e.g. '20261123_212000_v1.aep') or full path | - |
| `force` | `boolean` | No | Set true to discard unsaved changes in current project | `false` |

---

## Rendering & Export

### `ae_list_output_templates`

List all available After Effects Render Settings and Output Module templates, along with mapped export presets.

*No parameters required.*

### `ae_render`

Render a composition via Adobe Media Encoder (mode='ame', non-blocking) or directly within After Effects (mode='ae', blocking, long timeout). Presets: 'mp4High', 'mp4Web', 'prores422', 'proresProxy', 'prores4444Alpha', 'pngSequence', 'pngAlphaSequence', 'wav'. Default output folder: <Videos>/ae-bridge-renders.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `preset` | `"mp4High" | "mp4Web" | "prores422" | "proresProxy" | "prores4444Alpha" | "pngSequence" | "pngAlphaSequence" | "wav"` | **Yes** | Render preset mapping | - |
| `outputPath` | `string` | No | Explicit target file path. If omitted, generates inside <Videos>/ae-bridge-renders | - |
| `fileName` | `string` | No | Optional custom file name without directory | - |
| `workAreaOnly` | `boolean` | No | Whether to render only the composition work area (default true) | `true` |
| `mode` | `"ae" | "ame"` | No | Render engine: 'ame' (queues in Adobe Media Encoder, non-blocking) or 'ae' (direct in-AE blocking render) | `ame` |

### `ae_render_status`

Check status of a rendered or rendering file on disk (existence, file size, growth detection, and last modified timestamp). Useful for monitoring AME renders.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `outputPath` | `string` | **Yes** | File path of the rendered output to inspect | - |

### `ae_batch_render`

Queue multiple compositions in batch for rendering with individual preset mappings.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `items` | `array` | **Yes** | List of render queue items | - |
| `mode` | `"ae" | "ame"` | No | Render engine ('ame' recommended for batches) | `ame` |

### `ae_export_frame`

Export a high-resolution still frame as PNG or JPG to disk and return as MCP image.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `time` | `number` | No | Time in seconds to export. Defaults to current comp playhead | - |
| `format` | `"png" | "jpg"` | No | Image output format: 'png' or 'jpg' | `png` |
| `outputPath` | `string` | No | Destination file path. If omitted, saved in <Videos>/ae-bridge-renders | - |

### `ae_export_gif`

Export a sequence of frames from a composition and compile an animated GIF (or PNG sequence with instructions if animated GIF encoding is unsupported).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `fps` | `integer` | No | Frames per second for GIF (default 15) | `15` |
| `width` | `integer` | No | Width in pixels for GIF (default 720) | `720` |
| `outputPath` | `string` | No | Destination .gif path. Default <Videos>/ae-bridge-renders/<comp>.gif | - |

---

## Social Variants & Reframe

### `ae_create_format_variant`

Create an aspect ratio or format variation of a composition ('16:9', '9:16', '1:1', '4:5', '4:3', '21:9') using 'smartReframe' (duplicate + scale/reposition layers into title-safe boundaries), 'fit', 'fill', or 'fitBlurBackground' (with blurred backdrop).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `aspect` | `"16:9" | "9:16" | "1:1" | "4:5" | "4:3" | "21:9"` | **Yes** | Target aspect ratio | - |
| `resolution` | `array` | No | Optional custom [width, height] resolution override in pixels | - |
| `method` | `"fill" | "fit" | "fitBlurBackground" | "smartReframe"` | No | Reframing strategy: 'smartReframe' (duplicates and adjusts layers into safe areas), 'fitBlurBackground', 'fit', or 'fill' | `smartReframe` |
| `name` | `string` | No | Optional custom name for the new variant composition | - |

### `ae_create_all_social_variants`

Batch-generate all channel-ready social media formats (YouTube, Shorts, Reels, TikTok, Instagram Feed/Portrait, X, LinkedIn) from a master composition and file them in a 'Social Variants' folder.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `platforms` | `array` | No | List of target platforms (defaults to all: youtube, shorts, reels, tiktok, instagramFeed, instagramPortrait, x, linkedin) | - |
| `method` | `"fill" | "fit" | "fitBlurBackground" | "smartReframe"` | No | Reframing strategy (default 'smartReframe') | `smartReframe` |

---

## Essential Graphics & Templates

### `ae_add_to_essential_graphics`

Add a property (source text, color, slider, position, scale, opacity) from a layer into the composition's Essential Graphics panel for template packaging.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer containing the property | - |
| `path` | `string | array` | **Yes** | Path to animatable property (e.g. ['Text', 'Source Text'] or 'opacity') | - |
| `label` | `string` | No | Display label in Essential Graphics panel (defaults to property name) | - |

### `ae_export_mogrt`

Export a composition packaged with Essential Graphics controls as a Motion Graphics Template (.mogrt) for Premiere Pro.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `outputPath` | `string` | No | Target .mogrt file path. Defaults to <Videos>/ae-bridge-renders/<compName>.mogrt | - |

### `ae_replace_text_batch`

Perform atomic batch text replacement across multiple text layers within a composition in a single operation.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `replacements` | `array` | **Yes** | List of text layer replacements | - |

### `ae_generate_versions`

Data-driven versioning: duplicate a master composition per row, apply text and color overrides, organize into a 'Versions' folder, and optionally queue all versions for rendering.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `rows` | `array` | **Yes** | Data rows to generate versions for | - |
| `render` | `object` | No | Optional rendering configuration to queue all versions | - |

---

## Asset & Beat Analysis

### `ae_analyze_assets`

Inspect footage, audio, and visual assets in the After Effects project. Returns detailed metadata (durations, resolutions, audio channels) and a composited contact sheet grid displaying the middle frame of all visual assets with labels.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemIds` | `array` | No | Optional list of specific project item IDs to inspect | - |
| `folderName` | `string` | No | Optional project bin/folder name to filter assets by (e.g. 'Footage', 'Audio') | - |

### `ae_preview_clip`

Sample a specific footage item or video asset across its full duration, producing a multi-frame contact sheet grid labeled with timestamps.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemId` | `integer` | **Yes** | Project item ID of the video or footage asset | - |
| `count` | `integer` | No | Number of frames to sample evenly across duration (default 6) | `6` |

### `ae_detect_beats`

Perform volume peak detection and rhythmic beat analysis on an audio track. Estimates BPM, extracts beat timestamps using adaptive standard-deviation thresholding, and optionally creates After Effects comp markers on every detected beat.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `itemId` | `integer` | No | Optional project item ID of audio footage asset | - |
| `compRef` | `object` | No | Composition reference containing the audio layer | - |
| `layerRef` | `object` | No | Audio layer reference within the composition | - |
| `sensitivity` | `number` | No | Beat detection sensitivity (0.0 to 1.0, default 0.5) | `0.5` |
| `minGap` | `number` | No | Minimum time gap in seconds between consecutive beats (default 0.25) | `0.25` |
| `addMarkers` | `boolean` | No | Whether to automatically add After Effects comp markers at each detected beat (default true) | `true` |

---

## Brand Identity Kit

### `ae_set_brand_kit`

Configure and persist the master brand kit (colors, typography, logo, and aesthetic style) stored at ~/.ae-bridge/brand.json. Used by storyboards, title cards, and recipes as default identity values.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | **Yes** | Brand or client name (e.g. 'Apex Robotics', 'Nova Labs') | - |
| `colors` | `object` | **Yes** | Brand color palette (primary, secondary, accent, background, text) | - |
| `fonts` | `object` | **Yes** | Brand typography (heading font, body font) | - |
| `logoPath` | `string` | No | Optional path to vector or high-res logo image file | - |
| `style` | `"minimal" | "bold" | "luxury" | "playful" | "tech"` | No | Brand aesthetic direction | `minimal` |

### `ae_get_brand_kit`

Retrieve the active brand kit from ~/.ae-bridge/brand.json (or default tech brand kit if none is configured).

*No parameters required.*

---

## Storyboard & Director

### `ae_build_storyboard`

Assemble a complete multi-scene video from a Storyboard specification. Creates a master timeline comp, builds individual scene precomps, arranges them in sequence with transitions, adds soundtrack with beat-sync, applies brand styling and global looks, runs automated QA checks, and saves the project.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `storyboard` | `object` | **Yes** | Complete storyboard data specification | - |
| `compName` | `string` | No | Optional custom name for the master composition | - |

### `ae_update_scene`

Update or rebuild a specific scene precomp within an existing storyboard composition without re-rendering or altering the other scenes.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to the master storyboard composition | - |
| `sceneIndex` | `integer` | **Yes** | 0-based index of the scene to update | - |
| `changes` | `object` | **Yes** | Scene properties, content text, or effects to update | - |

### `ae_storyboard_schema`

Retrieve the JSON schema definition and a complete working example of a Storyboard specification for planning and generating multi-scene videos.

*No parameters required.*

---

## Video Production Recipes

### `ae_list_recipes`

List all available video production recipes with descriptions, target durations, and required template inputs.

*No parameters required.*

### `ae_get_recipe`

Retrieve the full recipe template definition, description, and inputs schema by recipe name.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | **Yes** | Recipe name (e.g. 'youtubeIntro', 'logoReveal', 'productLaunch', 'hypePromo', 'socialAd15s', 'kineticTypography', 'eventRecap', 'cinematicTrailer', 'slideshow', 'countdown', 'tutorialIntro', 'lowerThirdPack') | - |

### `ae_run_recipe`

Execute a video recipe in a single tool call. Fills input placeholders, builds all scenes, applies branding, and returns the assembled master composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | **Yes** | Recipe name to execute | - |
| `inputs` | `object` | No | Map of input values to substitute into the recipe placeholders | `[object Object]` |
| `compName` | `string` | No | Optional custom name for the resulting composition | - |

---

## Render Quality & Standards

### `ae_set_quality_mode`

Switch After Effects render quality mode between 'draft' (8bpc, 1/2 resolution factor, motion blur disabled for fast responsive scrubbing) and 'final' (32bpc or 16bpc deep color, linear blending enabled, motion blur enabled for comp + animated layers, 180 shutter angle, -90 shutter phase, 16 samples per frame, full resolution, Advanced 3D renderer).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `mode` | `"draft" | "final"` | **Yes** | Quality tier mode: 'draft' for fast editing previews, 'final' for master broadcast fidelity | - |

---

## Motion Language & Easing

### `ae_apply_motion_curve`

Re-ease existing keyframes on a layer property using high-end named motion curves ('expoOut', 'expoInOut', 'quintOut', 'backOut' with overshoot, 'snap', 'smooth', 'heavy', 'elasticOut', 'linear').

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRef` | `object` | **Yes** | Target layer possessing keyframes | - |
| `path` | `string | array` | **Yes** | Property path (e.g. 'position', 'scale', 'opacity', or ['Transform', 'Position']) | - |
| `curve` | `"expoOut" | "expoInOut" | "quintOut" | "backOut" | "snap" | "smooth" | "heavy" | "elasticOut" | "linear"` | **Yes** | Named motion curve to apply | - |

### `ae_stagger`

Offset layer start times in sequence for natural cascading visual entrance and rhythmic motion choreography.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `layerRefs` | `array` | **Yes** | Ordered array of layer references to stagger | - |
| `delay` | `number` | No | Time delay offset in seconds between consecutive layers (default 0.06s) | `0.06` |
| `order` | `"forward" | "reverse" | "center" | "random"` | No | Staggering cascade order: 'forward' (top to bottom), 'reverse', 'center' (midpoint radiating out), or 'random' | `forward` |

---

## Design Styles & Aesthetics

### `ae_list_styles`

List all available design styles with palettes, motion curves, typography, and active indicator.

*No parameters required.*

### `ae_get_style`

Retrieve complete specification for a design style. If name is omitted, returns the active style. Optionally overlays active brand kit colors and fonts if brand=true.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | No | Style identifier (e.g. 'cinematicNoir', 'neonCyber'). If omitted, active style is returned. | - |
| `brand` | `boolean` | No | If true, master brand kit colors and fonts override style defaults | `false` |

### `ae_set_active_style`

Set the globally active design style used across storyboards, titles, motion curves, and finishing passes. Persisted in ~/.ae-bridge/state.json.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | **Yes** | Name of the style to activate (e.g. 'cinematicNoir', 'minimalPremium', 'neonCyber') | - |

---

## Finishing Pass & Compositing

### `ae_finish_pass`

Apply a high-end compositing finishing pass on top of a composition in a toggleable 'FINISH' group (depth haze, light wrap, bloom & glow, chromatic aberration, film grain matched to resolution, vignette, color grade matching style palette, optional halation and anamorphic streak flare, foreground dust particles and background atmosphere).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `level` | `"subtle" | "rich" | "extreme"` | No | Finishing intensity level: 'subtle' for refined minimalism, 'rich' for balanced broadcast master, 'extreme' for heavy stylized look | `rich` |
| `style` | `string` | No | Style identifier (e.g. 'cinematicNoir', 'neonCyber', 'minimalPremium'). If omitted, the currently active style is used. | - |

### `ae_remove_finish_pass`

Remove all finishing pass adjustment layers, particles, and controllers from a composition.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |

---

## Reference Matching & Palette

### `ae_analyze_reference`

Analyze a reference image: extracts dominant 6-color palette via k-means clustering, computes average luminance, contrast, saturation, and warm/cool bias, recommends the closest matching built-in style, and generates a ready-to-use custom style JSON.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `imagePath` | `string` | **Yes** | Absolute file path to the reference image (PNG, JPG, WebP) | - |

### `ae_compare_to_reference`

Create a side-by-side composite comparison between a reference image and the current composition render at a given timestamp. Returns visual comparison file for agent review.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `time` | `number` | No | Timestamp in seconds to capture from comp. If omitted, uses playhead time | - |
| `imagePath` | `string` | **Yes** | Absolute file path to the reference target image | - |

### `ae_create_style_from_reference`

Analyze a reference image and author a new persistent style JSON in the /styles directory conforming to the style schema.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `imagePath` | `string` | **Yes** | Absolute file path to the reference image | - |
| `name` | `string` | **Yes** | Unique style identifier (e.g. 'cyberObsidian', 'sunsetWarmth') | - |

---

## Blender 3D Photoreal Engine

### `blender_status`

Inspect Blender executable detection, hardware GPU acceleration, active version, and asset folders.

*No parameters required.*

### `blender_set_path`

Explicitly configure and persist the path to the Blender executable in ~/.ae-bridge/state.json.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `path` | `string` | **Yes** | Absolute file path to blender.exe (Windows) or blender (macOS/Linux) | - |

### `blender_preview`

Render an instant EEVEE GPU single frame preview at 960px width, returning the image directly to the agent for visual inspection.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `spec` | `object` | **Yes** | Scene specification to preview | - |
| `frame` | `integer` | No | Frame number to render (defaults to start frame) | - |
| `maxWidth` | `integer` | No | Maximum preview image width in pixels (default 960) | `960` |

### `blender_render`

Dispatch an asynchronous photoreal Blender 3D render job. Returns immediately with jobId for non-blocking monitoring.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `spec` | `object` | **Yes** | Complete SceneSpec definition | - |

### `blender_job_status`

Check live progress percentage, estimated frames, compute hardware, and output file paths for an active or finished Blender render job.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `jobId` | `string` | **Yes** | Unique job ID returned by blender_render | - |

### `blender_cancel_job`

Abort an in-progress Blender background rendering job and terminate its process.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `jobId` | `string` | **Yes** | Unique job ID to cancel | - |

### `blender_save_blend`

Build the 3D scene from a SceneSpec and save it as an editable .blend project file for manual user tweaking.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `spec` | `object` | **Yes** | Scene specification to serialize | - |
| `path` | `string` | No | Destination file path for .blend project. If omitted, saved into render folder | - |

### `blender_list_presets`

List available PBR material shaders, studio lighting rigs, cinematic camera moves, physics simulations, and procedural Geometry Nodes presets.

*No parameters required.*

### `blender_3d_title`

High-level generator: Produce a photoreal 3D title card animation with studio lighting, camera move, and seamless cyclorama floor.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `text` | `string` | **Yes** | Headline title text string | - |
| `font` | `string` | No | Font family name (e.g. 'Montserrat', 'Inter', 'Cinzel') to search in system fonts | - |
| `material` | `"chrome" | "gold" | "brushedAluminum" | "glass" | "frostedGlass" | "glossyPlastic" | "matteClay" | "ceramic" | "rubber" | "carbonFiber" | "holographic" | "neonEmission" | "liquidMetal" | "marble"` | No | PBR material preset ('chrome', 'gold', 'glass', etc.) | `chrome` |
| `lighting` | `string` | No | Lighting preset ('studioDramatic', 'rimNeon', 'darkLuxury') | `studioDramatic` |
| `cameraMove` | `"orbit" | "orbitHalf" | "pushIn" | "pullOut" | "craneUp" | "flyThrough" | "turntable" | "heroReveal" | "dollyZoom"` | No | Cinematic camera trajectory ('heroReveal', 'pushIn', 'orbit') | `heroReveal` |
| `duration` | `number` | No | Duration in seconds (default 5s) | `5` |
| `floor` | `boolean` | No | Whether to include infinite seamless studio cyclorama backdrop | `true` |
| `perCharacter` | `boolean` | No | Whether to stagger drop individual characters kinetic style | `false` |

### `blender_logo_reveal`

High-level generator: Import an SVG vector logo, extrude to 3D, apply reflective PBR materials, and render with dynamic reveal animation.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `svgPath` | `string` | **Yes** | Absolute file path to the SVG vector file | - |
| `material` | `"chrome" | "gold" | "brushedAluminum" | "glass" | "frostedGlass" | "glossyPlastic" | "matteClay" | "ceramic" | "rubber" | "carbonFiber" | "holographic" | "neonEmission" | "liquidMetal" | "marble"` | No | PBR material preset ('gold', 'chrome', 'liquidMetal') | `gold` |
| `lighting` | `string` | No | Studio lighting rig | `studioDramatic` |
| `style` | `"spinSettle" | "riseFromFloor" | "lightSweep"` | No | Logo reveal choreography style | `spinSettle` |
| `duration` | `number` | No | Total duration in seconds | `4` |

### `blender_product_shot`

High-level generator: Import a 3D model (.glb/.gltf/.obj/.fbx) and render an Apple-style commercial turntable or floating orbit showcase.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `modelPath` | `string` | **Yes** | Absolute file path to 3D model file | - |
| `style` | `"turntable" | "heroOrbit" | "floatingReveal"` | No | Showcase trajectory style | `heroOrbit` |
| `background` | `"cyclorama" | "transparent"` | No | Background setting | `cyclorama` |
| `lighting` | `string` | No | Lighting setup ('productWhite', 'studioDramatic', 'darkLuxury') | `productWhite` |
| `duration` | `number` | No | Duration in seconds | `5` |

### `blender_physics_shot`

High-level generator: Simulate dynamic physical interactions (dropAndBounce, shatter, clothReveal, scatterFall, windFlag) and render.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `preset` | `"dropAndBounce" | "shatter" | "clothReveal" | "windFlag" | "scatterFall"` | **Yes** | Physical simulation preset | - |
| `text` | `string` | No | Optional text for shatter or drop target | - |
| `modelPath` | `string` | No | Optional 3D model path to simulate | - |
| `material` | `"chrome" | "gold" | "brushedAluminum" | "glass" | "frostedGlass" | "glossyPlastic" | "matteClay" | "ceramic" | "rubber" | "carbonFiber" | "holographic" | "neonEmission" | "liquidMetal" | "marble"` | No | PBR material preset | `chrome` |
| `duration` | `number` | No | Duration in seconds | `4` |

### `blender_hdri_fetch`

Download CC0 HDRIs from the public Poly Haven API into ~/.ae-bridge/hdri (or list available local and recommended HDRIs).

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `name` | `string` | No | Poly Haven HDRI identifier (e.g. 'studio_small_08', 'aerodynamics_workshop', 'modern_buildings_2'). If omitted, lists available local and popular HDRIs | - |

---

## Blender AE Compositing & Sync

### `ae_import_blender_render`

Import an exported Blender 3D render sequence (color pass + optional depth pass) into After Effects, sync camera trajectory keyframes from camera.json, and bind 3D tracking nulls.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `jobId` | `string` | No | Blender job ID to import from | - |
| `folder` | `string` | No | Direct output directory containing color/ and camera.json | - |
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `fps` | `number` | No | Playback frame rate conforming | - |
| `addDepthPass` | `boolean` | No | Whether to import and link the normalized Z-depth pass | `true` |
| `syncCamera` | `boolean` | No | Whether to construct an AE 3D camera matching the Blender lens and trajectory | `true` |
| `startTime` | `number` | No | In-point start time in comp (seconds) | `0` |

### `ae_depth_effects`

Apply cinematic atmospheric depth effects (depth of field optical lens blur, distance fog, or depth mapping) driven by a Blender Z-depth pass layer.

| Parameter | Type | Required | Description | Default |
|---|---|---|---|---|
| `compRef` | `object` | No | Reference to a composition (by ID or name). If omitted, the active composition is used. | - |
| `depthLayerRef` | `object` | **Yes** | Reference to the imported Blender Depth Pass layer | - |
| `targetLayerRef` | `object` | No | Target layer to receive optical lens blur (defaults to color pass layer) | - |
| `effects` | `array` | No | Depth effects to configure | `dof` |
| `dofRadius` | `number` | No | Maximum optical blur radius for Camera Lens Blur | `15` |
| `fogColor` | `array | string` | No | Atmospheric fog tint color | - |

---

