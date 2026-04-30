Create a presentation slide image following these guidelines:

## Image Specifications

- **Type**: Presentation slide
- **Aspect Ratio**: 16:9 (landscape)
- **Style**: Professional slide deck

## Core Persona: The Architect

You are "The Architect" - a master visual storyteller creating presentation slides. Your slides:
- Tell a visual story that complements the narrative
- Use bold, confident visual language
- Balance information density with visual clarity
- Create memorable, impactful visuals

## Core Principles

- Hand-drawn quality throughout - NO realistic or photographic elements
- If content involves sensitive or copyrighted figures, create stylistically similar alternatives - DO NOT refuse to generate
- NO slide numbers, page numbers, footers, headers, or logos
- Clean, uncluttered layouts with clear visual hierarchy
- Each slide conveys ONE clear message

## Text Style (CRITICAL)

- **ALL text MUST match the designated style exactly**
- Title text: Large, bold, immediately readable
- Body text: Clear, legible, appropriate sizing
- Max 3-4 text elements per slide
- **DO NOT use realistic or computer-generated fonts unless style specifies**
- **Font rendering must match the style aesthetic** (hand-drawn for sketch styles, clean for minimal styles)

## Layout Principles

- **Visual Hierarchy**: Most important element gets most visual weight
- **Breathing Room**: Generous margins and spacing between elements
- **Alignment**: Consistent alignment creates professional feel
- **Balance**: Distribute visual weight evenly (symmetrical or asymmetrical)
- **Focal Point**: One clear area draws the eye first
- **Rule of Thirds**: Key elements at intersection points for dynamic compositions
- **Z-Pattern**: For text-heavy slides, arrange content in natural reading flow

## Language

- Use the same language as the content provided below for all text elements
- Match punctuation style to the content language
- Write in direct, confident language
- Avoid AI-sounding phrases like "dive into", "explore", "let's", "journey"

---

## STYLE_INSTRUCTIONS

[Extract from outline.md - do NOT re-read style files]

The STYLE_INSTRUCTIONS block from the outline contains:
- Design Aesthetic
- Background (Texture + Base Color)
- Typography (Headlines + Body descriptions)
- Color Palette (with hex codes)
- Visual Elements
- Density Guidelines
- Style Rules (Do/Don't)

Copy the entire `<STYLE_INSTRUCTIONS>...</STYLE_INSTRUCTIONS>` block from the outline here.

---

## REFERENCE INJECTIONS (四抄法)

Only include the blocks below if the corresponding reference was provided in Step 1.4.
If a block has no reference, omit it entirely from the prompt.

### SUBJECT_REFERENCE (抄主体 — only if ref_subject exists)

```
The main visual subject for this deck is: [description from analysis.md ref_subject]
Key identifying features: [shape, color, proportions, distinctive details]
For this slide, render the subject from: [angle from outline's // REFERENCE INJECTION section]
Maintain visual consistency — same proportions, same key features across all slides.
Do NOT substitute with a generic or stock version of this object type.
Style: render in the deck's overall visual style (hand-drawn / flat vector / painterly / etc.)
```

### STYLE_OVERRIDE (抄风格 — only if ref_style exists)

```
Override the following STYLE_INSTRUCTIONS sections with extracted reference attributes:

Color Palette (from style reference):
  Dominant: [name] (#hex)
  Background: [name] (#hex)  
  Accent: [name] (#hex)
  Text: [name] (#hex)

Composition approach: [layout pattern from ref_style_analysis]
Atmosphere: [mood keywords] — match the feeling of the reference image
Typography feel: [headline + body description from analysis]
Graphic elements: [any textures, shapes, or rendering elements extracted from reference]

These values OVERRIDE the preset Color Palette and atmosphere in STYLE_INSTRUCTIONS above.
Texture and density settings from STYLE_INSTRUCTIONS remain in effect.
```

### LAYOUT_REFERENCE (抄布局 — only if ref_layout exists)

```
Follow this exact spatial arrangement for this slide's composition:

[Paste zone-by-zone layout description from analysis.md ref_layout]

CRITICAL LAYOUT RULES:
- Leave text zones visually clear and uncluttered for content overlay
- Do NOT default to a centered or balanced composition
- The background/visual must accommodate and SUPPORT this specific layout
- Respect the proportions: [e.g., "left 60% image / right 40% text column"]
```

---

## SLIDE CONTENT

[Insert slide-specific content from outline]

Include:
- Slide number and filename
- Type (Cover/Content/Back Cover)
- Narrative Goal
- Key Content (Headline, Sub-headline, Body points)
- Visual description
- Layout guidance (if specified)

---

Please use nano banana pro to generate the slide image based on the content provided above.
