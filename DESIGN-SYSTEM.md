# PetSpa Design System

> Smarter Dog Grooming — Design System Reference
> Last audited: 7 March 2026

---

## Design System Audit

### Summary

**Components reviewed:** 12 | **Issues found:** 18 | **Score:** 64/100

The PetSpa codebase has a solid foundation — a well-defined `@theme` token set in `index.css`, a consistent component library in `src/components/ui/`, and strong brand typography. However, token adoption across page-level components is inconsistent, with 461 instances of raw `slate-*` Tailwind classes versus 182 instances of brand tokens. Several UI components still use `brand-500` for focus rings instead of the standardised `brand-600`, and there are 40+ instances of raw Tailwind colours (`amber-*`, `orange-*`, `red-*`) that should map to semantic tokens.

### Naming Consistency

| Issue | Components | Recommendation |
|-------|------------|----------------|
| Focus ring split: `brand-500` vs `brand-600` | Textarea, Dialog close, CustomerModal, FormsManager, BookingPage | Standardise all to `ring-brand-600` |
| Border-radius mix: `rounded-md` across app | DropdownMenu, AppointmentStatusBar, PaymentPanel, FormsManager, CustomerModal | Use `rounded-xl` for inputs, `rounded-lg` for containers, `rounded-full` for pills/buttons |
| Raw Tailwind colours for status semantics | Dashboard, Customers, BookingPage, PaymentPanel, FormsManager, ReportsPage | Map `amber-*` → `gold-*`, `orange-*` → `coral-*` or new `warning-*` token |
| Hardcoded hex in source files | 4 unique hex values (`#333`, `#999`, `#666`, `#fff`) | Replace with `slate-*` or `brand-*` tokens |
| Arbitrary text sizes: `text-[10px]`, `text-[11px]`, `text-[8px]`, `text-[9px]` | Calendar, BookingPage, MessagingPage, ReportsPage, PaymentPanel, FormsManager | Define `--text-2xs: 10px` and `--text-3xs: 8px` tokens |

### Token Coverage

| Category | Defined Tokens | Hardcoded Values Found | Coverage |
|----------|---------------|----------------------|----------|
| **Colours** | 20 tokens (brand-50–900, accent, coral, sky, gold, sage, purple, surface) | 461 raw `slate-*` + 40 raw `amber/orange/red/green` + 4 hex values | ~30% |
| **Typography** | 3 font families (heading, body, accent) | 0 hardcoded font families | 100% |
| **Spacing** | 0 custom tokens (uses Tailwind defaults) | N/A — Tailwind handles this well | OK |
| **Border Radius** | 0 custom tokens | 4 different radii used inconsistently | 0% |
| **Shadows** | 0 custom tokens | 4 shadow levels used (`sm`, `md`, `lg`, `xl`) | 0% |
| **Focus Rings** | 0 custom tokens | 2 competing values (`brand-500`, `brand-600`) | 0% |

### Component Completeness

| Component | States | Variants | Consistency | Score |
|-----------|--------|----------|-------------|-------|
| **Button** | ✅ hover, focus, disabled | ✅ 6 variants, 4 sizes | ✅ | 10/10 |
| **Input** | ✅ focus, disabled, placeholder | ⚠️ 1 variant | ✅ | 8/10 |
| **Textarea** | ✅ focus, disabled | ⚠️ 1 variant | ❌ focus ring is `brand-500` | 6/10 |
| **Badge** | ✅ hover, focus | ✅ 4 variants | ✅ | 9/10 |
| **Card** | ⚠️ no hover/focus | ⚠️ 1 variant | ✅ | 7/10 |
| **Dialog** | ✅ open/close animation | ⚠️ 1 variant | ❌ close btn ring `brand-500` | 7/10 |
| **DropdownMenu** | ✅ focus, disabled, open/close | ✅ 3 item types | ❌ uses `slate-*` not `brand-*` | 5/10 |
| **Avatar** | ❌ no interactive states | ❌ no size variants | ⚠️ | 4/10 |
| **Label** | ⚠️ peer-disabled only | ❌ 1 variant | ✅ | 5/10 |
| **Skeleton** | ✅ pulse animation | ✅ 6 layout presets | ✅ | 9/10 |
| **Table** | ✅ hover, selected | ⚠️ 1 variant | ⚠️ uses `slate-*` | 6/10 |
| **FieldError** | N/A | N/A | ✅ uses `coral` token | 8/10 |

