# Pharmacy2U Design Theme Reference

> Reverse-engineered from https://www.pharmacy2u.co.uk/ for consistent UI replication.

---

## Tech Stack

- **Framework:** Next.js (App Router, `/_next/static/` asset paths)
- **CSS:** Tailwind CSS utility classes (no CSS custom property design tokens — styles are inline utilities)
- **Icons:** Google Material Symbols (Outlined, Rounded, Sharp variants)
- **Carousel:** Splide.js
- **Date picker:** react-datepicker (used in booking flows)
- **Loading states:** react-loading-skeleton

---

## Brand Identity

**Logo:** Pharmacy2U — wordmark in dark navy with a 2×2 grid of coloured squares (teal + rose/pink)
**Logo SVG:** `https://www.pharmacy2u.co.uk/themes/p2u/assets/p2u_logo.svg` *(Cloudflare protected — download from browser)*
**Local assets:** `resources/brand-assets/` — Material Symbols font files downloaded
**Tone:** Clean, clinical, trustworthy — but warm and approachable. NHS-adjacent without being cold.

---

## Colour Palette

### Core Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-heading` | `#005c8f` | Headings, primary text in light contexts (confirmed from logo SVG) |
| `--color-text` | `#001b1c` | Body text, nav links, footer text |
| `--color-accent` | `#00e0bc` | Primary CTA button (header), active states, highlights |
| `--color-accent-muted` | `#c5ffec` | Active nav pill background (transparent mint) |
| `--color-button` | `#84daff` | Secondary/alternate button fill |
| `--color-button-text` | `#003052` | Button label text (dark navy) |

### Extended Palette (from visuals)

| Name | Hex | Usage |
|---|---|---|
| White | `#ffffff` | Header bg, card bg, footer bg |
| Near-black | `#001b1c` | Body text |
| Dark navy | `#003052` | Button text, deep accents |
| Hero purple | `#d4a0e8` | Hero/carousel background (lavender) |
| Dark purple | `#3d1d5c` | Hero headings, filled hero buttons |
| Coral/promo | `#e8423a` | Promotional badge backgrounds |
| Teal accent | `#00e0bc` | CTAs, active pills, accent icons |
| Light mint | `#c5ffec` | Active pill bg, hover states |
| Light blue | `#84daff` | Secondary button, soft highlights |
| Light grey | `#f5f7fa` | Section backgrounds, tool card areas |

### Category Tile Colours (service cards)

Each service category uses a distinct pastel/saturated background:

| Category | Colour |
|---|---|
| NHS Prescriptions | Teal / cyan |
| Online Doctor | Pink / rose |
| Shop | Yellow / amber |
| NHS Services | Blue |
| Pet Health | Pink |

---

## Typography

### Font Families

| Role | Font | Fallback | CSS Variable / Class |
|---|---|---|---|
| Display / Headings | **Nunito** (sub for Filson Pro Bold) | system sans-serif | Google Fonts — `font-family: 'Nunito', sans-serif` |
| UI / Navigation / Body | **Inter** | system sans-serif | `__Inter_472ac2` |

### Type Scale (estimated from visuals)

| Element | Size | Weight | Font |
|---|---|---|---|
| Hero H1 | ~40–48px | Bold (700) | Filson Pro Bold |
| Page H1 | ~32–36px | Bold (700) | Filson Pro Bold |
| Section H2 | ~24–28px | Bold (700) | Filson Pro Bold |
| Card H2/H3 | ~18–22px | Bold (700) | Filson Pro Bold |
| Body / paragraph | 14–16px | Regular (400) | Inter |
| Navigation links | 14–16px | Medium (500) | Inter |
| Small / legal | 12–13px | Regular (400) | Inter |
| Button labels | 14–16px | Medium/Semi-bold | Inter |

### Line Heights

| Context | Line Height |
|---|---|
| Headings | ~1.2–1.3 |
| Body text | ~1.5–1.6 |
| Navigation | ~1 (vertically centred) |

---

## Layout & Grid

### Page Structure

