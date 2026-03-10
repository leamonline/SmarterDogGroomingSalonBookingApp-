# PetSpa (Smarter Dog) — UX/UI Design Critique

**Date:** 7 March 2026
**Reviewer:** Claude (Design Critique Skill)
**Method:** Code-based review of React components, Tailwind theme, and page structure
**Scope:** All major screens — Login, Dashboard, Calendar, Customers, Booking (public), Sidebar, Header, Settings, AppointmentModal

---

## 1. Overall Impression

The app creates a warm, professional first impression that immediately communicates its domain. The deep purple sidebar (`#2D004B`) paired with a warm off-white surface (`#FAF9F6`) and teal brand accents produces a distinctive, salon-appropriate aesthetic. The three-font system — Quicksand for headings, Montserrat for body, Caveat for accent text — is playful without sacrificing readability. The "Come scruffy. Leave gorgeous." tagline on the login page adds genuine personality.

Within two seconds of seeing the interface, the Dog icon, "Smarter Dog / Grooming Salon" branding, and appointment-centric Dashboard make the purpose unmistakable. The emotional register is warm, trustworthy, and approachable — exactly right for a business that takes care of animals.

---

## 2. What Works Well

**Brand identity is cohesive and distinctive.** The teal/purple/coral/gold/sage colour system gives every screen personality without feeling garish. Warm surface colour `#FAF9F6` is a better choice than pure white for a salon environment — it softens the entire interface.

**Status colour coding forms a learnable system.** Confirmed (teal), pending (gold), in-salon (sky), completed (grey), cancelled (coral), incident (red) — these carry consistently from Dashboard stat cards through the Calendar grid to the AppointmentModal status badges. Staff can internalise the system quickly.

**The Dashboard "Needs Attention" panel is excellent operational UX.** Instead of making staff hunt for issues, it proactively surfaces late arrivals, pending approvals, and dogs ready for pickup. This shows deep understanding of the day-to-day workflow and reduces cognitive load during busy periods.

**Progressive disclosure on the Calendar is well judged.** Appointment blocks that are too short to show full details gracefully degrade — showing just the pet name, then adding service and time as the block gets taller. This prevents the calendar from becoming an unreadable wall of text.

