# PetSpa (Smarter Dog) — UX/UI Design Critique

**Date:** 6 March 2026
**Reviewer:** Claude (Design Critique)
**Method:** Code-based review of React components, Tailwind theme, and page structure
**Scope:** All major screens — Login, Dashboard, Calendar, Customers, Booking (public), Sidebar, Header

---

## 1. First Impression

The app makes a strong first impression. The purple sidebar paired with a warm off-white surface (`#FAF9F6`) and teal brand accents creates a friendly, professional aesthetic that suits a pet grooming salon. The font choices — Quicksand for headings, Montserrat for body — are playful without sacrificing readability. The "Come scruffy. Leave gorgeous." tagline in Caveat on the login page is a lovely personality touch.

**What draws the eye:** The deep purple sidebar dominates the left edge, anchoring navigation clearly. On the Dashboard, the four stat cards pull attention immediately. The brand feels cohesive and intentional — this doesn't look like a generic template.

**Emotional reaction:** Warm, trustworthy, approachable. It feels like a business that takes care of animals.

**Is the purpose clear?** Yes. Between the Dog icon, "Smarter Dog / Grooming Salon" branding, and appointment-centric Dashboard, the domain is unmistakable within seconds.

---

## 2. Usability Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U1 | **Notification bell is non-functional** | Medium | The Bell button in the Header renders a badge count but has no `onClick` handler — clicking it does nothing. Users see the unread indicator but can't act on it, which erodes trust in the UI. |
| U2 | **No "Forgot Password" flow on Login** | Medium | The Login page has email/password fields and a sign-in button, but no way to recover a forgotten password. For a staff-facing tool this is a basic expectation. |
| U3 | **Booking wizard forces auth before browsing services** | Medium | The public BookingPage requires login/registration as Step 1 before showing any services. Customers can't see what's available or how much it costs without creating an account first. This is a known conversion killer — service browsing should come first. |
| U4 | **Load More pagination on Customers** | Low | The Customers page uses a "Load More" button (50 at a time) rather than proper pagination with page numbers. For a salon with hundreds of customers, there's no way to jump to a specific range or know how many records exist in total. |
| U5 | **Calendar lacks month/day view toggle** | Low | The Calendar only offers a weekly view. Staff who want a quick month-level overview or a focused single-day view have no option. Most calendar UIs offer at least week + day views. |
| U6 | **No empty state on Dashboard** | Low | If there are no appointments for the day, the Dashboard renders stat cards with zeros but the schedule section isn't clearly communicating "nothing scheduled." A friendly empty state illustration would help. |
| U7 | **Search results lack keyboard navigation** | Low | The Header search dropdown supports `Escape` to close and `/` to focus, which is great. But once results appear, there's no arrow-key navigation or `Enter` to select — users must reach for the mouse. |
| U8 | **Booking date picker horizontal scroll isn't obvious** | Low | The 14-day date picker in the booking wizard uses `overflow-x-auto` but has no scroll indicators (arrows or fade edges). On narrower screens, users may not realize more dates are available off-screen. |

---

## 3. Visual Hierarchy

**Reading order is generally strong.** Each page uses a clear pattern: page title → summary cards → main content area. The Dashboard's four stat cards at the top effectively front-load the most important daily metrics (bookings count, dogs in salon, ready for collection, revenue).

**Areas for improvement:**

The **service cards on the Booking page** pack a lot of information (name, description, category badge, price, duration, deposit) into a relatively small card. The price/duration chips at the bottom use a `bg-slate-50` background that blends into the card — these key decision-making details (cost, time) should be more visually prominent. Consider making the price larger or using brand color to highlight it.

The **Customer detail modal** is information-dense. Contact info, emergency contact, notes, pets (each with behavioral notes and vaccinations), and full appointment history all appear in one scrollable modal. This would benefit from tabs or collapsible sections to reduce cognitive load.

**Typography hierarchy is well-executed.** Headings in Quicksand at varied weights create clear section breaks. The use of `tracking-[0.2em]` uppercase labels for metadata categories ("BOOKING ACCOUNT", "SELECTED SERVICE") is a nice pattern that works consistently across pages.

**Whitespace** is used generously and appropriately. The `max-w-7xl` container with responsive padding prevents content from stretching too wide. Card spacing is consistent. One exception: the Sidebar navigation items could use slightly more vertical padding (currently `py-2.5`) — on a touch device, these are borderline for comfortable tap targets.

---

## 4. Consistency

**Color usage is mostly consistent** but has a few drift points:

