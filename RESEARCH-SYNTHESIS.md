# PetSpa (Smarter Dog) — UX Research Synthesis

**Date:** 8 March 2026
**Method:** Heuristic analysis + codebase inspection (no primary user research conducted)
**Scope:** Booking flow (public), Dashboard, Calendar, Customers, Settings, AppointmentModal
**Important:** All findings below are **hypotheses**, not validated insights. They are framed as testable assumptions derived from code-level analysis, design critique, and design system audit — not from observing real users. Each hypothesis needs validation through user research before driving design decisions.

---

## Executive Summary

Analysis of the PetSpa codebase reveals a well-crafted salon management tool with strong brand identity and thoughtful operational UX (particularly the "Needs Attention" panel and progressive disclosure on the calendar). However, the application makes several assumptions about how staff and customers interact with the system that haven't been tested with real users. The most significant areas of uncertainty cluster around three themes: the public booking flow's conversion path, the staff's ability to maintain situational awareness during busy periods, and the accessibility of core rescheduling workflows.

This synthesis identifies **6 key themes**, each containing testable hypotheses and suggested research methods. The themes are ordered by estimated business impact.

---

## Theme 1: Booking Flow Conversion

**Prevalence:** Affects every public customer interaction
**Confidence:** Low — no conversion data or user observation available

### Hypothesis 1.1 — Auth wall placement harms conversion

The booking wizard places authentication (Step 2) between service selection (Step 1) and date/time selection (Step 3). This means a new customer who browses services and finds one they want is immediately asked to create an account before they can even check availability.

**Assumption being made:** Customers are willing to commit to creating an account before knowing whether their preferred date and time is available.

**Risk:** Users who are "just checking" availability bounce at the auth wall. The real-world analogy would be a salon receptionist demanding your name and phone number before telling you whether they have any openings — most people would hang up.

**What to test:**
- A/B test moving auth to Step 4 (after date/time + pet details, before confirmation)
- Measure drop-off rate at each wizard step
- Usability test: ask 5 customers to book an appointment and note where they hesitate

**Supporting evidence:** The booking page stores a `petspa_booking_token` in localStorage, meaning a returning customer skips auth entirely. This suggests the auth friction primarily affects first-time customers — exactly the users most likely to abandon.

### Hypothesis 1.2 — "Find first available" is a critical recovery path that fails quietly

When no slots are available for the selected date, the "Find first available" button iterates through the next 14 days of dates making sequential API calls. If all 14 days are full, the user sees a toast notification ("No appointment times are available in the next two weeks") and the UI remains unchanged.

**Assumption being made:** A toast message is sufficient to communicate "we're fully booked" and redirect the customer to an alternative action.

**Risk:** The toast disappears after a few seconds. The customer is left staring at the same date picker with no slots, unsure what to do next. There's no call-to-action (phone number, waitlist, alternative location) to recover the interaction.

**What to test:**
- Track how often "Find first available" returns zero results in production
- Test a persistent "fully booked" state with a phone number CTA vs. the current toast
- Interview salon staff: how often do customers call because online booking showed no availability?

### Hypothesis 1.3 — Step labels hidden on mobile cause uncertainty

The booking stepper uses `hidden sm:inline` for step labels. On mobile, customers see only numbered circles (1, 2, 3, 4, 5) without context. The current step is visually distinct, but future steps provide no hint of what's coming.

**Assumption being made:** Sequential numbers alone are enough for customers to feel confident about the booking process.

**Risk:** A customer at Step 2 (auth) doesn't know whether they'll need to provide pet medical history, vaccination records, or payment details in later steps. This uncertainty may cause some users to abandon rather than risk a lengthy process.

**What to test:**
- Mobile usability test: do users express uncertainty about what comes next?
- Compare completion rates with abbreviated labels ("Service → Login → Time → Pet → Done") vs. numbers only

---

## Theme 2: Operational Situational Awareness

**Prevalence:** Affects staff every working day
**Confidence:** Medium — the "Needs Attention" panel suggests awareness of this problem

### Hypothesis 2.1 — Dashboard stat cards don't signal urgency effectively

