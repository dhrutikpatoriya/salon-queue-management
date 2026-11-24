# Salon Queue Management System — Project Brief & Scope

## Problem
During busy hours and weekends, salon customers may wait a long time without knowing when their turn will come. Walk-ins and customers who want a particular barber can make the queue difficult to manage. This application will show queue positions and approximate wait times and help salon staff serve customers fairly.

## Users
- **Customers:** Join the queue on a phone, select services and a preferred barber, and track their turn.
- **Receptionist:** Register walk-ins, monitor the waiting list, call the next eligible customer, and handle cancellations or no-shows.
- **Barbers:** See their assigned customer, start and finish services, and mark themselves available or on break.
- **Owner:** Manage services, barber duty status, online queue availability, and daily statistics.

## Must-have Features
1. **Join from a phone:** Select one to three services and choose a specific barber or **Any barber (fastest)**.
2. **Live queue status:** Show a token, queue position, estimated waiting time, and timely 'Start coming' / 'It's your turn!' notifications on screen.
3. **Reception dashboard:** Add walk-in customers, see the queue, call the next eligible customer, and mark cancellations and no-shows.
4. **Barber view:** Show the assigned/current customer, let the barber tap **Start** and **Done**, and toggle break/availability.
5. **Waiting-area TV:** Show the current token for each barber and the next five tokens, with a visual highlight when someone is called.
6. **Owner settings:** Manage services (English/Gujarati name, duration, price and availability), barbers on duty, and open/close online joining.
7. **English and Gujarati interface:** Provide a language toggle with readable labels on customer and staff screens.
8. **Live synchronization:** Keep customer phones, reception, barber screens, and TV consistent without manual refresh.

## Do Not Build
- Online payments
- Future-date appointments or advance booking slots
- SMS or WhatsApp notifications
- Loyalty programs
- Multiple branches

## Look & Feel
Premium salon style: **charcoal (#1F2937)** with **gold (#D4A017)** accents, rounded cards, high-contrast text and large buttons. Mobile-first customer and barber pages; tablet-friendly reception dashboard and clear full-screen TV display. All interface labels should be available in English and Gujarati.

## Scope Notes
This is a same-day live queue, not an appointment booking platform. Displayed wait times are estimates, not guaranteed appointment times. Staff controls are part of the required workflow; use a simple test access method if needed, without adding complex account management.
