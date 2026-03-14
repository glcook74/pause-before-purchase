# Dopamine Delay

**A pause-before-purchase Chrome extension designed for ADHD brains.**

Dopamine Delay intercepts online checkout pages and introduces a brief, voluntary pause — giving your prefrontal cortex a chance to weigh in before dopamine-driven impulse spending takes over.

> Working **with** your brain, not against it.

---

## The Science Behind It

Every feature in Dopamine Delay is grounded in ADHD neuroscience research:

### Dopamine Reward Deficit Model (Volkow et al., 2009)
ADHD brains have lower baseline dopamine activity in reward pathways. This creates a drive to seek immediate, high-dopamine rewards — like impulse purchases. Dopamine Delay doesn't block that drive; instead, it **redirects** it toward healthier dopamine sources (music, movement, puzzles, connection).

### Delay Discounting
People with ADHD show steeper delay discounting — future rewards feel worth significantly less than immediate ones. A brief 10–30 second pause interrupts the impulse-to-action pipeline, allowing time for prefrontal evaluation. The pause scales up for larger purchases (>£50) and late-night shopping (after 9pm) when executive function is weakest.

### Affect Labelling (Lieberman et al., 2007)
Naming an impulse ("Is this necessary, planned, or impulsive?") activates prefrontal regions that reduce the emotional intensity of the impulse. The self-classification step is therapeutic, not judgmental.

### Novelty Seeking (Black et al., 2012)
ADHD brains habituate quickly. The dopamine alternative suggestions rotate randomly on each visit to maintain novelty value and engagement.

### Inhibitory Control & Time Blindness (Barkley, 1997)
The "Save for Later" feature activates future-oriented thinking, counteracting ADHD time blindness. Items saved can be re-evaluated 24–48 hours later, when desire intensity has typically reduced significantly.

### Dark Pattern Vulnerability (Mildner et al., CHI '25)
People with ADHD are disproportionately affected by urgency-based dark patterns ("Only 3 left!"). Dopamine Delay detects and names these manipulations, reducing their effect.

### Positive Reinforcement (Hauser et al., 2017)
The Delay Points system uses variable reward schedules and streak mechanics to activate the dopamine reward pathway for healthy behaviours. Points reward genuine behaviour change, not gaming.

---

## Features

### 1. Checkout Detection Engine
Automatically detects checkout/payment pages on major UK e-commerce sites (Amazon.co.uk, ASOS, eBay UK, Argos, Tesco, Boots, John Lewis, Currys, SHEIN, Klarna-enabled sites) and any URL containing checkout-related patterns.

### 2. Pause Overlay — Screen 1: "Before you buy"
- Shows site name, product name, and price (extracted from page)
- Asks: "What kind of purchase is this?" — Necessary / Planned / Impulsive
- Necessary or Planned → brief affirmation, overlay closes (+5 points)
- Impulsive → advances to Screen 2

### 3. Pause Overlay — Screen 2: "Redirect that energy"
- Rotating dopamine alternative tiles (music, movement, puzzle, breathing, learning, creativity, social, nature)
- Countdown timer (10–60 seconds depending on settings, price, and time of day)
- Alternatives link to external resources or provide inline guidance
- "Save for later" button

### 4. Save for Later
- Stores product name, site, price, and timestamp locally
- Awards +15 Delay Points
- Items reviewable in the popup dashboard

### 5. Popup Dashboard
- **Today tab**: Pauses completed, points earned, money potentially saved, streak counter
- **Saved tab**: List of saved items with "Still want it?" prompt — buy now or remove (+10 bonus points for removing)
- **Settings tab**: Pause duration, late-night mode, theme (cream/dark)

### 6. Onboarding Flow
- 5-screen welcome sequence on first install
- Profile question to personalise dopamine alternatives
- +50 welcome points

### 7. Delay Points System
| Action | Points |
|--------|--------|
| First install (welcome) | +50 |
| Complete pause classification | +5 |
| Save for later | +15 |
| Remove saved item ("I've moved on") | +10 |
| 7-day streak | +25 |

