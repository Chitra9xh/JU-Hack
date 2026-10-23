# Asset credits

Every 3D model, texture and thumbnail in `public/assets/` is listed here with its author, source and license.
Third-party models come from the Khronos **glTF-Sample-Assets** repository
(https://github.com/KhronosGroup/glTF-Sample-Assets, commit `8f49239`), fetched on 2026-10-24.

All third-party models were modified for this project: re-origined and scaled to the project GLB conventions,
unused data (lights, extra variants, unused textures) removed, textures resized and re-encoded (PNG/JPEG),
and glass materials converted from KHR_materials_transmission/volume/iridescence to plain alpha blending.
No Draco/meshopt compression is used.

## Frames (`public/assets/frames/`)

| File | Name | Author | Source | License | Notes |
|---|---|---|---|---|---|
| `frame-01.glb` | Pilot Sunglasses | Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SunglassesKhronos | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) | Changed: scaled to 0.14 m wide, origin moved to the nose bridge, Khronos / 3D Commerce logo texture removed from the temples (plain dark material instead), lenses converted to alpha blending |
| `frame-02.glb` | Round Wire | JU-Hack team | generated procedurally (original geometry) | CC0 1.0 | |
| `frame-03.glb` | Bold Square | JU-Hack team | generated procedurally (original geometry) | CC0 1.0 | |
| `frame-04.glb` | Cat-Eye | JU-Hack team | generated procedurally (original geometry) | CC0 1.0 | |
| `frame-05.glb` | Slim Rectangle | JU-Hack team | generated procedurally (original geometry) | CC0 1.0 | |

## Furniture and decor (`public/assets/furniture/`)

| File | Name | Author | Source | License | Notes |
|---|---|---|---|---|---|
| `item-01.glb` | Mango Velvet Chair | Eric Chadwick, © 2020 Wayfair, LLC | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) | Default "Mango Velvet" material only |
| `item-02.glb` | Navy Velvet Sofa | Eric Chadwick, © 2021 Wayfair, LLC | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) | Navy variant only; base colour lightened slightly so it never renders black; light node removed |
| `item-03.glb` | Silk Pouf | Eric Chadwick, © 2023 Wayfair, LLC | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) | |
| `item-04.glb` | Glass Vase with Flowers | Eric Chadwick (glass vase), Rico Cilliers (flowers) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassVaseFlowers | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) | Only the single alpha-blended vase kept (the original shows two vases side by side) |
| `item-05.glb` | Stained Glass Lamp | Eric Chadwick, © 2021 Wayfair | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/StainedGlassLamp | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) | Built from the extension-free `glTF-JPG-PNG` variant, textures reduced to 512 px |

## Thumbnails (`public/assets/thumbs/`)

`frame-01..05.png` and `item-01..05.png` are 256 x 256 renders of the models above, made for this project.
They carry the same license and attribution as the model each one shows.