**Global search is thoughtfully implemented.** Debounced API call (300ms), categorised results (customers/pets/appointments), full ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-activedescendant`), keyboard navigation (arrow keys + Enter), and the `/` shortcut for power users. This is a genuinely well-built search component.

**The booking wizard stepper is clear and confidence-building.** Completed steps show checkmarks, the current step is highlighted, and future steps are dimmed. The five-step flow (Service → Auth → Date/Time → Pet Details → Confirm) puts service browsing first, which is the right conversion-optimised order.

---

## 3. Usability Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U1 | **"Forgot password?" uses `alert()`** | Medium | The Login page's "Forgot password?" button calls `alert('Please contact the salon to reset your password.')` — a raw browser alert. This feels broken and undermines the polished feel of the rest of the login experience. Even without a full reset flow, a styled inline message or modal would be more appropriate. |
| U2 | **No destructive-action confirmation** | Medium | Customer deletion (if available) and appointment cancellation don't appear to have confirmation dialogs. In a salon context where accidental deletion of customer records or appointment history could cause real business harm, a confirmation step ("Are you sure? This will remove all appointment history for this customer") is essential. |
| U3 | **Notification bell is non-functional** | Medium | The Bell icon in the Header shows an unread count badge but its click handler is `toast.info("Notifications coming soon!")`. Users see the visual indicator, try to act on it, and hit a dead end. A non-functional element that shows a count damages trust more than having no icon at all. Either implement a basic panel or remove the bell until it's ready. |
| U4 | **Settings selects are unstyled native elements** | Low | The Settings page uses native `<select>` elements with `rounded-md` for role dropdowns and schedule configuration. These look visually inconsistent with the `rounded-xl` Input components used everywhere else and break the polished salon-brand feel. |
| U5 | **"Find first available" fails silently** | Low | In the booking wizard, if no time slots are available for the selected date, the "Find first available" fallback attempts to locate one automatically. If the API returns no slots at all, the UI doesn't clearly explain what happened — the user just sees no change. A clear message ("No availability found in the next 14 days — please call the salon") would prevent confusion. |
| U6 | **Calendar lacks a keyboard alternative to drag-and-drop** | Medium | Appointment rescheduling relies entirely on mouse-based drag-and-drop with 30-minute grid snapping. There is no keyboard-accessible way to move an appointment to a different time slot. Staff using keyboard-only navigation or assistive technology cannot reschedule without opening the appointment modal and manually editing. |
| U7 | **Load More pagination on Customers** | Low | The Customers page uses a "Load More" button (50 at a time) rather than proper pagination with page numbers. For a salon with hundreds of customers, there's no way to jump to a specific range or know how many total records exist. |

---

## 4. Visual Hierarchy

**Page-level hierarchy is strong.** Each page follows a consistent pattern: page title → summary cards or filters → main content area. The Dashboard's four stat cards at the top effectively front-load the most important daily metrics (bookings count, dogs in salon, ready for collection, revenue).

**The Dashboard stat cards could better differentiate urgency.** Currently, all four cards share a similar visual weight. Cards representing items needing action (e.g. "Ready for Collection") might benefit from a subtle accent border or background tint to draw the eye when values are non-zero.

**The Calendar sidebar (appointment list) would benefit from grouping.** The sidebar lists all appointments for the selected day in a flat list. Grouping by status (In Progress → Checked In → Confirmed → Pending) would help staff quickly scan for what needs attention next.

**Card density varies across pages.** The Dashboard uses compact stat cards, the Services page uses spacious cards with descriptions and category badges, and the Customers page uses a dense table. While some variation is natural, the jump between very dense (customer table with small text) and very spacious (service cards with generous padding) can feel inconsistent.

**Typography hierarchy is well-executed throughout.** Headings in Quicksand at varied weights create clear section breaks. The `tracking-[0.2em]` uppercase labels for metadata categories ("BOOKING ACCOUNT", "SELECTED SERVICE") are a consistent, learnable pattern across pages. The CardTitle component's use of `font-heading font-semibold text-purple` maintains a cohesive look.

---

## 5. Consistency Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C1 | **Border radius values drift across the app** | Low | Login card: `rounded-2xl`. Service cards: `rounded-xl`. Search dropdown: `rounded-2xl`. Buttons: `rounded-full`. Inputs: `rounded-xl`. Cards (component): `rounded-2xl`. Native selects in Settings: `rounded-md`. While some variation serves hierarchy, the Login card and Settings selects feel like they belong to different design systems. Recommend standardising on 2-3 radius tokens. |
| C2 | **Focus ring colours are inconsistent** | Low | Button uses `ring-brand-600`. Input uses `ring-brand-500`. Inline textareas in AppointmentModal use `ring-slate-950`. These are all slightly different focus indicators for interactive elements in the same interface. Pick one focus ring colour and apply it everywhere. |
| C3 | **AppointmentModal heading patterns differ between modes** | Low | In view mode, section headings use `text-xs font-semibold text-slate-500 uppercase tracking-wider`. In edit mode, they switch to `font-medium text-slate-900 border-b pb-2`. These are the same conceptual element (section divider) rendered with completely different styles based on whether the modal is in view or edit mode. |
| C4 | **Raw Tailwind colours appear alongside design tokens** | Medium | The `STATUS_CONFIG` in AppointmentModal uses `bg-purple-100`, `bg-teal-100`, `bg-orange-100`, `bg-amber-100` — these are raw Tailwind palette values, not the app's design tokens (`bg-brand-*`, `bg-coral`, `bg-sage`, etc.). If the theme colours change, these won't update. Map status colours to design tokens. |
| C5 | **Not all page titles use `font-heading`** | Low | Most page titles use the Quicksand heading font via `font-heading`, but some secondary headings fall back to the default Montserrat body font. This is subtle but creates a slightly inconsistent feel across pages. |
| C6 | **CTA button colours vary** | Low | The Login page uses default Button (brand-600 teal), the Booking page uses default Button, but some Dashboard actions use `bg-accent` (green). When two different greens appear as primary actions across pages, users lose the learned association between colour and action type. Pick one primary CTA colour. |

---

## 6. Accessibility Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| A1 | **Accent green (`#00A63E`) on white may fail contrast** | High | The accent green is used for success indicators and some CTA elements. At `#00A63E` on white (`#FFFFFF`), the contrast ratio is approximately 3.6:1, which fails WCAG AA for normal-sized text (requires 4.5:1). Darken to approximately `#008A33` or use it only on large/bold text. |
| A2 | **Sidebar uses low-opacity white text** | Medium | Inactive navigation items use `text-white/70` on `#2D004B`. The server status text at the bottom uses `text-white/60`. The `/60` variant (60% opacity white on very dark purple) likely passes AA for large text but should be verified — and the even lighter `text-white/40` used for some metadata definitely needs checking. |
| A3 | **Status communicated by colour alone** | Medium | On the Calendar and Dashboard, appointment status is indicated primarily by background colour (teal for confirmed, gold for pending, etc.). While the Dashboard adds text labels, the Calendar grid relies heavily on colour blocks. Users with colour vision deficiency may struggle to distinguish statuses. Add a text label, icon, or pattern. |
| A4 | **Native `<select>` elements in Settings lack visible labels** | Low | Some select dropdowns in the Settings page (role selection, schedule configuration) rely on context from surrounding headings rather than having explicit `<label>` elements associated via `htmlFor`. Screen readers may not correctly announce the purpose of these controls. |
| A5 | **Calendar grid lacks ARIA landmarks** | Low | The weekly time grid doesn't use `role="grid"` or `role="gridcell"` patterns. The time slots and appointment blocks are `<div>` elements without semantic roles. Screen reader users would have difficulty understanding the calendar structure and navigating between slots. |
| A6 | **No keyboard alternative for drag-and-drop rescheduling** | Medium | (Same as U6) The Calendar's drag-and-drop appointment rescheduling has no keyboard equivalent. This is both a usability and accessibility issue — staff using keyboard navigation or assistive technology cannot reschedule via the calendar grid. |
| A7 | **Search combobox is well-implemented** | Positive | The Header search uses proper `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`, and `role="option"` patterns. Arrow key navigation, Enter to select, and Escape to close all work correctly. This is a model implementation that other components could learn from. |
| A8 | **Booking wizard step labels hidden on mobile** | Low | The booking stepper uses `hidden sm:inline` for step labels, meaning mobile users only see numbered circles. While the numbers are sequential, users lose context about what each step involves. Consider showing abbreviated labels or adding `aria-label` attributes. |

