# Storyboard Specification

The **Storyboard** schema is the core declarative data contract used by the AE Bridge Director layer. It allows AI agents to architect complex, multi-scene video productions.

---

## Storyboard Schema

```typescript
interface Storyboard {
  title: string;                                // Master composition title
  width?: number;                               // Width in pixels (default: 1920)
  height?: number;                              // Height in pixels (default: 1080)
  frameRate?: number;                           // Frames per second (default: 30)
  look?: string;                                // Global look (cinematic, warmFilmic, bleachBypass, etc.)
  brand?: boolean;                              // Apply active brand kit colors & typography (default: true)
  music?: {
    itemId?: number;                            // Project item ID of imported audio
    path?: string;                              // File path to audio track
    fadeOut?: number;                           // Seconds to fade out audio at timeline end
    beatSync?: boolean;                         // Detect peaks and snap cuts to beats
  };
  scenes: Scene[];                              // Ordered sequence of scenes
  outputs?: Array<{
    aspect: string;                             // e.g. "16:9", "9:16", "1:1"
    preset: string;                             // e.g. "mp4High", "prores422"
  }>;
}
```

### Scene Definition

```typescript
interface Scene {
  type: "title" | "footage" | "text" | "lowerThird" | "3dText" |
        "3dScene" | "background" | "logoReveal" | "counter" | "quote" | "endCard";
  duration: number;                             // Scene duration in seconds
  transitionIn?: {
    type: string;                               // crossDissolve, dipToWhite, dipToBlack, slideLeft, pushUp, zoomIn, whipPan, glitchCut
    duration: number;                           // Transition overlap duration in seconds (e.g. 0.5)
  };
  content?: {
    text?: string;
    subtitle?: string;
    itemId?: number;
    path?: string;
    sourceIn?: number;                          // In-point offset for footage (seconds)
    preset?: string;                            // Animation preset name
    style?: string;                             // Aesthetic style (tech, minimal, bold, neon)
    colors?: Record<string, string>;            // Local color overrides
  };
  effects?: Array<{
    kind: "look" | "particles" | "lightEffect" | "rig" | "distortion";
    name: string;
    options?: Record<string, any>;
  }>;
}
```

---

## Example Storyboard

```json
{
  "title": "CYBERNETIC — Season Opener",
  "width": 1920,
  "height": 1080,
  "frameRate": 30,
  "look": "cinematic",
  "brand": true,
  "scenes": [
    {
      "type": "background",
      "duration": 4.0,
      "content": {
        "style": "cyberGrid",
        "preset": "neonPulse"
      },
      "effects": [
        {
          "kind": "particles",
          "name": "digitalSparks",
          "options": { "speed": 1.5 }
        }
      ]
    },
    {
      "type": "3dText",
      "duration": 4.5,
      "transitionIn": { "type": "zoomIn", "duration": 0.4 },
      "content": {
        "text": "CYBERNETIC",
        "subtitle": "SYSTEM BOOT 2026",
        "preset": "dramaticRise"
      },
      "effects": [
        {
          "kind": "lightEffect",
          "name": "lightSweep",
          "options": { "speed": 1.2 }
        }
      ]
    },
    {
      "type": "endCard",
      "duration": 3.5,
      "transitionIn": { "type": "crossDissolve", "duration": 0.5 },
      "content": {
        "text": "WATCH LIVE",
        "subtitle": "CYBERNETIC.AI",
        "preset": "fadeScale"
      },
      "effects": [
        {
          "kind": "look",
          "name": "cinemaBars",
          "options": { "height": 80 }
        }
      ]
    }
  ]
}
```