```
┌─────────────────────────────────────────────┐
│  HEADER (sticky)                            │
│  ┌─────────────────────────────────────────┐│
│  │  Logo  │  Search Bar  │  Basket + CTA  ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │  Main Nav (horizontal pill tabs)        ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  HERO (full-width carousel)                 │
├─────────────────────────────────────────────┤
│  TRUST BAR (4 icon+text blocks)             │
├─────────────────────────────────────────────┤
│  SERVICE TILES (2×3 grid cards)             │
├─────────────────────────────────────────────┤
│  HEALTH TOOLS (large card + 5 small cards)  │
├─────────────────────────────────────────────┤
│  PRODUCT CAROUSEL (horizontal scroll)       │
├─────────────────────────────────────────────┤
│  PROMO BANNER (full-width image/colour)     │
├─────────────────────────────────────────────┤
│  TESTIMONIALS CAROUSEL                      │
├─────────────────────────────────────────────┤
│  APP DOWNLOAD SECTION                       │
├─────────────────────────────────────────────┤
│  FOOTER (4-column links + legal)            │
└─────────────────────────────────────────────┘
```

### Container

- Max width: **~1200px**
- Horizontal padding: **16–24px** (mobile), **32–48px** (desktop)
- Centered with `margin: 0 auto`

### Breakpoints (estimated)

| Name | Width |
|---|---|
| Mobile | < 768px |
| Tablet | 768px – 1024px |
| Desktop | > 1024px |

---

## Components

### Header

- **Background:** White (`#ffffff`)
- **Height:** ~70–80px for utility bar
- **Two rows:** logo+search+auth row, then nav links row
- **Sticky** on scroll
- **Border-bottom:** subtle (1px light grey or none)

### Navigation

- **Font:** Inter, medium weight
- **Text colour:** `#001b1c`
- **Active item:** pill background `#c5ffec` (light mint)
- **Hover:** subtle underline or colour shift
- **Style:** flat horizontal links, no dropdowns visible on homepage

### Search Bar

- **Background:** white or very light grey
- **Border:** `1px solid #e0e0e0` or similar light grey
- **Border-radius:** ~24px (pill shape)
- **Placeholder text:** "Search for products..."
- **Search icon:** teal/dark, right-aligned

### Buttons

#### Primary Header CTA (Log In / Register)
```css
background-color: #00e0bc;
color: #003052;
border-radius: 24px; /* pill */
padding: 10px 20px;
font-family: Inter;
font-weight: 600;
border: none;
```

#### Primary Hero CTA (Get started / dark)
```css
background-color: #3d1d5c; /* dark purple */
color: #ffffff;
border-radius: 24px;
padding: 12px 24px;
font-family: Inter;
font-weight: 600;
```

#### Secondary / Outlined CTA
```css
background-color: transparent;
color: #3d1d5c;
border: 2px solid #3d1d5c;
border-radius: 24px;
padding: 12px 24px;
```

#### Section CTA Links (card buttons)
```css
background-color: #84daff; /* or #00e0bc */
color: #003052;
border-radius: 24px;
padding: 10px 20px;
font-weight: 600;
```

### Cards / Service Tiles

