# Reference-Driven Mode — 四抄法操作指南

Inspired by the "四抄法" (Four-Copy Method) from professional PPT creators:
抄主体 → 抄风格 → 抄布局 → 抄逻辑

This guide defines how to inject reference materials into the slide generation pipeline to produce
decks that feel **custom, high-quality, and non-templated**.

---

## Why Reference-Driven?

Standard AI PPT generation fails because:
- **配图LOW** — Generic stock visuals with no connection to the real subject
- **排版混乱** — AI guesses layout without spatial constraints
- **风格撞款** — Same template applied to every deck

Reference-Driven Mode solves this by giving AI **concrete anchors** instead of vague style words.

---

## The Four Methods

### 1. 抄主体 (Copy the Subject)

**Goal**: Establish a consistent, high-quality visual of your main subject across all slides.

**When to use**:
- Your deck features a product, vehicle, character, logo, or physical object
- You want multi-angle views of the same subject (front, side, 3/4 view)
- You want visual consistency: every slide shows the same subject, not random stock

**What to provide**: One clear reference photo of the subject (product photo, screenshot, illustration)

**What AI does**:
1. Analyzes the reference to understand the subject's visual identity
2. Describes it in detail (shape, colors, distinctive features)
3. In each relevant slide prompt, generates the subject from the angle best suited for that slide's composition

**Prompt injection template** (`SUBJECT_REFERENCE` block):
```
## SUBJECT_REFERENCE

The main visual subject for this deck is: [describe from reference image]
Key identifying features: [shape, color, proportions, distinctive details]
For this slide, render the subject from: [angle: front/3-quarter/side/detail/overhead]
Maintain visual consistency with the reference — same proportions, same key features.
Do NOT substitute with a generic or stock version of this type of object.
Style: match the deck's overall style (hand-drawn / flat vector / painterly / etc.)
```

---

### 2. 抄风格 (Copy the Style)

**Goal**: Transfer the visual mood, color system, and composition language from a reference design.

**When to use**:
- You have a brand poster, magazine cover, or competitor deck you want to match
- You want a specific visual atmosphere (dark cinematic, clean minimalist, warm editorial, etc.)
- The standard presets don't capture the exact vibe you need

**What to provide**: One or more reference images (poster, screenshot, mood board)

**What AI does**:
1. Deconstructs the reference into structured style attributes
2. Extracts color palette (approximate hex codes)
3. Identifies composition patterns, spacing philosophy, typographic character
4. Overrides the default `STYLE_INSTRUCTIONS` with the extracted attributes

**Style extraction analysis template** (save to `analysis.md` under `ref_style_analysis`):
```markdown
### Extracted Style Analysis

Source: [filename or description]

**Colors**:
- Dominant: [name] (#hex)
- Secondary: [name] (#hex)
- Accent: [name] (#hex)
- Background: [name] (#hex)

**Composition**:
- Layout pattern: [centered / asymmetric / grid / rule-of-thirds / full-bleed]
- Negative space: [generous / tight / minimal]
- Focal point: [top-left / center / bottom-third / etc.]

**Mood keywords**: [e.g., dark+cinematic, clean+corporate, warm+editorial, vibrant+rebellious]

**Typography character**:
- Headline feel: [bold+condensed / elegant+serif / handwritten / geometric+sans]
- Body feel: [tight / airy / monospaced / humanist]

**Visual elements**:
- [Graphic elements observed: halftone, grain, geometric shapes, organic blobs, etc.]
- [Rendering style: flat, painterly, photographic, illustrated, sketchy]
```

**Prompt injection template** (`STYLE_OVERRIDE` block):
```
## STYLE_OVERRIDE (from reference image)

Override standard STYLE_INSTRUCTIONS with the following extracted attributes:

Color Palette (extracted from reference):
  Primary: [name] (#hex)
  Background: [name] (#hex)
  Accent: [name] (#hex)
  Text: [name] (#hex)

Composition:
  Follow [layout pattern] composition with [negative space description]
  Place focal elements at [position]

Atmosphere: [mood keywords] — evoke the same feeling as the reference

Typography feel: [description — visual appearance, NOT font names]

Visual elements to include: [extracted graphic elements]

This style OVERRIDES the preset style dimensions for color and atmosphere.
Maintain the deck's texture and density settings from STYLE_INSTRUCTIONS.
```

---

### 3. 抄布局 (Copy the Layout)

**Goal**: Force AI to respect a specific spatial arrangement instead of guessing layout.

**When to use**:
- You've sketched a wireframe or drawn grid boxes in your slides tool
- You have a reference slide with a specific layout you want to replicate
- You want an asymmetric, editorial, or non-standard composition that AI defaults away from