The four top-level stat cards (Today's Bookings, Live In Salon, Ready for Collection, Expected Revenue) share identical visual weight. A "Ready for Collection: 3" card looks the same as "Completed: 5" — even though the former requires immediate staff action (dogs waiting to be returned to owners) and the latter is purely informational.

**Assumption being made:** Staff will scan all four cards equally and mentally prioritise which ones need action.

**Risk:** During a busy day with 15+ appointments, staff glance at the dashboard for a quick status update. If the card that needs action looks the same as the cards that don't, the "ready for collection" dogs wait longer — causing customer complaints and kennel congestion.

**What to test:**
- Contextual inquiry: observe staff using the dashboard during peak hours — which cards do they look at first?
- Test a variant where the "Ready for Collection" card gets a warm accent border or background when count > 0
- Survey staff: "When you open the dashboard, what are you usually looking for?"

### Hypothesis 2.2 — Calendar sidebar flat list slows triage

The calendar's right sidebar lists all appointments for the selected day in a flat chronological list. Staff must visually scan the entire list to find appointments that need attention (pending approval, late arrivals, ready for collection).

**Assumption being made:** Chronological ordering is the most useful view for daily appointment management.

**Risk:** A groomer mid-shift wants to know "which dogs are waiting?" — they don't care about the 9 AM appointment that's already completed. The flat list forces them to scan past irrelevant entries. The filter buttons (All / Needs Action / In Salon / Done) help, but require an extra click and mental model switch.

**What to test:**
- Task analysis: ask staff "show me which appointments need attention right now" and time how long it takes with current UI vs. a grouped-by-status variant
- Check filter usage analytics: do staff actually use the sidebar filter buttons, or do they leave it on "All"?

### Hypothesis 2.3 — Late arrival detection logic may not match salon reality

The Dashboard's attention system flags appointments as "late" if their scheduled time was more than 15 minutes ago and they haven't been checked in. This is hardcoded at `now.getTime() - 15 * 60 * 1000`.

**Assumption being made:** 15 minutes is the right threshold for flagging a late arrival across all service types.

**Risk:** A full groom (2+ hours) starting 15 minutes late may still be fine operationally, while a quick nail trim starting 10 minutes late might already be causing a cascade of delays. A single threshold may generate false positives (unnecessary alerts) or false negatives (missing genuinely problematic delays).

**What to test:**
- Interview groomers: "When does a late arrival actually become a problem? Does it depend on the service type?"
- Analyse historical data: what's the actual distribution of arrival times vs. scheduled times?

---

## Theme 3: Rescheduling and Calendar Interaction

**Prevalence:** Core workflow — estimated multiple times per day
**Confidence:** Medium — drag-and-drop is an established pattern, but keyboard-only access is a known gap

### Hypothesis 3.1 — Drag-and-drop rescheduling is the right primary interaction

The calendar uses mouse-based drag-and-drop with 30-minute grid snapping to reschedule appointments. The drag handler calculates the target hour from the drop position (`Math.floor(y / 96) + 8`).

**Assumption being made:** Staff primarily use mice/trackpads and find drag-and-drop intuitive for time-based rescheduling.

**Risk:** If staff are using tablets or touchscreens in the salon (near the grooming stations, at reception), drag-and-drop may be unreliable on touch devices. Additionally, the 30-minute snap grid means rescheduling to 10:15 AM isn't possible via drag — only through the modal.

**What to test:**
- Device audit: what devices do salon staff actually use? Desktop, tablet, or phone?
- Observation: do staff use drag-and-drop in practice, or do they open the appointment modal to change times?
- If tablets are common: test touch-based rescheduling accuracy

### Hypothesis 3.2 — No keyboard rescheduling excludes some staff

There is no keyboard-accessible way to move an appointment to a different time slot. The only alternative is opening the AppointmentModal and manually changing the date/time fields.

**Assumption being made:** All salon staff can use a mouse/trackpad comfortably.

**Risk:** Staff with motor impairments, temporary injuries, or strong keyboard-navigation preferences cannot use the primary rescheduling workflow. The modal workaround is functional but significantly slower (open modal → find date field → change value → save).

**What to test:**
- Accessibility audit with keyboard-only navigation: can all core tasks be completed?
- Staff survey: does anyone currently find rescheduling difficult?

---

## Theme 4: Error Handling and Trust

**Prevalence:** Occasional but high-impact moments
**Confidence:** Low — error states are rarely tested but critical to trust

### Hypothesis 4.1 — `alert()` for "Forgot password?" damages trust at the gate

The login page's "Forgot password?" link triggers a raw browser `alert()` with the text "Please contact the salon to reset your password." This is the first interaction a returning customer has with the system when they can't remember their password.

**Assumption being made:** Customers will accept a browser alert as a reasonable response and take the action (calling the salon).

**Risk:** Browser alerts look like errors or security warnings. A customer who sees one may assume the site is broken or untrustworthy, and choose to call for the entire booking rather than use the online system at all.

**What to test:**
- Replace with an inline styled message and track whether "forgot password" interactions increase
- Interview customers who've called the salon: did any of them try to book online first?

### Hypothesis 4.2 — Toast-only error feedback may be missed

The app consistently uses `toast.error()` for error communication (failed API calls, validation errors, booking conflicts). Toasts auto-dismiss after a few seconds and appear in a corner of the screen.

**Assumption being made:** Users are watching the toast area when errors occur and can read/process the message before it disappears.

**Risk:** During a busy salon day, a groomer updating an appointment status might click a button, glance away at the dog they're working on, and miss the error toast entirely. They'd assume the action succeeded when it didn't.

**What to test:**
- Track toast display duration vs. interaction rate (do users click/dismiss, or do toasts expire naturally?)
- Test persistent inline errors for critical operations (status changes, appointment saves) vs. toasts
- Observe: do staff notice toast messages during multitasking?

### Hypothesis 4.3 — Non-functional notification bell erodes feature trust

The header Bell icon shows an unread count badge but clicking it produces "Notifications coming soon!" This creates a broken promise: the UI signals "you have notifications" but can't deliver on that signal.

**Assumption being made:** Users will understand this is a work-in-progress feature and not be confused.

**Risk:** After encountering a non-functional UI element, users may lose confidence in other elements. "If the notification bell doesn't work, does the appointment status actually update?" This is a small trust erosion with potentially outsized impact.

**What to test:**
- Remove the bell icon and count badge entirely; measure whether staff report missing it
- If keeping: implement even a minimal notification panel (recent status changes, new bookings today)

---

## Theme 5: Customer Data Management

**Prevalence:** Used multiple times daily for lookups; occasionally for data entry
**Confidence:** Low — pagination and search patterns assumed, not observed

### Hypothesis 5.1 — "Load More" pagination doesn't match lookup behaviour

The Customers page loads 50 records at a time with a "Load More" button. There's no way to jump to a specific page, search by partial name in real-time, or see total customer count upfront.

**Assumption being made:** Staff will either find customers in the first 50 results or use the search bar — they don't need to browse the full list.

**Risk:** If staff need to find "that customer who came in last month, their name was something like Smith or Schmidt," they might scroll through Load More repeatedly rather than using search. The search bar does client-side filtering on loaded pages, meaning it can only find customers in pages already loaded into memory.

**What to test:**
- Analytics: how often is "Load More" clicked? How deep do users go?
- Does the search bar satisfy most lookup needs, or do staff resort to scrolling?
- Would server-side search with typeahead be more effective?

### Hypothesis 5.2 — Emergency contact visibility assumption

Emergency contact information (name, phone, relationship) is displayed in a highlighted warning-light card within the customer details panel. This is shown alongside general customer info.

**Assumption being made:** Emergency contacts are important enough to highlight but not so critical that they need to be on the main appointment view.

**Risk:** In a genuine emergency (dog has an allergic reaction during grooming), the groomer needs to contact the owner immediately. If the emergency contact is only visible in the customer details panel (not on the appointment card or in-progress view), there's an extra navigation step during a time-critical moment.

**What to test:**
- Scenario test: "A dog is having a reaction. Find the owner's emergency contact." Time the task.
- Staff interview: have you ever needed an emergency contact during a groom? Where did you look?

---

## Theme 6: Design System and Visual Consistency

**Prevalence:** Pervasive — affects every screen
**Confidence:** High — directly observed in code, but user impact is uncertain

### Hypothesis 6.1 — Colour-only status encoding is insufficient

Calendar appointment blocks use colour alone to communicate status (teal = confirmed, gold = pending, coral = cancelled). The Dashboard adds text labels, but the calendar grid relies primarily on colour.

**Assumption being made:** Staff can reliably distinguish between 6+ status colours, including under varying lighting conditions in a salon environment.

**Risk:** Salon lighting may include fluorescent overhead lights, natural light variation through the day, and wet/steamy conditions near washing stations. Colours that look distinct on a developer's monitor may be harder to differentiate in a real salon. Additionally, roughly 8% of men have some form of colour vision deficiency.

**What to test:**
- View the calendar under simulated colour vision deficiency (protanopia, deuteranopia)
- Add icons or text labels to calendar blocks alongside colour
- Staff survey: "Can you always tell at a glance what status an appointment is in on the calendar?"

### Hypothesis 6.2 — Three-font system may not render consistently

The app uses Quicksand (headings), Montserrat (body), and Caveat (accents) — all loaded from Google Fonts. If any font fails to load, the fallback stack is generic (`sans-serif`, `cursive`).

**Assumption being made:** Google Fonts will always load reliably on the devices and networks used by the salon.

**Risk:** If the salon's internet is slow or intermittent (common in small businesses), font loading may fail silently. Quicksand and Montserrat falling back to system sans-serif would look acceptable but lose brand personality. Caveat falling back to `cursive` could produce wildly different results depending on the OS (Comic Sans on Windows, Snell Roundhand on macOS).

**What to test:**
- Test the app with Google Fonts blocked — does it still look professional?
- Consider self-hosting the font files to eliminate the external dependency

---

## Insights → Opportunities Matrix

| Insight | User Impact | Business Impact | Effort to Validate | Research Method |
|---------|-------------|-----------------|--------------------|--------------------|
| Auth wall before availability check | High (customer) | High (conversion) | Low | A/B test step order |
| "Find first available" dead end | Medium (customer) | Medium (lost bookings) | Low | Production analytics |
| Stat cards don't signal urgency | Medium (staff) | Medium (service delays) | Low | 5-min observation study |
| Calendar sidebar flat list | Medium (staff) | Low (slower triage) | Medium | Task timing comparison |
| 15-min late threshold assumption | Low (staff) | Medium (false alerts) | Medium | Data analysis + interviews |
| Drag-and-drop device mismatch | High (staff) | High (if tablets used) | Low | Device audit |
| No keyboard rescheduling | Low (most staff) | Low (unless required) | Low | Accessibility audit |
| `alert()` for forgot password | Medium (customer) | Medium (trust) | Low | Replace and measure |
| Toast-only error feedback | Medium (staff) | High (silent failures) | Medium | Observation study |
| Non-functional notification bell | Low (staff) | Low (trust erosion) | Low | Remove and survey |
| Load More vs. search behaviour | Low (staff) | Low (time cost) | Medium | Usage analytics |
| Emergency contact visibility | Low (frequency) | High (severity) | Low | Scenario task test |
| Colour-only status encoding | Medium (staff) | Medium (misreads) | Low | CVD simulation |
| Font loading resilience | Low (usually) | Low (brand) | Low | Offline test |

---

## Recommended Research Plan

### Phase 1 — Quick wins (1-2 days, no recruitment needed)

1. **Production analytics setup:** Instrument the booking wizard to track step-by-step drop-off rates. Add event tracking to "Find first available," "Load More," and sidebar filter buttons.
2. **Device audit:** Ask salon staff what devices they use. This single data point shapes Themes 3 and 5 entirely.
3. **CVD simulation:** Run the calendar through a colour blindness simulator. Takes 10 minutes and validates or invalidates Hypothesis 6.1.
4. **Offline font test:** Block Google Fonts and check the app still looks professional. Another 10-minute test.

### Phase 2 — Staff observation (1 day on-site)

5. **Contextual inquiry:** Spend half a day in the salon watching staff use the system during a normal working day. Focus on: which dashboard elements do they look at first? How do they find information they need? Do they use drag-and-drop? Where do they get stuck?
6. **Task timing:** Give staff 5 quick tasks ("find the next appointment that needs attention," "reschedule the 2 PM booking to 3 PM," "find Mrs. Smith's emergency contact") and time each one.

### Phase 3 — Customer validation (1 week)

7. **Booking flow A/B test:** If analytics from Phase 1 show significant drop-off at the auth step, test moving auth later in the flow.
8. **5-customer usability test:** Remote or in-person, ask 5 customers to book an appointment using the online system. Note where they pause, express confusion, or abandon.

---

## Questions for Further Research

1. What percentage of bookings come through the online system vs. phone/WhatsApp/walk-in? If online booking is a small fraction, the conversion optimisation hypotheses in Theme 1 may be lower priority than the staff efficiency hypotheses in Theme 2.
2. How many customers does a typical salon serve? If the customer count is under 200, the pagination hypothesis (5.1) is irrelevant. If it's 2,000+, it becomes critical.
3. Does the salon use the system on a dedicated terminal, shared computer, tablet, or phone? This shapes every interaction design decision.
4. How many staff members use the system simultaneously? If it's one receptionist, the Calendar view optimisation is less urgent. If 3+ groomers each check their own schedule, it's essential.
5. What's the actual no-show / late arrival rate? If it's under 5%, the late-arrival detection (Hypothesis 2.3) may be over-engineered. If it's 15%+, it's critically important.

---

## Methodology Notes

This synthesis was produced through **code-level heuristic analysis**, not primary user research. The method involved:

- Reading all React component source code for the application's major pages (BookingPage, Dashboard, Calendar, Customers, Settings, AppointmentModal, Sidebar, Header, Login)
- Analysing the Tailwind CSS theme configuration and design token system
- Reviewing a prior design critique (DESIGN-CRITIQUE.md) and design system audit (DESIGN-SYSTEM.md)
- Applying Nielsen's 10 usability heuristics, WCAG 2.1 AA guidelines, and common e-commerce conversion patterns

**Limitations:**
- No real users were observed or interviewed
- No analytics data was available
- No A/B test results exist
- The reviewer could not interact with the running application (screenshots were not available)
- All "user behaviour" claims are predictions based on established UX patterns, not observations
- Business context (salon size, booking volume, staff count) was not available

**Confidence calibration:** Treat every finding as a hypothesis to be validated, not a confirmed insight. The value of this document is in structuring the *questions* to ask, not in providing *answers*.
