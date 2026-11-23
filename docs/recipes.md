# Video Production Recipes

Recipes are pre-engineered, modular video templates that allow AI agents to generate complete, broadcast-quality motion graphics projects with a single tool call (`ae_run_recipe`).

---

## Recipe Catalog

| Recipe Name | Target Duration | Aspect Ratio | Tone / Genre | Description |
|---|---|---|---|---|
| `youtubeIntro` | 5 seconds | 16:9 | High Energy / Tech | Punchy YouTube channel opener with aurora backdrop, title reveal, sparkles, and light sweep. |
| `logoReveal` | 6 seconds | 16:9 | Luxury / Tech | Dramatic dark environment with 3D extruded emblem, shimmering particles, and anamorphic flare. |
| `productLaunch` | 15 seconds | 16:9 | Commercial / Debut | Multi-scene product teaser, 3D hero title reveal, key feature cards, and CTA end card. |
| `hypePromo` | 30 seconds | 16:9 | High Octane / Sports | Beat-synced cuts, cyberGrid background, 3D text with bounce rig, glitch cuts, and countdown. |
| `socialAd15s` | 15 seconds | 9:16 Vertical | Direct Response | Vertical format with hook headline, problem statement, solution callout, confetti, and bio CTA. |
| `kineticTypography` | 10 seconds | 16:9 | Manifesto / Speech | Fast rhythmic timed quote cards, camera shake rig, bold typographic bursts, and film grain. |
| `eventRecap` | 20 seconds | 16:9 | Corporate / Festival | Ambient opener, gradient wave background, milestone metric lower thirds, and date replay outro. |
| `cinematicTrailer` | 25 seconds | 2.35:1 Letterbox | Cinematic / Drama | Slow suspenseful teaser reveals, constellation 3D scene, crescendo buildup, and title climax. |
| `slideshow` | 20 seconds | 16:9 | Filmic / Portfolio | Soft cross-dissolves, bokeh shimmer background, lower-third project caption cards, and warm grade. |
| `countdown` | 10 seconds | 16:9 | Broadcast / Event | Animated 10-to-1 digit countdown with pulse animations, strobe flashes, and climax text burst. |
| `tutorialIntro` | 8 seconds | 16:9 | Educational | Clean episode chapter badge, subject lesson title card, and instructor lower third. |
| `lowerThirdPack` | 6 seconds | 16:9 | Broadcast News | Professional lower-third overlay with speaker name, company role, social handle, and accent bar. |

---

## Recipe Structure

Each recipe is stored as a JSON document in the `/recipes` directory:

```json
{
  "name": "youtubeIntro",
  "description": "High-impact 5-second YouTube channel opener...",
  "duration": 5,
  "inputs": {
    "channelName": {
      "type": "string",
      "default": "CREATOR HUB",
      "description": "Main channel or show name"
    },
    "tagline": {
      "type": "string",
      "default": "NEW VIDEOS EVERY WEEK",
      "description": "Channel slogan or posting schedule"
    }
  },
  "storyboard": {
    "title": "{{channelName}} — YouTube Intro",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "brand": true,
    "scenes": [ ... ]
  }
}
```

---

## Running a Recipe

To invoke a recipe from an AI agent:
```json
{
  "name": "ae_run_recipe",
  "arguments": {
    "name": "productLaunch",
    "inputs": {
      "productName": "NOVA X1",
      "category": "WORKSTATION DESKTOP",
      "feature1": "UNREAL PERFORMANCE",
      "feature2": "ZERO LATENCY PIPELINE",
      "ctaText": "PRE-ORDER AT NOVA.DEV"
    }
  }
}
```
Placeholders like `{{productName}}` are substituted automatically, brand kit palettes are injected, and the master composition is assembled in After Effects.
