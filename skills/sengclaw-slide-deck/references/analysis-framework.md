# Presentation Analysis Framework

Deep content analysis for effective slide deck creation.

## 1. Message Hierarchy

Identify the core message structure before designing slides.

### Core Message (One Sentence)
- What is the single most important takeaway?
- If the audience remembers only one thing, what should it be?
- Can you state it in ≤15 words?

### Supporting Points (3-5 Maximum)
- What evidence supports the core message?
- What sub-topics must be covered?
- Prioritize by audience relevance, not source order

### Call-to-Action
- What should the audience DO after viewing?
- Is it clear, specific, and achievable?
- Where does it appear (slide position)?

## 2. Audience Decision Matrix

| Question | Analysis |
|----------|----------|
| Who is the primary audience? | [Role, expertise level, relationship to topic] |
| What do they currently believe? | [Existing knowledge, assumptions, biases] |
| What decision do we want them to make? | [Specific action or conclusion] |
| What barriers exist? | [Objections, concerns, missing information] |
| What evidence will convince them? | [Data types, credibility sources, emotional hooks] |

### Audience Adaptation

| Audience Type | Content Focus | Visual Treatment |
|---------------|---------------|------------------|
| Executives | Outcomes, ROI, strategic impact | High-level, clean, data highlights |
| Technical | Architecture, implementation, specs | Detailed diagrams, code, schematics |
| General | Benefits, stories, relatability | Visual metaphors, simple charts |
| Investors | Market size, traction, team | Growth charts, milestones, comparisons |
| Learners | Step-by-step, examples, practice | Progressive reveals, exercises |

## 3. Visual Opportunity Map

Identify which content benefits from visualization.

### Content-to-Visual Mapping

| Content Type | Visual Treatment | Example |
|--------------|------------------|---------|
| Comparisons | Side-by-side, before/after | Feature comparison table |
| Processes | Flow diagrams, numbered steps | Workflow illustration |
| Hierarchies | Org charts, pyramids, trees | Organizational structure |
| Timelines | Horizontal/vertical timelines | Project milestones |
| Statistics | Charts, highlighted numbers | Key metrics with context |
| Concepts | Icons, metaphors, illustrations | Abstract idea visualization |
| Relationships | Venn diagrams, networks | Ecosystem or dependencies |
| Lists | Structured grids, icon rows | Feature bullets with icons |

### Visual Priority

Rate each piece of content:
- **Must Visualize**: Complex data, key differentiators, memorable moments
- **Should Visualize**: Supporting evidence, secondary points
- **Text Only**: Simple statements, transitions, minor details

## 4. Presentation Flow

Structure for impact and retention.

### Opening (First 2-3 Slides)

| Element | Purpose |
|---------|---------|
| Hook | Capture attention (surprising stat, question, story) |
| Context | Why this matters now |
| Preview | What audience will learn/gain |

### Middle (Content Slides)

| Pattern | When to Use |
|---------|-------------|
| Problem → Solution | Introducing new products/ideas |
| Situation → Complication → Resolution | Complex business cases |
| What → Why → How | Educational content |
| Past → Present → Future | Transformation stories |
| Claim → Evidence → Implication | Data-driven arguments |

### Closing (Final 2-3 Slides)

| Element | Purpose |
|---------|---------|
| Synthesis | Tie back to core message |
| Call-to-Action | Clear next steps |
| Memorable Close | Resonant quote, image, or statement |

### Transitions

- Each slide should answer: "What comes next?"
- Use narrative connectors between sections
- Build logical progression, not topic jumps

## 5. Content Adaptation

Decide what to keep, transform, or omit.

### Keep (High Value)
- Core arguments and evidence
- Unique insights or data
- Audience-relevant examples
- Memorable quotes or statistics

### Simplify (Medium Value)
- Technical details → Visual summaries
- Long explanations → Bullet hierarchies
- Multiple examples → Best 1-2 examples
- Background context → Brief framing