---

## 7. Priority Recommendations

**P0 — Fix now:**

1. **Fix accent green contrast.** Darken `#00A63E` to approximately `#008A33` or `#007A2F` for text usage. This fixes the highest-severity accessibility issue without changing the brand feel significantly. Alternatively, restrict the current green to large/bold text and use the darker shade for normal text.

**P1 — Address soon:**

2. **Replace the `alert()` on "Forgot password?"** with an inline styled message or a simple modal. Even "Please contact the salon at [phone number]" in a properly styled component would be a significant improvement.

3. **Either implement or remove the notification bell.** A bell icon with a count badge that does nothing is worse than no bell at all. If notifications aren't ready, remove the component entirely and add it back when functional.

4. **Map STATUS_CONFIG colours to design tokens.** Replace raw Tailwind values (`bg-purple-100`, `bg-teal-100`) with the app's own tokens (`bg-purple-light`, `bg-brand-100`). This prevents theme drift and makes future palette changes safe.

**P2 — Plan for next iteration:**

5. **Add a keyboard-accessible alternative for calendar rescheduling.** This could be a "Move to..." option in the appointment context menu, or arrow-key navigation within the grid with Enter to drop. This addresses both usability (U6) and accessibility (A6).

6. **Standardise border-radius and focus-ring tokens.** Pick three radius values (e.g. `rounded-lg` for small elements, `rounded-xl` for inputs/cards, `rounded-2xl` for modals) and one focus-ring colour. Apply uniformly. Replace native `<select>` elements in Settings with styled dropdown components.

**P3 — Polish:**

7. **Add status indicators beyond colour.** Small icons (checkmark for confirmed, clock for pending, paw for in-progress) alongside the colour blocks on the Calendar would help users with colour vision deficiency and speed up scanning for everyone.

---

## Summary

The PetSpa UI is a strong, characterful application that clearly reflects its domain. The brand identity, colour-coded status system, and operational workflow design (especially the "Needs Attention" panel and progressive calendar disclosure) show genuine care for the end users — salon staff running a busy day. The global search with full keyboard and ARIA support is a standout component.

The main areas for improvement are accessibility (accent green contrast, colour-only status indicators, keyboard alternatives for drag-and-drop) and consistency (border-radius tokens, focus-ring colours, design-token usage in STATUS_CONFIG). Most of these are targeted fixes rather than architectural changes, and the highest-impact improvements (contrast fix, removing dead notification bell, replacing the `alert()`) could each be addressed in under an hour.

The design fundamentals — layout structure, whitespace usage, typography hierarchy, and responsive foundations — are solid and provide a strong base for continued iteration.