**What to provide**: A sketch, wireframe screenshot, or annotated layout image

**What AI does**:
1. Reads the spatial arrangement from your sketch
2. Respects the grid: where images go, where text blocks sit, what size/proportion
3. Generates a background image that accommodates your layout (leaves appropriate space for content overlay)

**How to describe the layout** (from sketch analysis):
```markdown
### Layout Description (from ref_layout sketch)

Grid structure:
- [Top half / Bottom third / Left column / etc.]: [image area / text area / empty]
- [Describe each zone and its purpose]

Key constraints:
- Image placement: [where the main visual sits]
- Text placement: [where headline / body text will be overlaid]
- Whitespace: [deliberately empty zones]

Spatial relationship:
- [e.g., Large hero image on left 60%, text column on right 40%]
- [e.g., Full-bleed background with centered text box in lower third]
```

**Prompt injection template** (`LAYOUT_REFERENCE` block):
```
## LAYOUT_REFERENCE (from layout sketch)

Follow this exact spatial arrangement for the slide composition:

[Paste layout description from analysis]

CRITICAL: Leave the text areas visually clear and uncluttered so content can be overlaid.
The background image should SUPPORT this layout — not fight it.
Do NOT default to a standard balanced composition; follow the sketch layout precisely.
```

---

### 4. 抄逻辑 (Copy the Logic / Structure)

**Goal**: Extract a clean information hierarchy from messy or dense source content.

**When to use**:
- Source content is a long document, transcript, or dump of information
- Content has many points but unclear priority
- You want the deck to tell a clear story, not just list everything

**This method is handled by the existing `analysis-framework.md`** — specifically:
- Section 1: Message Hierarchy (core message → supporting points → CTA)
- Section 5: Content Adaptation (keep / simplify / visualize / omit)

**Enhanced prompt for content restructuring** (use when source content is dense):
```
Restructure this content for a slide deck:

1. Identify the ONE core message (≤15 words)
2. Group supporting points into 3-5 themes
3. For each theme, extract:
   - Headline: a narrative statement (not a label)
   - 2-3 bullet points with specific details
   - One visual opportunity (chart / diagram / metaphor)
4. Flag content to omit (redundant, tangential, audience-already-knows)
5. Suggest slide order for maximum impact

Source content:
[paste content]
```

---

## Combined Usage

All four methods can be used simultaneously. Priority order when conflicts arise:

| Method | Affects | Override Priority |
|--------|---------|------------------|
| 抄风格 (Style) | Color palette, atmosphere, typography | Overrides preset color/mood |
| 抄布局 (Layout) | Spatial composition per slide | Overrides standard layout selection |
| 抄主体 (Subject) | Main visual element identity | Adds to, does not override style |
| 抄逻辑 (Logic) | Content structure, slide order | Upstream — happens before style |

---

## Practical Example: Product Launch Deck

**Scenario**: Making a deck for a new electric scooter, referencing a Vespa brand poster

```bash
/sengclaw-slide-deck product-brief.md \
  --ref-subject scooter-product-photo.jpg \
  --ref-style vespa-poster-reference.jpg \
  --ref-layout sketched-wireframe.jpg
```

**What happens**:
1. **抄主体**: AI analyzes scooter photo → generates front/side/detail views for each slide
2. **抄风格**: AI extracts Vespa poster's warm Italian palette, retro editorial typography, centered composition → overrides cold corporate colors
3. **抄布局**: AI follows wireframe grid → respects the asymmetric image-left / text-right layout in product slides
4. **抄逻辑**: Analysis framework restructures product brief into Problem → Solution → Features → CTA flow

**Result**: A deck that looks like a premium brand presentation, not a generic AI template.

---

## File Storage Convention

Reference files referenced in prompts should be stored alongside the deck:

```
slide-deck/{topic-slug}/
├── refs/
│   ├── subject-ref.jpg
│   ├── style-ref.jpg
│   └── layout-sketch.jpg
├── analysis.md          ← includes ref_style_analysis
├── outline.md
└── prompts/
```

Agent should copy referenced files into `refs/` when collecting references in Step 1.4.

---

## Quality Checklist for Reference-Driven Slides

After generation, verify:

- [ ] **主体一致性**: Does the subject look the same across slides? Same proportions, same key features?
- [ ] **风格迁移**: Does the color palette match the reference? Same atmosphere?
- [ ] **布局遵守**: Did the AI follow the sketch layout or default to something generic?
- [ ] **逻辑清晰**: Does the deck tell one clear story? Is the flow logical?

If any check fails → use `--regenerate N` with an updated prompt that strengthens the relevant reference block.