The Login page CTA uses `bg-accent` (green `#00D94A`), while the Booking page buttons use the default Button component (which doesn't specify a color override, suggesting it falls through to a default). The Dashboard uses a mix of `bg-brand-600` and `bg-accent` for action buttons. It would be clearer if there were a single, predictable CTA color throughout the app.

**Border radius values** are inconsistent across the app. The Login card uses `rounded-3xl`, service cards use `rounded-xl`, the search dropdown uses `rounded-2xl`, and basic form inputs use `rounded-md`. While some variation is fine for visual interest, the Login page's extremely rounded card feels like it belongs to a different design system than the rest of the app.

**Status badge patterns** are well-designed and consistent. The colored dots and badges on the Dashboard (confirmed = teal, pending = gold, in-salon = sky, completed = grey, cancelled = coral) form a clear, learnable system that carries over into the Calendar view.

**Component patterns** are consistent. Cards, form labels, buttons, and modals follow predictable structures. The `text-sm font-medium text-slate-700` label pattern is used uniformly across Login, Booking, and Customer forms.

**Icon usage** is consistent — Lucide icons throughout, properly sized (`h-5 w-5` for navigation, `h-3.5 w-3.5` for inline metadata).

---

## 5. Accessibility

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| A1 | **Color contrast: accent green on white** | High | The accent green (`#00D94A`) on white backgrounds likely fails WCAG AA for normal-sized text. This is used on the Login CTA button text-on-green and various success indicators. The green is vivid but light enough to be problematic. |
| A2 | **Color contrast: white text on purple sidebar** | Medium | The sidebar uses `text-white/70` and `text-white/50` for inactive navigation items against `#2D004B`. The `/50` opacity variant (roughly 50% white on very dark purple) likely passes, but should be verified — especially the `text-white/40` on the server status text at the bottom. |
| A3 | **No focus-visible styles defined** | Medium | The global CSS doesn't define custom `:focus-visible` styles. While the textarea in the Booking pet-details step has a `focus-visible:ring-2` class, this doesn't appear to be applied consistently across all interactive elements. Keyboard users may have difficulty tracking focus. |
| A4 | **Booking progress step labels hidden on mobile** | Low | The booking wizard step labels use `hidden sm:inline`, meaning mobile users only see numbered circles with no text. While the numbers are sequential, users lose context about what each step involves. |
| A5 | **Search results lack ARIA roles** | Low | The search dropdown in the Header doesn't use `role="listbox"` or `role="option"` patterns, and results aren't connected to the input via `aria-controls`. Screen reader users would have no awareness of the dropdown appearing. |
| A6 | **Drag-and-drop calendar has no keyboard alternative** | Medium | The Calendar's appointment rescheduling relies entirely on mouse-based drag-and-drop with no keyboard-accessible alternative for moving appointments between time slots. |

---

## 6. What Works Well

**The booking wizard flow is thoughtfully designed.** The progress indicator with completed checkmarks, the "Find first available" fallback when no slots exist, the confirmation card with a purple header summarising the booking — these are polished touches that show attention to the customer journey. The deposit handling with clear orange callouts is particularly well done.

**The Dashboard "Needs Attention" panel is excellent UX.** Instead of making staff hunt for issues, it proactively surfaces late arrivals, pending approvals, and dogs ready for pickup. This is the kind of feature that shows deep understanding of the operational workflow.

**Global search is well-implemented.** The debounced API call, categorised results (customers/pets/appointments), click-through navigation, and the `/` keyboard shortcut all combine for a snappy, power-user-friendly experience.

**The role-based navigation system is clean.** Filtering navigation items by `ROLE_LEVEL` is simple, predictable, and means each user type sees only what's relevant to them without complex permission UI.

**Server health indicator in the sidebar** is a subtle but thoughtful addition — staff immediately know if the backend is down without having to discover it through a failed action.

**The brand palette is cohesive and distinctive.** The teal/purple/coral/gold/sage system gives the app personality without feeling garish. The warm surface color `#FAF9F6` is a better choice than pure white for a salon environment.

---

## 7. Priority Recommendations

**P0 — Fix now:**

Move service browsing before authentication in the public booking flow. Let customers see services, prices, and availability before asking them to create an account. This single change will have the biggest impact on booking conversion rates.

**P1 — Address soon:**

Audit and fix color contrast ratios, particularly the accent green CTA buttons and the sidebar's lower-opacity text. Run the palette through a WCAG contrast checker and adjust where needed — even small tweaks (darkening the green to `#00B83F` or similar) can fix contrast without changing the brand feel.

Add a functioning notification panel or remove the bell icon. A non-functional UI element that shows a count but does nothing damages user trust more than having no icon at all.

**P2 — Plan for next iteration:**

Add keyboard navigation to the search results dropdown (arrow keys + Enter to select). Provide a keyboard-accessible alternative for calendar drag-and-drop rescheduling. Add ARIA roles and `aria-controls` to the search component.

Consider breaking the Customer detail modal into tabbed sections (Overview, Pets, History) to reduce the scroll depth and cognitive load.

Add scroll affordance indicators (fade edges or arrow buttons) to the booking date picker on mobile.

**P3 — Polish:**

Standardise border-radius values across the app. Pick two or three radius tokens (`rounded-lg` for small elements, `rounded-xl` for cards, `rounded-2xl` for modals) and apply them uniformly.

Add a "Forgot password?" link to the Login page. Add a friendly empty-state illustration for the Dashboard when there are no bookings.

Unify CTA button colours — pick one primary action colour (the brand teal `brand-600` or the accent green) and use it consistently for all primary actions across both staff and public-facing pages.