### 8. Dark Pattern Alerts
Detects urgency language ("Only X left", "Flash sale", "Limited time", etc.) and shows a heads-up banner: *"This page is using urgency tactics. You have more time than it seems."*

---

## Design

- **Colour palette**: Cream background (#F5F0E8), teal-green accent (#2A7D6B), gold highlights (#C9921A)
- **Typography**: Georgia for headings, system sans-serif for body
- **Tone**: Warm, non-judgmental, strengths-based — never shame language
- **Language**: "pause" not "block", "redirect" not "stop", "your choice" not "override"

---

## Installation (Chrome Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the folder containing `manifest.json`
6. The Dopamine Delay icon will appear in your extensions toolbar
7. Complete the onboarding flow that opens automatically

---

## Folder Structure

```
/
├── manifest.json          # Chrome Manifest V3 configuration
├── background.js          # Service worker — lifecycle, checkout URL detection
├── content.js             # Content script — overlay injection on checkout pages
├── overlay.css            # Styles for the pause overlay
├── overlay.html           # Overlay template reference
├── popup.html             # Extension popup dashboard
├── popup.js               # Popup dashboard logic
├── popup.css              # Popup dashboard styles
├── onboarding.html        # First-install onboarding flow
├── onboarding.js          # Onboarding logic
├── icons/
│   ├── icon16.png         # Toolbar icon (16×16)
│   ├── icon48.png         # Extension management icon (48×48)
│   └── icon128.png        # Chrome Web Store icon (128×128)
├── lib/
│   ├── storage.js         # Namespaced Chrome storage utilities (dd_* keys)
│   └── alternatives.js    # Dopamine alternative library with rotation
└── README.md
```

---

## Storage Keys

All storage keys are namespaced with `dd_` prefix:

| Key | Description |
|-----|-------------|
| `dd_points` | Total Delay Points earned |
| `dd_streak` | Streak counter (count + last date) |
| `dd_saved_items` | Array of saved-for-later items |
| `dd_pauses_today` | Today's pause count |
| `dd_profile` | User profile type (impulsive/stressed/tracker) |
| `dd_settings` | User preferences (pause duration, late-night mode, theme) |
| `dd_onboarded` | Whether onboarding has been completed |
| `dd_disabled_sites` | Sites where the extension is disabled |

---

## Testing

1. **Checkout detection**: Visit amazon.co.uk, asos.com, ebay.co.uk, or argos.co.uk checkout pages
2. **Points accumulation**: Open popup dashboard → Today tab → verify points after pausing
3. **Overlay flow**: Test all three paths (Necessary, Planned, Impulsive)
4. **Dark pattern detection**: Visit a page with "Only 3 left in stock" text
5. **Streak counter**: Complete a pause, verify streak increments daily
6. **Save for later**: Click save, verify item appears in Saved tab
7. **Settings**: Change pause duration and theme, verify changes apply

---

## Phase 1 Scope

This is Phase 1. The following are **not** included and are deferred to later phases:
- Mobile app
- Open banking / real account balance integration
- BNPL calculator
- AI personalisation engine
- Backend server or user accounts
- Social/community features
- Subscription auditor

---

## References

- Volkow, N. D., et al. (2009). Evaluating dopamine reward pathway in ADHD. *JAMA*.
- Barkley, R. A. (1997). ADHD and the nature of self-control. *Guilford Press*.
- Lieberman, M. D., et al. (2007). Putting feelings into words: Affect labelling disrupts amygdala activity. *Psychological Science*.
- Black, D. W., et al. (2012). Novelty seeking and impulse control in ADHD.
- Hauser, T. U., et al. (2017). Role of the medial prefrontal cortex in impaired decision-making in ADHD. *JAMA Psychiatry*.
- Mildner, T., et al. (CHI '25). Dark pattern exploitation and ADHD vulnerability.

---

*Dopamine Delay — every pause is a win.*