### Priority Actions

1. **P0 — Standardise focus rings** → Fix 6 files still using `brand-500` or `slate-950` instead of `brand-600`
2. **P0 — Define semantic colour tokens** → Add `warning`, `error`, `success`, `info` semantic aliases to `@theme`
3. **P1 — Migrate raw colours** → Replace 40+ instances of `amber-*`, `orange-*`, `red-*`, `green-*` with semantic tokens
4. **P1 — Create missing components** → Add Select, Tooltip, Spinner, and Tabs to `ui/`
5. **P2 — Define radius tokens** → Add `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full` to `@theme`
6. **P2 — Define text size tokens** → Add `--text-2xs: 10px` and `--text-3xs: 8px` for micro-typography
7. **P3 — Add size variants** → Extend Avatar and Input with `sm`, `md`, `lg` size props

---

## Component Documentation

### Button

**Description:** Primary interactive element for actions. Always fully rounded (`rounded-full`). The most complete component in the system.

**Variants:**

| Variant | Use When | Visual |
|---------|----------|--------|
| `default` | Primary actions (Save, Confirm) | Brand-600 bg, white text |
| `destructive` | Delete, cancel actions | Coral bg, white text |
| `outline` | Secondary actions | White bg, brand border |
| `secondary` | Tertiary actions | Brand-50 bg, brand text |
| `ghost` | Toolbar buttons, minimal actions | Transparent, hover reveals bg |
| `link` | Inline text links | Underline on hover |

**Sizes:**

| Size | Dimensions | Use When |
|------|-----------|----------|
| `default` | h-10, px-5 | Most buttons |
| `sm` | h-9, px-4 | Compact UIs, table rows |
| `lg` | h-11, px-8 | Hero CTAs, full-width |
| `icon` | h-10, w-10 | Icon-only buttons |

**States:**

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Solid fill | — |
| Hover | Lighter/darker shade | Cursor pointer |
| Focus | `ring-2 ring-brand-600 ring-offset-2` | Keyboard accessible |
| Disabled | `opacity-50` | `pointer-events-none` |

**Accessibility:** Renders as `<button>`. Keyboard: Tab to focus, Enter/Space to activate. Focus ring is 2px brand-600 with 2px offset.

---

### Input

**Description:** Single-line text input. Uses `rounded-xl` and `border-brand-200`.

**Props:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | `"text"` | HTML input type |
| `className` | string | — | Merge additional classes via `cn()` |

**States:**

| State | Visual | Behavior |
|-------|--------|----------|
| Default | White bg, brand-200 border | — |
| Focus | `ring-2 ring-brand-600 ring-offset-2` | Blue ring appears |
| Disabled | `opacity-50` | `cursor-not-allowed` |
| Placeholder | `text-slate-400` | Italic-free, muted |

**Accessibility:** Standard `<input>`. Pair with `<Label>` using `htmlFor`. Focus ring meets WCAG 2.1 AA.

---

### Textarea

**Description:** Multi-line text input. Matches Input styling but currently has a focus ring inconsistency.

**Known Issue:** Focus ring uses `brand-500` — should be `brand-600` to match Input and Button.

**States:** Same as Input. Min-height: 80px.

---

### Badge

**Description:** Small status label, always `rounded-full` (pill shape).

**Variants:**

| Variant | Use When | Visual |
|---------|----------|--------|
| `default` | Active/primary status | Brand-600 bg, white text |
| `secondary` | Neutral status | Brand-50 bg, brand-700 text |
| `destructive` | Error/warning status | Coral bg, white text |
| `outline` | Subtle status | Transparent, brand-200 border |

**Accessibility:** Rendered as `<div>`. Has `focus:ring-2 ring-brand-600` for keyboard users.

---

### Card

**Description:** Container for grouped content. Uses `rounded-2xl` with `border-brand-100`.

**Sub-components:**