### Visualize (Transform)
- Data tables → Charts or highlighted numbers
- Process descriptions → Flow diagrams
- Comparisons in text → Side-by-side visuals
- Abstract concepts → Concrete metaphors

### Omit (Low Value)
- Tangential information
- Redundant examples
- Excessive caveats
- Background the audience already knows

## 6. Reference Material Analysis (四抄法)

Analyze any provided reference materials before generating the outline.
Full injection details in `references/reference-driven-guide.md`.

### 6A. Subject Reference (抄主体)

When a subject reference image is provided:

| Analysis Point | Questions to Answer |
|----------------|---------------------|
| Subject identity | What is it? What category/type? |
| Distinctive features | Shape, color, proportions, key details that make it unique |
| Visual versatility | Which angles work? (front, 3/4, side, detail, overhead) |
| Style compatibility | Is it photographic, illustrated, abstract? How does it fit the deck style? |

Output: `ref_subject` entry in `analysis.md` with description + angle recommendations per slide type

### 6B. Style Reference (抄风格)

When a style reference image is provided:

| Analysis Point | Extraction Method |
|----------------|-------------------|
| Color palette | Identify 4-6 dominant colors, estimate hex values |
| Composition pattern | Name the layout type (centered, asymmetric, rule-of-thirds, grid, etc.) |
| Negative space | Generous / tight / minimal — how much breathing room |
| Mood keywords | List 3-5 adjectives that capture the atmosphere |
| Typography character | Describe headline + body text visual feel (NOT font names) |
| Graphic elements | Any textures, grain, geometric shapes, lines, ornaments |

Output: `ref_style_analysis` block in `analysis.md`; this analysis will **override** the preset color/atmosphere sections in `STYLE_INSTRUCTIONS`

### 6C. Layout Reference (抄布局)

When a layout sketch or wireframe is provided:

| Analysis Point | Questions to Answer |
|----------------|---------------------|
| Grid structure | How many zones? What are their proportions? |
| Image zones | Where do visuals go? What size/shape? |
| Text zones | Where do headline / body / captions sit? |
| Whitespace zones | Any deliberately empty areas? |
| Slide applicability | Is this a universal layout or for specific slide types only? |

Output: `ref_layout` entry in `analysis.md` with zone-by-zone description

### 6D. Reference Impact on Style Recommendation

| Reference Provided | Effect on Auto Style Selection |
|---------------------|-------------------------------|
| Style reference only | Extracted style partially overrides recommended preset |
| Subject reference only | No change to style; subject injected into prompts |
| Layout reference only | No change to style; layout injected per slide |
| Style + Layout | Both injected; style preset becomes secondary |
| All three | Full reference-driven mode; preset is baseline only |

### Reference Analysis Checklist

- [ ] Subject identified and described in detail
- [ ] Subject angles mapped to slide types (cover, feature, detail, back-cover)
- [ ] Style palette extracted with approximate hex codes
- [ ] Composition pattern named
- [ ] Mood keywords listed (3-5)
- [ ] Typography character described
- [ ] Layout zones defined (if sketch provided)
- [ ] Reference summary written to `analysis.md`

## 7. Analysis Checklist

Before outline creation, confirm:

### Message Clarity
- [ ] Core message stated in one sentence
- [ ] 3-5 supporting points identified
- [ ] Call-to-action defined

### Audience Fit
- [ ] Primary audience identified
- [ ] Existing beliefs mapped
- [ ] Desired decision clear
- [ ] Evidence matches audience needs

### Visual Planning
- [ ] Key visualizations identified
- [ ] Chart/diagram types selected
- [ ] Visual priority assigned

### Flow Design
- [ ] Opening hook defined
- [ ] Middle pattern selected
- [ ] Closing approach planned
- [ ] Transitions considered

### Content Decisions
- [ ] Keep/simplify/visualize/omit applied
- [ ] Source material fully processed
- [ ] No important content overlooked