- **Border-radius:** ~12–16px
- **Padding:** ~20–24px
- **Background:** category-specific pastel colour
- **Contains:** icon/image at top, heading, bullet list of links, CTA button
- **Shadow:** subtle (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`)

### Hero / Carousel

- **Background:** full-bleed colour (varies per slide — lavender, blue, teal)
- **Height:** ~400–500px (desktop)
- **Layout:** text left, image right (50/50 or 60/40)
- **Heading:** large, Filson Pro Bold, dark colour against pastel bg
- **Promo badge:** pill/rounded rectangle, coral `#e8423a`, white text, sits above heading
- **Navigation:** arrow buttons on left/right edges, dot tabs below
- **Border-radius:** none (full bleed)

### Promotional Badge / Tag

```css
background-color: #e8423a;
color: #ffffff;
border-radius: 8px;
padding: 6px 12px;
font-size: 13px;
font-weight: 600;
display: inline-block;
```

### Trust Bar (social proof strip)

- 4 items in a row
- Each: icon + short bold text
- Light/white background
- Dividers or just spacing between items
- Text: `#001b1c`, icon colour: teal or matching

### Testimonial Cards

- White background
- Rounded corners (~12px)
- Star rating image (5-star visual)
- Heading in bold (review title)
- Body paragraph text
- Reviewer name in smaller text

### Footer

- **Background:** White (`#ffffff`)
- **Columns:** 5 columns (About us / Our services / Partnerships / Online purchases / Newsletter)
- **Column header:** bold, slightly larger than link text, dark navy
- **Links:** `#001b1c`, no underline by default, hover state likely underline
- **Social icons:** black, standard size (~24px)
- **Legal bar:** small text, `#001b1c`
- **Bottom logo:** Pharmacy2U icon only (squares, no wordmark)

---

## Spacing System

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 4px | Inline gaps, icon padding |
| `--space-sm` | 8px | Small gaps, tag padding |
| `--space-md` | 16px | Default element spacing |
| `--space-lg` | 24px | Card padding, section gaps |
| `--space-xl` | 32px | Section vertical padding |
| `--space-2xl` | 48–64px | Hero padding, major section gaps |

---

## Border Radius

| Element | Radius |
|---|---|
| Buttons (CTA) | `24px` (pill) |
| Search bar | `24px` (pill) |
| Nav active pill | `24px` |
| Cards / tiles | `12–16px` |
| Promo badge | `8px` |
| Images in hero | `16px` |

---

## Shadows

| Usage | Value |
|---|---|
| Cards | `box-shadow: 0 2px 8px rgba(0,0,0,0.08)` |
| Sticky header | `box-shadow: 0 1px 4px rgba(0,0,0,0.1)` |
| Hero image cards | `box-shadow: 0 4px 16px rgba(0,0,0,0.12)` |

---

## Icons

### Icon System: Material Symbols

The site uses **Google Material Symbols** (not custom SVGs) for all UI icons.

```html
<!-- Outlined variant (most common) -->
<span class="material-symbols-outlined">medication</span>

<!-- Rounded variant -->
<span class="material-symbols-rounded">shopping_cart</span>

<!-- Sharp variant -->
<span class="material-symbols-sharp">arrow_forward</span>
```

**CSS classes:**
```css
.material-symbols-outlined,
.material-symbols-rounded,
.material-symbols-sharp {
  font-size: 24px;   /* default */
  line-height: 1;
  font-weight: 400;
  display: inline-block;
}
```

**Font files** (downloaded to `resources/brand-assets/fonts/`):
- `material-symbols-outlined.woff2`
- `material-symbols-rounded.woff2`
- `material-symbols-sharp.woff2`

**To use via CDN instead:**
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
```

### Common icons observed on site

| Context | Icon name |
|---|---|
| Search | `search` |
| Basket | `shopping_basket` |
| Account/User | `person` |
| Arrow forward | `arrow_forward` |
| Prescriptions | `medication` |
| Calendar/Reminders | `calendar_today` |
| Carousel prev/next | `chevron_left` / `chevron_right` |

---

## Links & Hyperlinks

### Navigation Links (main nav)

```css
a {
  color: #001b1c;
  text-decoration: none;
  font-family: Inter;
  font-weight: 500;
  font-size: 14-16px;
}
a:hover {
  text-decoration: underline; /* or colour shift */
}
```

### Dashboard Sub-Navigation (pill tabs)

Horizontal scrollable tab row below the main header on authenticated pages:

```css
/* Tab container */
nav ul {
  display: flex;
  gap: 8px;
  list-style: none;
  overflow-x: auto;
  padding: 8px 0;
}

/* Individual tab */
.nav-tab {
  color: #001b1c;
  font-family: Inter;
  font-weight: 500;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 24px;   /* pill */
  text-decoration: none;
  white-space: nowrap;
}

/* Active tab */
.nav-tab.active {
  background-color: #c5ffec;   /* light mint */
  color: #001b1c;
}
```

**Tabs:** My Home · My Offers · Orders · Account · NHS Prescriptions · Online Doctor · Pet Health · NHS Free Services

### Card List Links (service tile bullets)

```css
li a {
  color: #001b1c;
  font-family: Inter;
  font-size: 14px;
  text-decoration: none;
  display: block;
  padding: 4px 0;
}
li a:before {
  content: "›";  /* or teal chevron icon */
  margin-right: 6px;
  color: #00e0bc;
}
li a:hover {
  text-decoration: underline;
}
```

### Footer Links

```css
footer a {
  color: #001b1c;
  font-size: 13-14px;
  text-decoration: none;
  display: block;
  margin-bottom: 6px;
}
footer a:hover {
  text-decoration: underline;
}

/* Footer column headings */
footer .col-heading {
  font-weight: 700;
  font-size: 14px;
  color: #001b1c;
  margin-bottom: 12px;
}
```

### Legal / Bottom links (inline)

```css
.legal-links a {
  color: #001b1c;
  font-size: 12px;
  text-decoration: none;
  display: inline;
}
.legal-links a:hover {
  text-decoration: underline;
}
```

---

## Form Elements

### Text Input / Email Field

```css
input[type="text"],
input[type="email"],
input[type="password"] {
  background-color: #ffffff;
  border: 1px solid #d1d5db;  /* light grey */
  border-radius: 8px;
  padding: 12px 16px;
  font-family: Inter;
  font-size: 14px;
  color: #001b1c;
  width: 100%;
  outline: none;
}
input:focus {
  border-color: #00e0bc;
  box-shadow: 0 0 0 2px rgba(0, 224, 188, 0.2);
}
input::placeholder {
  color: #9ca3af;
}
```

### Newsletter Submit (footer inline form)

```
┌─────────────────────────────┐ [→]
│  Enter your email           │
└─────────────────────────────┘
```
- Input + arrow button inline (pill-shaped container)
- Arrow button: circular, teal `#00e0bc`, white arrow icon

### Search Bar (header)

```css
.search-bar {
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  padding: 10px 16px;
  font-size: 14px;
  width: ~400px;
  display: flex;
  align-items: center;
}
.search-icon {
  color: #001b1c;
  margin-left: auto;
}
```

---

## Dashboard Page Design

### Layout

```
┌──────────────────────────────────────────────────────┐
│  HEADER (logo + search + account avatar/name)        │
│  MAIN NAV (horizontal nav links)                     │
│  DASHBOARD SUB-NAV (pill tabs: My Home, Orders...)   │
├──────────┬───────────────────────────────────────────┤
│ (sidebar │  GREETING: "Hello, [Name]"                │
│ on wider │  Account number + Switch patient          │
│ screens) │  PROMO BANNER (full-width image)          │
│          │  "Your Account" heading                   │
│          │  SERVICE CARDS GRID (2 col)               │
│          │  "You may also like" PRODUCT CAROUSEL     │
│          │  SECONDARY PROMO BANNER                   │
└──────────┴───────────────────────────────────────────┘
```

### Dashboard Service Cards

White background cards with:
- Bold heading (e.g. "View NHS Prescriptions")
- Short description text
- Illustration/icon top-right
- Full-width teal CTA button at bottom

```css
.dashboard-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.dashboard-card h2 {
  font-size: 16px;
  font-weight: 700;
  color: #001b1c;
  margin-bottom: 8px;
}
.dashboard-card p {
  font-size: 13px;
  color: #6b7280;
}
.dashboard-card .cta {
  background-color: #00e0bc;
  color: #003052;
  border-radius: 24px;
  padding: 10px;
  text-align: center;
  font-weight: 600;
  margin-top: 16px;
  display: block;
  width: 100%;
}
```

### Product Cards (shop/recommendations)

```css
.product-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.product-card img { border-radius: 8px; }
.product-card .name { font-size: 13px; font-weight: 500; color: #001b1c; }
.product-card .price { font-size: 16px; font-weight: 700; color: #001b1c; }
.product-card .was-price {
  font-size: 12px;
  color: #9ca3af;
  text-decoration: line-through;
}
.product-card .save { font-size: 12px; color: #dc2626; font-weight: 600; }
.product-card .add-btn {
  border: 1px solid #00e0bc;
  color: #003052;
  border-radius: 24px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

**Discount badge** (red, top-left of product image):
```css
.discount-badge {
  background: #dc2626;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  position: absolute;
  top: 8px;
  left: 8px;
}
```

### User Avatar (logged-in header)

```css
.user-avatar {
  background-color: #003052;  /* dark navy */
  color: #ffffff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}
```

---

## Loading States

**Skeleton screens** (react-loading-skeleton):
```css
.skeleton {
  --base-color: #ebebeb;
  --highlight-color: #f5f5f5;
  --animation-duration: 1.5s;
  background-color: var(--base-color);
  border-radius: 4px;
  /* Shimmer animation: left-to-right gradient sweep */
}
```

---

## Animations

| Name | Value |
|---|---|
| Fade in (content blocks) | `opacity: 0 → 1`, `1s ease-out` |
| Carousel slide | Splide.js default transition |
| Loading shimmer | `1.5s linear infinite` |
| Hover transitions | `transition: all 150–200ms ease` |

---

## Icons & Imagery Style

- **Icons:** Material Symbols (Google), default 24px, used as font ligatures
- **Photos:** Real people (doctors, patients), clean white or coloured backgrounds
- **Illustrations:** None visible — photo-led
- **Image treatment:** Rounded corners, often floating on coloured card backgrounds
- **Regulatory badges:** LegitScript, CQC — displayed at footer bottom

---

## Interaction States

| State | Treatment |
|---|---|
| Hover (nav links) | Underline appears |
| Hover (footer links) | Underline appears |
| Hover (buttons) | Slightly darker shade (`brightness(0.9)`) |
| Active (dashboard pill tab) | `#c5ffec` background fill |
| Focus (inputs) | Teal border + `rgba(0,224,188,0.2)` ring |
| Loading | Skeleton shimmer (`#ebebeb` → `#f5f5f5`) |

---

## Key Design Principles

1. **Trust first** — NHS branding associations, Trustpilot ratings prominently placed
2. **Colour-coded services** — each service category has its own colour identity
3. **Pill shapes everywhere** — buttons, tags, nav items all use heavy border-radius
4. **Two-tone typography** — Filson Pro for brand headings, Inter for functional UI
5. **Full-bleed hero** — hero carousel spans full viewport width
6. **Whitespace-heavy** — generous padding between sections keeps it clean
7. **Teal as hero accent** — `#00e0bc` is the single most distinctive brand colour
8. **Material Symbols for all icons** — no custom SVG icons in UI chrome
9. **Dashboard uses sidebar layout** — authenticated pages shift to 2-col layout

---

## Mobile App Theme

> Documented from the Pharmacy2U iOS/Android app (screenshots: NHS Prescriptions page + Order Tracking page). Uses the same brand tokens — colours, icons, fonts — as the web, adapted for a native-feeling mobile UI.

### App Page Structure

```
┌──────────────────────────────────┐
│  HEADER (fixed)                  │
│  [home]  [P2U Logo]  [🛒][👤]   │
├──────────────────────────────────┤
│  PAGE CONTENT (scrollable)       │
│  ┌──────────────────────────────┐│
│  │  Patient selector card       ││
│  └──────────────────────────────┘│
│  ┌──────────────────────────────┐│
│  │  Content card                ││
│  └──────────────────────────────┘│
│  ...                             │
├──────────────────────────────────┤
│  BOTTOM NAV BAR (fixed)          │
│  [Rx]  [Shop]  [Doctor]  [More]  │
└──────────────────────────────────┘
```

### App Colour Additions

These supplement the core palette for app-specific components:

| Token | Hex | Usage |
|---|---|---|
| `--app-bg` | `#f0f2f5` | Page background (light blue-grey) |
| `--app-card-bg` | `#ffffff` | All content cards |
| `--app-pill-bg` | `#c5ffec` | Category badge background (mint) |
| `--app-pill-text` | `#005c8f` | Category badge text (dark teal) |
| `--app-btn-find` | `#84daff` | "Find medication" CTA (light blue) |
| `--app-btn-text` | `#003052` | Button label on light-blue buttons |
| `--app-progress-done` | `#00e0bc` | Completed step: circle fill + line |
| `--app-progress-todo` | `#d1d5db` | Pending step: circle + line (grey) |
| `--app-border-accent` | `#00e0bc` | Notification card left border |
| `--app-icon-accent` | `#00e0bc` | Icon colour on teal notification cards |
| `--app-icon-muted` | `#6b7280` | Inactive tab icon colour |
| `--app-tab-active` | `#005c8f` | Active tab icon + label colour |
| `--app-tab-indicator` | `#00e0bc` | Active tab underline bar |

---

### App Header

```
┌──────────────────────────────────┐
│ [home_outlined]  [P2U Logo]  [shopping_basket] [person] │
└──────────────────────────────────┘
```

```css
.app-header {
  background-color: #ffffff;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 100;
}

.app-header .logo {
  /* Centred P2U SVG logo — same as web */
  height: 24px;
}

.app-header .icon-btn {
  color: #001b1c;
  font-size: 24px;   /* Material Symbol size */
  background: none;
  border: none;
  padding: 8px;
}
```

**Icons used:** `home` (left), `shopping_basket` + `person` (right)
Font: Material Symbols Outlined

---

### Bottom Navigation Bar

4 fixed tabs: **Prescriptions** (active), Shop, Online Doctor, More.

```
┌────────────────────────────────────────┐
│ ── active indicator (teal 2px bar)     │
│  [Rx icon]    [shop]  [doctor]  [more] │
│ Prescriptions  Shop  Online Dr   More  │
└────────────────────────────────────────┘
```

```css
.app-bottom-nav {
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 64px;
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: stretch;
}

.app-nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: Inter;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;           /* inactive */
  text-decoration: none;
  position: relative;
  padding-top: 4px;
}

.app-nav-tab.active {
  color: #005c8f;           /* active tab label + icon */
}

/* Active indicator bar at top of tab */
.app-nav-tab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background-color: #00e0bc;
  border-radius: 0 0 2px 2px;
}

.app-nav-tab .material-symbols-outlined {
  font-size: 24px;
}
```

**Tab labels & icons:**

| Tab | Icon | Notes |
|---|---|---|
| Prescriptions | `medication` | Active — real page |
| Shop | `storefront` | Dummy button |
| Online Doctor | `medical_services` | Dummy button |
| More | `more_horiz` | Dummy button |

---

### Patient Selector Card

Dropdown card shown at top of NHS Prescriptions screen, allowing switch between linked patients.

```
┌──────────────────────────────────────┐
│  [person icon]  John Smith           │
│                 NHS No: 123 456 7890 │
│                                 [v]  │
└──────────────────────────────────────┘
```

```css
.patient-selector {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.patient-selector .patient-icon {
  color: #005c8f;
  font-size: 28px;
}

.patient-selector .patient-name {
  font-family: Inter;
  font-size: 15px;
  font-weight: 600;
  color: #001b1c;
}

.patient-selector .patient-nhs {
  font-family: Inter;
  font-size: 12px;
  color: #6b7280;
}

.patient-selector .chevron {
  margin-left: auto;
  color: #6b7280;
  font-size: 20px;
}
```

**Icons:** `person` (left), `expand_more` (right chevron) — Material Symbols Outlined

---

### Category / Status Pill Badge

Used on order cards and headers to identify service category. Based on `#c5ffec` (mint) background with `#005c8f` text. Can be colour-coded per service.

```
[ NHS PRESCRIPTIONS ]   ← mint bg, teal text
[ ONLINE DOCTOR     ]   ← pink/rose variant
[ SHOP              ]   ← amber variant
```

```css
.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;        /* fully pill-shaped */
  font-family: Inter;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* NHS Prescriptions — mint */
.category-pill.prescriptions {
  background-color: #c5ffec;
  color: #005c8f;
}

/* Online Doctor — rose/pink (estimated) */
.category-pill.online-doctor {
  background-color: #fce7f3;
  color: #9d174d;
}

/* Shop — amber (estimated) */
.category-pill.shop {
  background-color: #fef3c7;
  color: #92400e;
}
```

---

### Content Card (app generic)

White rounded card on grey page background. Used for prescription items, order summaries, CTA rows.

```css
.app-card {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 16px;
  margin: 0 16px 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.app-card .card-title {
  font-family: Nunito, sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #001b1c;
  margin-bottom: 4px;
}

.app-card .card-subtitle {
  font-family: Inter;
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}
```

---

### "Find Medication" CTA Button

Full-width, light blue, pill-shaped button with a leading `add_box` icon. Used as the primary action on the NHS Prescriptions page.

```css
.btn-find-medication {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background-color: #84daff;
  color: #003052;
  font-family: Inter;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 99px;
  padding: 14px 20px;
  margin-top: 8px;
  cursor: pointer;
}

.btn-find-medication .material-symbols-outlined {
  font-size: 22px;
}
```

**Icon:** `add_box` — Material Symbols Outlined

---

### Order Tracking Progress Tracker

Horizontal step-tracker showing prescription order milestones. Completed steps use teal; pending steps use grey.

```
●────●────●────○────○
Rx   ✓   ✓   Dispensing  Delivery
```

```css
.progress-tracker {
  display: flex;
  align-items: center;
  padding: 16px 0;
  gap: 0;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  position: relative;
}

/* Connecting line before each step (except first) */
.progress-step + .progress-step::before {
  content: '';
  position: absolute;
  left: -50%;
  right: 50%;
  top: 10px;
  height: 2px;
  background-color: #d1d5db;  /* grey default */
}

.progress-step.done + .progress-step::before {
  background-color: #00e0bc;   /* teal when prev step done */
}

/* Step circle */
.progress-step .dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  background-color: #ffffff;
  z-index: 1;
}

.progress-step.done .dot {
  background-color: #00e0bc;
  border-color: #00e0bc;
  /* Optionally: white check icon inside */
}

.progress-step .step-label {
  font-family: Inter;
  font-size: 10px;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  white-space: nowrap;
}

.progress-step.done .step-label {
  color: #005c8f;
  font-weight: 600;
}
```

**Typical steps:** Prescription received → Ordered → Dispensing → Out for delivery → Delivered

---

### Status Notification Card

Teal left-accent card for important order status messages (e.g. "Your prescription is being processed"). Also used for alerts and action-required notices.

```
┌──────────────────────────────────────────┐
│ ║  [teal box icon]  Title here           │
│ ║  Supporting body text in grey          │
└──────────────────────────────────────────┘
  ↑ 3px teal left border
```

```css
.status-card {
  background-color: #ffffff;
  border-radius: 12px;
  border-left: 3px solid #00e0bc;
  padding: 14px 16px;
  margin: 0 16px 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.status-card .status-icon {
  color: #00e0bc;
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 1px;
}

.status-card .status-title {
  font-family: Inter;
  font-size: 14px;
  font-weight: 700;
  color: #001b1c;
  margin-bottom: 4px;
}

.status-card .status-body {
  font-family: Inter;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
```

**Icon used:** `inventory_2` or `inbox` — Material Symbols Outlined, teal coloured

---

### App Icon Usage Summary

All icons use **Material Symbols Outlined** at 24px, same as web:

| Context | Icon name |
|---|---|
| Home (header left) | `home` |
| Basket (header right) | `shopping_basket` |
| Account (header right) | `person` |
| Prescriptions tab | `medication` |
| Shop tab | `storefront` |
| Online Doctor tab | `medical_services` |
| More tab | `more_horiz` |
| Patient selector left | `person` |
| Chevron/dropdown | `expand_more` |
| Find medication CTA | `add_box` |
| Status notification | `inventory_2` |
| Prescription icon on card | `description` or `assignment` |

---

### App Typography Scale

Inherits web fonts. Mobile-specific sizes:

| Element | Size | Weight | Font |
|---|---|---|---|
| Page heading (H1) | 20–22px | 700 | Nunito |
| Card title | 15–16px | 700 | Nunito |
| Body / description | 13–14px | 400 | Inter |
| Tab label | 11px | 500 | Inter |
| Category pill | 11px | 700 | Inter |
| Step label | 10px | 500 | Inter |
| NHS / account sub-text | 12px | 400 | Inter |

---

### App Spacing

| Context | Value |
|---|---|
| Page horizontal padding | 16px |
| Card border-radius | 12–16px |
| Card margin-bottom | 12px |
| Header height | 56px |
| Bottom nav height | 64px |
| Card internal padding | 14–16px |
| Button vertical padding | 14px |
| Icon size | 24px |
| Progress dot size | 20px |
