# Salon Queue Management System — Screens & Features

Design vocabulary: premium charcoal **#1F2937**, gold **#D4A017**, rounded cards, large readable text, high contrast. Labels must use a shared English/Gujarati translation file; do not hard-code English inside individual components. Provide useful loading, empty and error states.

## Screen 1 — Home (`/`)
**User and goal:** Customer checks the live queue and decides whether to join.

### Visible elements (top to bottom)
- Salon name, logo/placeholder and English/Gujarati language switch.
- Opening status: e.g. **Open · Closes 9 PM**, or clear **Closed** state.
- Live summary: number waiting and approximate waiting time.
- Barber chips/cards (name, photo/placeholder, status: Free / Busy / On break / Off duty).
- Large gold **Join Queue** button.

### Actions
- **Join Queue** opens `/join` when online joining is available.
- Language switch updates labels without losing the customer's place.

### Responsive / states
- On phones, single-column layout with big tap targets; on desktop, centered responsive cards.
- Show loading while queue data arrives, an error/retry state on connection failure, and a friendly message when no one is waiting.
- When online joining is closed, disable **Join Queue** and explain why; existing customers may still track status.

## Screen 2 — Join Queue (`/join`)
**User and goal:** Customer selects services and joins today's live queue.

### Visible elements
- Name and validated **10-digit Indian mobile number** fields.
- Multi-select service cards (maximum **3**); display English/Gujarati service name, duration and price.
- Example demo services: Haircut (30 min, ₹150), Beard Trim (15 min, ₹80), Hair Spa (45 min, ₹400). Owner may edit these.
- Barber selector: **Any barber (fastest)** or one named on-duty barber (e.g., Ravi, Amit, Imran) with photo/status.
- Live summary with total service duration, total price, approximate wait and selected barber.
- Large **Confirm** button.

### Actions
- Selecting/deselecting a service immediately updates summary.
- Selecting a barber updates eligible queue estimate.
- **Confirm** validates name, phone, service selections, barber preference and queue availability. On success create a same-day token and navigate to `/status/:id`.

### Responsive / states
- Single-column mobile layout and sticky summary/confirm area if space allows.
- Show inline errors for blank name, invalid phone, zero services, more than three services, unavailable service/barber, duplicate active phone, and closed online queue.
- Disable submission while request is processing to avoid double submission.

## Screen 3 — My Status (`/status/:id`)
**User and goal:** Customer follows their place until service is completed.

### Visible elements
- Large token (e.g., **S-14**), selected services and preferred/assigned barber.
- Queue position (e.g., **4th in line**) and approximate minutes remaining, updated automatically.
- Status indicator: Waiting → Called → In chair → Done, plus terminal Cancelled / No-show states when applicable.
- When second in the eligible line: **Start coming to the salon** banner.
- When called: large gold **It's your turn! Go to [barber]** notification, optionally vibration when supported.
- **Cancel my spot** button while cancellation is permitted.

### Actions
- **Cancel my spot** asks for confirmation, then cancels the active waiting place.
- Status screen auto-updates without refresh.

### Responsive / states
- Phone-first, token and call notification highly readable.
- Show loading, invalid-token/not-found, connection/retry and already-finished states.

## Screen 4 — Reception Dashboard (`/reception`)
**User and goal:** Receptionist manages remote bookings and walk-ins fairly.

### Visible elements
- Header showing queue status, active counts, language toggle, and **+ Add Walk-in**.
- Barber cards: photo, name, availability, current customer, elapsed/remaining approximate time, **Call next**.
- Ordered waiting list: token, name, services, selected barber/Any, wait duration, current status, **No-show** and **Cancel** where allowed.
- Highlight waiting times exceeding **60 minutes** in amber.
- Walk-in entry form: name, phone, one to three services, barber preference.

### Actions
- **Call next** selects the earliest eligible waiting customer for the selected available barber, following `03-flows-rules.md`.
- **+ Add Walk-in** appends the customer to the same live queue after validation, even if online joining is closed (subject to salon operating status).
- **No-show** becomes available after the call grace period; **Cancel** only on valid active states.

### Responsive / states
- Tablet landscape priority: barber overview next to queue list. On mobile, stack sections and keep controls usable.
- Empty list: **No one waiting — walk right in!**; also show loading and action-failed feedback.

## Screen 5 — Barber View (`/barber/:name`)
**User and goal:** Each barber sees their next/current customer and manages service.

### Visible elements
- Barber name, availability indicator and English/Gujarati toggle.
- Current called/assigned customer card: token, name, services, duration, timer since service started.
- Large **Start** button while customer is Called, then **Done** while In chair.
- **Next for you** preview of the earliest eligible waiting token.
- **On break / Available** toggle.

### Actions
- **Start** changes Called → In chair for that barber's customer.
- **Done** changes In chair → Done, frees the barber and updates all screens.
- **On break** prevents new calls to that barber while on break; it must not silently reassign customers who selected that barber.

### Responsive / states
- Phone-first, prominent high-contrast action buttons.
- Show **No customer assigned**, invalid barber, offline and update-failed states.

## Screen 6 — Waiting Area TV (`/display`)
**User and goal:** Customers waiting inside the salon can see current calls.

### Visible elements
- Full-screen premium dark background, salon name and current time/queue status.
- Row for each on-duty barber: photo/placeholder, barber name, currently assigned/called token (e.g. **Now: S-12**).
- **Up next** section displaying the next **five eligible waiting tokens** with approximate times.
- Newly-called token flashes gold and may play a brief chime when supported.

### Actions / states
- TV is display-only; auto-updates across devices without manual refreshing.
- If no one is waiting, show an attractive empty state. On disconnection, show a reconnecting indicator.
- Optimize for 1920×1080 with text legible from around five metres.

## Screen 7 — Owner Settings (`/admin`)
**User and goal:** Owner manages today's queue configuration and basic statistics.

### Visible elements
- Today's stats: **customers served**, **average waiting time**, **no-shows**.
- Services table/cards with English and Gujarati names, duration in minutes, price, and enabled/disabled toggle.
- Add/Edit service form with required validation.
- Barbers-on-duty list with toggle (including availability/break indication).
- **Online joining: Open / Closed** switch.

### Actions
- Save service additions/edits and availability updates.
- Disabled services cannot be selected for new joins.
- Toggle barber duty status; update selectable barbers accordingly without changing existing barber preferences.
- Opening/closing online joining changes the Home and Join screens immediately.

### Responsive / states
- Laptop/tablet dashboard, readable stacked cards on phones.
- Show validation errors, save confirmation, loading and empty states.

## Shared UI Requirements
- All visible interface labels must be available in both English (EN) and Gujarati (GU).
- Use accessible button labels, visible keyboard focus and phone tap targets at least 44px.
- Preserve active customer state after reload; show appropriate connection failures instead of blank screens.
- Do not invent payment, future appointments, SMS/WhatsApp, loyalty or multi-branch screens.