| Component | Element | Purpose |
|-----------|---------|---------|
| `Card` | `<div>` | Outer container |
| `CardHeader` | `<div>` | Title + description area |
| `CardTitle` | `<h3>` | Purple heading text |
| `CardDescription` | `<p>` | Muted slate-500 description |
| `CardContent` | `<div>` | Main content area |
| `CardFooter` | `<div>` | Action buttons row |

---

### Dialog

**Description:** Modal overlay for focused interactions. Uses Radix UI primitives. Content area is `rounded-2xl` on desktop.

**Sub-components:** DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose.

**Known Issue:** Close button focus ring uses `brand-500` — should be `brand-600`.

**Accessibility:** Focus trapped inside dialog. Escape to close. Overlay click to dismiss. Title announced via `aria-labelledby`.

---

### Dropdown Menu

**Description:** Context menu / action menu. Uses Radix UI primitives.

**Known Issue:** Entire component uses `slate-*` tokens instead of `brand-*`. Content uses `rounded-md` instead of `rounded-xl`. Items use `rounded-sm`.

---

### Avatar

**Description:** Circular user/pet image with text fallback.

**Missing:** No size variants (always 40×40). No interactive states. No loading state.

---

### Skeleton

**Description:** Loading placeholder with pulse animation. The best-structured component — includes 6 layout presets for Dashboard, Calendar, Services, Customers, card, and table row loading states.

---

### Table

**Description:** Data table with hover and selected row states.

**Known Issue:** Uses `slate-*` tokens for hover/selected rather than `brand-*`.

---

### FieldError

**Description:** Inline validation error message. Uses semantic `role="alert"` and `coral` colour token. Minimal and correct.

---

### Label

**Description:** Form label element. Minimal styling. Handles peer-disabled state.

---

## Extend — Recommended New Components

### 1. New Component: Select

**Problem:** 14 native `<select>` elements across the codebase with inconsistent styling. Some use `rounded-md`, others `rounded-xl`. Border colours vary between `slate-200` and `brand-200`.

**Existing Patterns:**

| Related Component | Similarity | Why It's Not Enough |
|-------------------|-----------|---------------------|
| Input | Same border/radius/focus pattern | No dropdown behavior |
| DropdownMenu | Has dropdown behavior | Too complex, different styling |

**Proposed Design:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `options` | `Array<{value, label}>` | — | Available choices |
| `value` | `string` | — | Controlled value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `placeholder` | `string` | `"Select..."` | Empty state text |
| `disabled` | `boolean` | `false` | Disabled state |

**Tokens Used:** `rounded-xl`, `border-brand-200`, `ring-brand-600`, `bg-white`, `text-slate-900`.

---

### 2. New Component: Spinner

**Problem:** No loading indicator exists. The app uses Skeleton for page-level loading but has no inline spinner for button loading states or async operations.

**Proposed Design:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Spinner diameter |
| `className` | `string` | — | Custom classes |

**Variants:** 3 sizes — `sm` (16px), `md` (24px), `lg` (32px). Uses `border-brand-200` track and `border-brand-600` indicator with CSS animation.

---

### 3. New Component: Tooltip

**Problem:** 8+ instances of `title="..."` attributes across the codebase. Native browser tooltips are unstyled and inaccessible.

**Proposed Design:** Radix UI `@radix-ui/react-tooltip` wrapper with `rounded-lg`, `bg-slate-900`, `text-white`, `text-xs`, `shadow-md`. Accessible via `role="tooltip"` and `aria-describedby`.

---

### 4. New Component: Tabs

**Problem:** AppointmentModal has a hand-rolled tab switcher (`bg-slate-100 p-1 rounded-lg` container with `rounded-md` buttons). This pattern should be extracted.

**Proposed Design:** Radix UI `@radix-ui/react-tabs` wrapper. Trigger uses `rounded-lg` container with `rounded-md` active indicator and `shadow-sm`. Uses `brand-600` for active state indicator colour.

---

### 5. New Tokens: Semantic Colours

**Problem:** Raw Tailwind colours are used for status semantics throughout the app. When the brand palette changes, these won't update.

**Proposed Additions to `@theme`:**

