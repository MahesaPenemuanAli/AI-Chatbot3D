# Nusa AI character assets

## Default: modern anime companion

Local file: `nusa-modern.vrm` (unmodified binary).

- Model: `VRM1_Constraint_Twist_Sample`, version v1.0.1.
- Author and copyright: (c) 2022 pixiv Inc.
- Source: https://github.com/pixiv/three-vrm/blob/v3.5.4/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm
- Upstream sample: https://github.com/vrm-c/vrm-specification/tree/master/samples/VRM1_Constraint_Twist_Sample
- License: VRM Public License 1.0 — https://vrm.dev/licenses/1.0/
- Embedded metadata: avatar use by everyone; commercial use by corporations;
  redistribution allowed; modification and redistribution of modifications
  allowed; credit unnecessary. See the original file's `VRMC_vrm.meta` for all
  usage settings. The original authorship and usage settings are retained.
- Retrieved: 2026-10-30.

`AnimeAvatar.jsx` applies lavender clothing / warm skin material tints and
original animations at runtime. `animeMotion.js` defines the original poses,
greeting, secondary body gestures and smooth state transitions. The model's
humanoid constraints, facial blend shapes and hair spring bones are retained.

`frontend/src/components/NusaPortrait.jsx` contains a matching original SVG
illustration for loading states and browsers without WebGL. Both the illustration
and 3D character work locally without an external character service.

Visual UI reference (inspiration only; no image copied into the interface):
https://dribbble.com/shots/27766990-AI-Character-Chatbot-Companion-Mobile-App-UI-Redesign
by Imran Jakir. The existing procedural explorer remains as unused source in
`NusaAvatar.jsx`; it is no longer the active character.

## Retained reference assets (not loaded by the default avatar)

The earlier assets remain in the repository for reference; their attribution and
licenses are preserved below.

### VRoid sample

- Local file: `.candidate-darkness/AvatarSample_D_Darkness.vrm`.
- Original title: `AvatarSample_D` (Darkness).
- Author: VRoid project / VRoidプロジェクト.
- Format: VRM 0.x with embedded humanoid rig, expressions, textures, and spring bones.
- License: CC0, declared in `extensions.VRM.meta.licenseName`.
- Embedded usage metadata permits use by everyone, commercial use, modification,
  and redistribution. The downloaded binary is unchanged.

### RobotExpressive reference

- Local file: `nusa-robot.glb`.
- Original model: RobotExpressive by Tomás Laulhé / Quaternius.
- Original creator: https://www.patreon.com/quaternius
- Source modifications: Don McCurdy (expression morph targets, FBX2GLTF conversion,
  material cleanup).
- Source: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
- Download: https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- License statement: https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/README.md
- License: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- Retrieved: 2026-10-27. The downloaded binary is unchanged.
