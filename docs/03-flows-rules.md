# Salon Queue Management System — Flows, Business Rules & Tests

## 1. Remote Customer Flow
1. Customer opens Home (`/`) and checks whether online joining is open.
2. Opens Join (`/join`), enters name and 10-digit phone, chooses 1–3 active services and a specific barber or **Any barber**.
3. Confirms and receives an active daily token such as **S-14**, with queue position and estimated waiting time.
4. Watches `/status/:id` from their phone. When second in the eligible queue, sees **Start coming to the salon**.
5. Receptionist taps **Call next** for an available barber; if the customer is eligible, status becomes **Called** and the phone shows **It's your turn! Go to [barber]**. The TV highlights the token.
6. Barber taps **Start** to begin service (**In chair**) and **Done** to complete it. All relevant screens update; token leaves the active queue.

## 2. Walk-in Customer Flow
1. Receptionist taps **+ Add Walk-in**.
2. Enters name, phone, 1–3 services and barber preference.
3. Customer joins the same queue **at the end**, according to join time and normal eligibility rules.
4. Receptionist calls them when eligible; barber starts and completes service.

## 3. Statuses and Allowed Transitions
- Main flow: **Waiting → Called → In chair → Done**. Never move backwards.
- Cancellation: **Waiting → Cancelled**.
- No-show: **Called → No-show**, only after the defined grace period.
- **Done**, **Cancelled**, and **No-show** are terminal statuses; they do not re-enter the active queue.
- Only the receptionist calls the next customer; only the assigned barber can Start/Done their service.
- Do not allow two customers to be In chair with the same barber simultaneously.

## 4. Fair Queue & Barber Preference Rules
- Follow **first come, first served among customers eligible for a barber**.
- **Call next for barber X** picks the earliest Waiting customer whose choice is **X** or **Any barber**.
- Customers selecting **Ravi** must never be assigned to Amit or Imran without explicitly changing their choice.
- Customers selecting **Any barber** may be allocated to whichever eligible on-duty available barber calls next; assign that barber on the successful call.
- Do not call customers when a barber is Busy, On break or Off duty.
- Update positions and **Up next** based on the actual eligible queue; avoid treating incompatible barber preferences as available for every barber.
- Each barber has at most one Called or In chair assigned customer at a time.

## 5. Services and Joining Validation
- Require a nonempty customer name and a valid **10-digit Indian mobile number**.
- Require **1 to 3 active services** per customer; reject zero or more than three selections.
- Sum chosen service durations and prices to show the live estimate and total.
- Validate all inputs on the server, not only in the user interface.
- Allow only **one active queue spot per phone number** (Waiting, Called or In chair). On duplicate join, show/link the existing spot, without creating a new token.
- Disable duplicate submissions while a join request is processing; server must also prevent duplicate active spots.
- Use same-day token numbers **S-1, S-2, ...**, assigned sequentially. Never reuse a token on the same day; retain a unique internal ID for each record.

## 6. Estimated Waiting Time
- Use the handout's simple approximation: **sum of remaining service minutes for active customers ahead ÷ number of working barbers**.
- Exclude barbers who are off duty or on break from the working count; never divide by zero.
- Respect barber preferences when deciding which customers are ahead for a specific barber. For a specific-barber customer, estimate using that barber's relevant backlog rather than misleading salon-wide averages.
- Show estimates as approximate values, not guaranteed times. Recalculate when customers join, are called, start, finish, cancel, become no-shows, or barber availability changes.
- Explain the calculation in the UI or help text if necessary; avoid claiming minute-perfect accuracy.

## 7. Calling, No-show and Cancellation
- Only an available on-duty barber can receive the next called customer.
- When a customer is Called, record the call timestamp and assigned barber.
- If the called customer does not arrive within **10 minutes**, the receptionist may mark them **No-show**.
- A No-show customer who returns must join **at the end** with a **new token**; never restore their old queue position.
- A Waiting customer can cancel their own queue spot after confirmation; a receptionist can cancel a Waiting entry. Other state changes must follow the permitted transitions.
- Cancelled and No-show entries are excluded from active position calculations and display.

## 8. Salon Hours and Breaks
- Owner can open or close **online joining**.
- Online joining closes automatically **30 minutes before salon closing time**. The Home/Join pages explain this clearly.
- Receptionist may still add walk-ins while the salon is operating, even when online joining is closed.
- When barber X goes **On break**, stop calling customers for X; show **[barber] is on break** to affected customers. Do not silently send their customer to another barber.
- Off-duty barbers are not offered for new joins; existing assigned or waiting spots must be handled explicitly rather than lost.

## 9. Live Synchronization and Persistence
- Within approximately **5 seconds**, changes must appear across the customer phone, receptionist tablet, barber screen and TV without refresh.
- Persist services, barber state and queue records so a page refresh does not lose an active spot.
- After temporary disconnection, reconnect and fetch authoritative current data.
- Validate queue transitions and barber eligibility on the backend; frontend buttons alone are not sufficient.
- Ensure two simultaneous receptionist actions cannot call the same customer twice or assign two active customers to one barber.

## 10. Language and UI Rules
- All interface labels should be available in **English and Gujarati**, controlled by one shared language system.
- Switching languages must not lose a customer's data, token or place.
- Use premium charcoal **#1F2937** and gold **#D4A017** styling with accessible contrast.
- Handle loading, empty, unavailable-service, invalid-phone, no-eligible-customer and connection error states clearly.

## 11. Test Checklist
- [ ] Home shows open/closed status, live wait and barber availability.
- [ ] Select two services: displayed total duration and ₹ price are correct.
- [ ] Invalid phone numbers and zero / more than three services are rejected.
- [ ] Same phone joining twice returns existing active spot rather than a duplicate.
- [ ] Tokens are unique and sequential for the day.
- [ ] Walk-in joins at the end of the same queue.
- [ ] Call next for Amit skips someone who selected Ravi only.
- [ ] Any-barber customer can be assigned to an available eligible barber.
- [ ] Busy or on-break barber cannot call a new customer.
- [ ] Call next shows It's your turn on the customer's phone and TV within five seconds.
- [ ] Barber Start and Done update reception, status and TV automatically.
- [ ] Same barber cannot serve two In chair customers simultaneously.
- [ ] No-show cannot be marked before ten minutes; rejoining gives a new end-of-queue token.
- [ ] Cancelling a Waiting spot removes it from the active queue.
- [ ] Closing online joining disables the remote Join button; walk-in flow remains available during salon hours.
- [ ] Waiting time reduces appropriately as customers finish or leave the queue.
- [ ] Services marked inactive cannot be selected for new joins.
- [ ] English/Gujarati toggle translates all visible labels without losing customer state.
- [ ] Phone, tablet and TV windows stay synchronized after refresh and reconnect.
- [ ] Invalid links, network failures and empty queue show useful messages.