```css
/* ── Semantic Colours ── */
--color-warning:       var(--color-gold);
--color-warning-light: var(--color-gold-light);
--color-error:         var(--color-coral);
--color-error-light:   var(--color-coral-light);
--color-success:       var(--color-accent);
--color-success-light: #e8f5e9;
--color-info:          var(--color-sky);
--color-info-light:    var(--color-sky-light);
```

**Mapping guide:**

| Raw Tailwind | Semantic Token | Used For |
|-------------|---------------|----------|
| `bg-amber-100 text-amber-800` | `bg-warning-light text-purple` | Pending states, deposits |
| `bg-orange-100 text-orange-800` | `bg-warning-light text-purple` | Partial refunds, no-shows |
| `bg-red-50 text-red-800` | `bg-error-light text-error` | Error boundary, failures |
| `bg-emerald-400` | `bg-success` | Online indicator |
| `bg-teal-100 text-teal-800` | `bg-brand-50 text-brand-800` | Active/confirmed states |

---

### 6. New Tokens: Border Radius Scale

**Proposed Additions to `@theme`:**

```css
/* ── Radius Scale ── */
--radius-sm:   0.375rem;  /* 6px — dropdown items, small pills */
--radius-md:   0.5rem;    /* 8px — status bars, inline elements */
--radius-lg:   0.75rem;   /* 12px — containers, cards-within-cards */
--radius-xl:   1rem;      /* 16px — inputs, textareas */
--radius-2xl:  1.5rem;    /* 24px — cards, dialogs */
--radius-full: 9999px;    /* buttons, badges, avatars */
```

---

### 7. New Tokens: Micro-Typography

**Proposed Additions to `@theme`:**

```css
/* ── Micro Typography ── */
--text-2xs: 0.625rem;   /* 10px — status pills, timestamps */
--text-3xs: 0.5rem;     /* 8px — chart axis labels only */
```

---

## Remaining Inconsistencies to Fix

These files still need attention (not fixed in the design critique pass):

| File | Issue | Fix |
|------|-------|-----|
| `ui/textarea.tsx` | `ring-brand-500` | → `ring-brand-600` |
| `ui/dialog.tsx` | Close button `ring-brand-500` | → `ring-brand-600` |
| `CustomerModal.tsx` | Textarea `ring-brand-500`, `rounded-md`, `border-slate-200` | → `ring-brand-600`, `rounded-xl`, `border-brand-200` |
| `FormsManager.tsx` | Textarea `ring-brand-500`, `rounded-md`, `border-slate-200` | → `ring-brand-600`, `rounded-xl`, `border-brand-200` |
| `BookingPage.tsx` | Textarea `ring-brand-500`, `rounded-md`, `border-slate-200` | → `ring-brand-600`, `rounded-xl`, `border-brand-200` |
| `MessagingPage.tsx` | Two textareas `ring-slate-950`, `rounded-md`, `border-slate-200` | → `ring-brand-600`, `rounded-xl`, `border-brand-200` |
| `PaymentPanel.tsx` | Input `rounded-md`, `border-slate-200` | → `rounded-xl`, `border-brand-200` |
| `FormsManager.tsx` | Three inputs/selects `rounded-md`, `border-slate-200` | → `rounded-xl`, `border-brand-200` |
| `DropdownMenu.tsx` | Content `rounded-md`, items `rounded-sm` | → `rounded-lg`, `rounded-md` |
| `AppointmentStatusBar.tsx` | Warning button `bg-amber-500` | → `bg-warning` |
| `Sidebar.tsx` | Health dots `bg-emerald-400`, `bg-red-400`, `bg-yellow-400` | → `bg-success`, `bg-error`, `bg-warning` |
| `Customers.tsx` | Emergency contact section `bg-orange-50`, `border-orange-100` | → `bg-warning-light`, `border-warning` |
| `BookingPage.tsx` | Deposit display `bg-orange-50`, `text-orange-*` | → `bg-warning-light`, `text-warning` |
| `ErrorBoundary.tsx` | Uses `bg-red-50`, `border-red-200`, `text-red-*` | → `bg-error-light`, `border-error`, `text-error` |
