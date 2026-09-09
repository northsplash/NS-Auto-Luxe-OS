export const D2D_ACADEMY_ID = '7c0d2d00-a1b2-4c3d-8e9f-000000000001';
export const DETAIL_ACADEMY_ID = '7c0d3700-a1b2-4c3d-8e9f-000000000002';

export type AcademyQuizOption = { id: string; label: string; is_correct: boolean; sort_order: number };
export type AcademyQuestion = { id: string; prompt: string; sort_order: number; points: number; options: AcademyQuizOption[] };
export type AcademyLesson = { id: string; title: string; sort_order: number; content: string; takeaways: string[] };
export type AcademyDrill = { id: string; prompt: string; options: AcademyQuizOption[] };
export type AcademyCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  required_role: 'd2d_agent' | 'detailer';
  passing_score: number;
  duration_minutes: number;
  manager_signoff_required: boolean;
  track: 'd2d' | 'detail';
  modeled: string;
  lessons: AcademyLesson[];
  drills: AcademyDrill[];
  questions: AcademyQuestion[];
};

const uid = (prefix: string, n: number) => `7c0d2d00-a1b2-4c3d-8e9f-${prefix}${String(n).padStart(10, '0')}`;

function lesson(prefix: string, n: number, title: string, content: string, takeaways: string[]): AcademyLesson {
  return { id: uid(prefix, n), title, sort_order: n, content, takeaways };
}

function question(qPrefix: string, oPrefix: string, n: number, prompt: string, options: [string, boolean][]): AcademyQuestion {
  return {
    id: uid(qPrefix, n),
    prompt,
    sort_order: n,
    points: 1,
    options: options.map(([label, is_correct], i) => ({
      id: uid(oPrefix, n * 10 + i + 1),
      label,
      is_correct,
      sort_order: i + 1,
    })),
  };
}

function drill(id: string, prompt: string, options: [string, boolean][]): AcademyDrill {
  return {
    id,
    prompt,
    options: options.map(([label, is_correct], i) => ({ id: `${id}-${i + 1}`, label, is_correct, sort_order: i + 1 })),
  };
}

export const D2D_ACADEMY: AcademyCourse = {
  id: D2D_ACADEMY_ID,
  title: 'Door-to-door field academy',
  description: 'The North Splash street playbook: territory, knock colors, the door script, objections, the nine selves, the live pitch, and opening a customer account. Pass this before you canvass solo.',
  category: 'd2d_academy',
  required_role: 'd2d_agent',
  passing_score: 80,
  duration_minutes: 75,
  manager_signoff_required: true,
  track: 'd2d',
  modeled: 'North Splash field academy + live pitch + customer account',
  lessons: [
    lesson('11', 1, 'How a North Splash door day works', `You work one assigned territory. The map is the product — not a clipboard.

Clock in first. Open Field Work. Confirm the territory name at the top of the screen. The command bar shows Next Best House. Your job is knock, log the outcome before you walk away, then take the next pin.

Daily targets (typical): 50 doors, 15 real contacts, 4 appointments, about $1,500 in estimated work. Quality beats a fake door count. An honest No Answer is better than marking Contacted so the number looks good.

Never canvass a neighborhood that is not yours. If a homeowner asks you to leave, you leave and mark Do Not Knock. You represent the finish at someone’s driveway — the first thirty seconds is the brand.`, [
      'Clock in, confirm your territory, then knock the next best house.',
      'Log every door before you walk to the next one.',
      'Honest No Answer beats a fake Contacted.',
    ]),
    lesson('11', 2, 'Knock colors — log every door', `Every pin has a color. Update it before you walk away. Wrong color wastes the next rep’s day.

Unworked — you have not knocked.
No Answer — nobody came. Revisit later the same day if the street is still open.
Revisit — they asked you to come back at a time. Set the follow-up clock.
Contacted — you spoke; no interest yet.
Interested — they want to hear the offer. Open the presentation.
Follow Up — spouse, a quote, or a later slot. Put a time on it.
Estimate — you showed a price.
Appointment Set — booked on the calendar. This is the win.
Sold / Customer — they paid or they already belong to North Splash.
Not Interested — polite no. Do not argue.
Do Not Knock (DNK) — never return. Signs, hostility, or a request to stop.

DNK is permanent. A No Soliciting sign is DNK. Do not “just try the side door.”`, [
      'Appointment Set is the win you are paid to create.',
      'No Soliciting, hostility, or “please stop” = Do Not Knock forever.',
      'Follow Up always gets a time, never a maybe.',
    ]),
    lesson('11', 3, 'The door script', `Stand off the door so they can open it. Smile. Keep it under 30 seconds until they give you permission to continue.

1. Name and company: “Hi, I’m [name] with North Splash Auto Luxe. We detail driveways across North Carolina.”
2. Why you: “We come to you so you don’t sit at a wash.”
3. Permission: “Do you have a minute about your [vehicle you can actually see]?”
4. Problem: swirl, pollen, interior dust, water spots — only what you can see. Do not invent damage.
5. Offer: Exterior or Interior at Essential, Signature, or Elite. Full vehicle (Luxe) if they want both. Membership if they keep a nice car in the driveway.
6. Book: open the calendar and take a day this week. “I’ll text you later” is not a close unless they refuse a time.

If they shut the door, log Not Interested and go. If they say “my husband handles that,” log Follow Up with a time, not a maybe.`, [
      'Name, company, permission, visible problem, book a day this week.',
      'Never invent swirl or damage you cannot see.',
      'A calendar slot beats a promise to text.',
    ]),
    lesson('11', 4, 'Objections without an argument', `You are not there to win a debate. You are there to book a driveway or leave clean.

“I already wash it.” — “A wash removes dirt. A detail restores the finish. Which self fits how you keep this car — Essential, Signature, or Elite?”
“Too expensive.” — Show Essential first, then Signature as the usual choice. Do not discount on the porch.
“Not today.” — Offer one time this week. If they still refuse, Follow Up with a day they named, or Not Interested.
“My spouse decides.” — “What time should I come back when you are both here?” Log Follow Up.
“I have a guy.” — “Keep them. If you ever want a second set of eyes on the paint, we are mobile.” Log Contacted, not DNK.
Angry / “get off my property.” — Leave. DNK. Tell your manager if you felt unsafe.

Never block a driveway. Never knock after dark. Never follow someone into a garage or a house.`, [
      'Answer the objection in one sentence, then book or leave.',
      'No porch discounts. Essential is the honest cheaper self.',
      'Anger or a request to leave is DNK, not a debate.',
    ]),
    lesson('11', 5, 'What you sell at the door', `North Splash sells nine detail selves, then specialty work by appointment.

Exterior / Interior / Full (Luxe) × Essential, Signature, Elite.
Essential is the refresh. Signature is what most people book. Elite is paint enhancement or a deep interior extraction.

Memberships: Luxe Monthly $99, Luxe Plus $149, Luxe VIP $249. Pitch membership after they like the car, not instead of the first visit.

Do not quote ceramic coating or paint correction as a porch special unless you are signed off to sell it. Book an inspection appointment. Add-ons (pet hair, odor, engine bay) belong on the estimate, not as a surprise in the driveway.

Price lives in the presentation. Do not make up a number.`, [
      'Nine selves: Exterior, Interior, Full × Essential, Signature, Elite.',
      'Signature is the usual book. Coatings are an inspection, not a porch quote.',
      'Use the live quote. Do not invent prices.',
    ]),
    lesson('11', 6, 'Presentation and the customer account', `When the pin is Interested, open Sales Presentation. Hand them the tablet. Walk it: who we are, why a wash is not a detail, the three selves, membership, then the live quote. Save the offer onto the lead.

If they are ready to become a customer, open the Account tab in the pitch. Take first and last name, phones, email, street, city, state, ZIP, and the vehicle. Apply creates their portal login without signing you out. Read them the password once. They use the customer portal to see the booking — you stay in D2D.

If they are not ready, still book the appointment on the calendar. An appointment without an account is fine. An account without a date is not a win.`, [
      'Presentation only after Interested — never before the knock.',
      'Apply the household account from the pitch without leaving your D2D session.',
      'The win is still a date on the calendar this week.',
    ]),
    lesson('11', 7, 'Next house, route, and offline', `After you log a door, tap Next Best House. The app picks the nearest unworked or revisit pin. Do not zigzag across the territory for one “better” house.

Start Route builds a walking order. Stay on it unless a follow-up is due now.

If you lose signal, keep knocking. Outcomes queue on the phone and sync when you are back online. Queued doors still count. Do not write pins on paper and “enter them later” — you will forget the honest color.

End of day: no Unworked pins you already walked, follow-ups have times, DNK is DNK, appointments show on the calendar.`, [
      'Next Best House, not a custom zigzag.',
      'Offline knocks still get a color. Sync when the signal returns.',
      'Leave the street cleaner than you found it.',
    ]),
    lesson('11', 8, 'Safety, pay, and going solo', `Pay for this seat is weekly base plus commission on booked and sold work. Fake contacts do not pay. Appointments and accounts do.

You never collect a Social Security number, full bank account, or a photo of a driver’s license at the door. Tax and deposit last-fours live in the hire packet — not in a lead.

Do not enter a fenced yard, a garage, or a house. Do not park blocking a driveway. Do not knock after dark. If you feel unsafe, leave, DNK, and message your manager.

Finish this academy and pass the quiz. A manager still walks one live street with you before you go solo.`, [
      'Commission follows honest appointments, not painted pins.',
      'No SSN, no full bank, no ID photos at the door.',
      'Solo only after the quiz and a manager ride-along.',
    ]),
  ],
  drills: [
    drill('d2d-d1', 'A house has a No Soliciting sign on the door. What do you log?', [
      ['Do Not Knock, and leave', true],
      ['No Answer, then try the back gate', false],
      ['Not Interested after a short pitch', false],
      ['Leave it Unworked for the next rep', false],
    ]),
    drill('d2d-d2', 'They say “my wife handles the car, come back Thursday at 6.” What do you log?', [
      ['Follow Up, with Thursday 6:00 on the pin', true],
      ['Not Interested — they did not book', false],
      ['Appointment Set — close enough', false],
      ['Do Not Knock', false],
    ]),
    drill('d2d-d3', 'They are Interested and looking at the tablet. What is the next move?', [
      ['Walk the presentation, save the quote, and book a day this week', true],
      ['Quote a coating price from memory', false],
      ['Mark Sold and walk away', false],
      ['Skip the calendar and “text them later”', false],
    ]),
  ],
  questions: [
    question('21', '31', 1, 'A house has a No Soliciting sign. What do you log?', [
      ['Do Not Knock — and leave', true],
      ['No Answer, then try the back door', false],
      ['Not Interested after a short pitch', false],
      ['Leave it Unworked so someone else can try', false],
    ]),
    question('21', '31', 2, 'What is the win you are paid to create at the door?', [
      ['A long conversation about coatings', false],
      ['An appointment on the calendar this week', true],
      ['A promise that they will “think about it”', false],
      ['Fifty Unworked pins turned to Contacted', false],
    ]),
    question('21', '31', 3, 'Nobody answers. What is the honest log?', [
      ['Not Interested', false],
      ['Sold', false],
      ['No Answer, then take Next Best House', true],
      ['Do Not Knock', false],
    ]),
    question('21', '31', 4, 'When do you open the sales presentation?', [
      ['On every Unworked pin before you knock', false],
      ['After they are Interested and willing to look', true],
      ['Only after they have paid', false],
      ['Never — quote from memory', false],
    ]),
    question('21', '31', 5, 'What personal data do you never take at the door?', [
      ['Name and mobile number for the appointment', false],
      ['Full Social Security number or full bank account', true],
      ['Vehicle year and make', false],
      ['Preferred day for the detail', false],
    ]),
    question('21', '31', 6, 'They want a ceramic coating quoted on the porch. What do you do?', [
      ['Invent a number so you do not lose them', false],
      ['Book an inspection appointment. Do not porch-quote coating unless you are signed off.', true],
      ['Mark Sold and collect a deposit in cash', false],
      ['Log Do Not Knock', false],
    ]),
    question('21', '31', 7, 'They are ready for a North Splash account during the pitch. What happens when you tap Apply?', [
      ['You get signed out and they take over your D2D session', false],
      ['A customer portal login is created and you stay in D2D', true],
      ['Nothing until Owner types the password', false],
      ['The lead is deleted', false],
    ]),
    question('21', '31', 8, 'You lose cell signal mid-street. What is correct?', [
      ['Stop knocking until you have bars', false],
      ['Keep knocking, log the color, and sync when you are back online', true],
      ['Mark every remaining pin Contacted so the day counts', false],
      ['Leave the rest Unworked on purpose', false],
    ]),
  ],
};

export const DETAIL_ACADEMY: AcademyCourse = {
  id: DETAIL_ACADEMY_ID,
  title: 'Detailing field academy',
  description: 'The North Splash job: packet, Uber-style live status, inspection, the nine selves, photos, checklist, QC, and when you are allowed to run solo.',
  category: 'detail_academy',
  required_role: 'detailer',
  passing_score: 80,
  duration_minutes: 80,
  manager_signoff_required: true,
  track: 'detail',
  modeled: 'Housecall Pro job packet + Uber live status',
  lessons: [
    lesson('12', 1, 'The job packet before you roll', `Open My Jobs. Confirm customer name, address, vehicle, package, add-ons, and notes. If the address is missing, do not leave — message dispatch.

Clock in. Navigate from the job. Travel time is part of the job. Update status to En Route when you actually pull away, not from the shop lot.

Bring: towels for the package, chemistry on the inventory list, a charged phone, and a way to take before/after photos in daylight or even lighting.

The nine selves are Exterior, Interior, and Full (Luxe) × Essential, Signature, Elite. The packet tells you which self you are running. Do not “upgrade” in the driveway without dispatch.`, [
      'No address, no roll — text dispatch.',
      'En Route only when the wheels actually move.',
      'Run the self on the packet, not a surprise upgrade.',
    ]),
    lesson('12', 2, 'Live status like Uber', `The customer sees the same steps you tap:

Booked — the appointment is on the board.
En Route — you are driving. This sends the on-the-way message.
On Site / Arrived — you are in the driveway. Walk the vehicle with the customer if they are home.
In Progress / Started — chemistry is on the car. Start the timer.
Done / Finished — checklist, photos, and signature are complete. The job goes to QC.

Skipping a step breaks the customer texts and the dispatch board. Do not mark Finished from the next driveway.`, [
      'Booked → En Route → On site → In progress → Done.',
      'Every tap fires a customer message. Fake taps destroy trust.',
      'Finished means checklist, photos, and signature — not “I am hungry.”',
    ]),
    lesson('12', 3, 'Inspection and belongings', `Before you wash, walk the car. Write existing swirls, dents, chips, stains, and wheel rash in Vehicle Condition. Photograph damage. If you do not log it, it becomes “you did that.”

Ask about valuables. Do not move firearms, cash, or jewelry. If the interior is a biohazard or the paint is failing, stop and call your manager before you proceed.

Coatings and paint correction are not a surprise add-on in the driveway unless the packet already includes them.`, [
      'Photograph damage before water hits the car.',
      'Do not handle firearms, cash, or jewelry.',
      'Stop and call if the car is unsafe to work.',
    ]),
    lesson('12', 4, 'Exterior selves — Essential, Signature, Elite', `Exterior Essential: foam, hand wash, wheels, glass, spray sealant. This is the refresh.

Exterior Signature (most booked): adds decontamination, door jambs, and trim so the paint actually feels clean.

Exterior Elite: paint enhancement, premium sealant, panel-by-panel inspection. This is not a one-step compound on a coated car.

Full vehicle packages pair the matching interior self (Luxe Essential / Signature / Elite).

Work the checklist in order. Required items stay required. Do not skip wheels to save ten minutes.`, [
      'Essential = refresh. Signature = decon. Elite = paint enhancement.',
      'Checklist order is the standard, not a suggestion.',
      'Coated paint does not get a surprise cut.',
    ]),
    lesson('12', 5, 'Interior selves — Essential, Signature, Elite', `Interior Essential: vacuum, surfaces, glass, mats — cabin reset without a full extraction.

Interior Signature: leather, door panels, trunk, UV protectant on top of Essential.

Interior Elite: extraction, leather treatment, crevice work, interior protection.

Pet hair and odor are add-ons. If the packet does not include them, do not spend an extra hour and surprise the invoice. Message dispatch if the cabin is not what the notes described.

Never use a soaking extraction on a car that is going back on the road in twenty minutes without time to dry.`, [
      'Match the interior self on the packet.',
      'Pet hair and odor are add-ons unless already sold.',
      'Do not leave a soaked cabin for a customer who has to drive.',
    ]),
    lesson('12', 6, 'Photos, checklist, and the walk-around', `Before photos: all four corners, both sides, interior front and rear, wheels. After photos: the same angles, same light if you can.

Work the service checklist in order. Required items must be checked. Finish with a walk-around. Get the customer signature. Then Finish & Send to QC.

If they are not home, still take the photos, still run the checklist, and note “customer not present” before you send to QC.`, [
      'Same angles before and after.',
      'Signature after the walk-around, then QC — not the other way around.',
      'No customer on site is not an excuse to skip photos.',
    ]),
    lesson('12', 7, 'Chemistry, coated cars, and when to stop', `Do not use the wrong pad or compound on a ceramic-coated car. If you are unsure, stop and ask. Guessing costs more than a phone call.

Do not mix chemistry in unlabeled bottles. Do not work in direct noon sun on dark paint if you can shade the panel. Rinse grit off the mitt before you put it back on the paint.

If a product is not on the inventory list for this job, it is not on the car.

Stop and call: failing clear coat, open rust you might spread, a biohazard interior, a customer who wants a free Elite when they paid Essential.`, [
      'Unsure on a coated car = stop, then ask.',
      'Only inventory chemistry for this job.',
      'Scope fights go to dispatch, not a free upgrade.',
    ]),
    lesson('12', 8, 'QC, pay, and going solo', `QC is a manager reviewing your photos and notes. A fail means you return. That is normal for new hires — not a punishment.

Your pay estimate uses completed jobs, not jobs you marked started. Clock out when the last car is done.

You are not solo until this academy is passed and a manager signs off after watching one live job. Until then, take the extra photo and ask.`, [
      'Pay follows completed, QC-ready jobs.',
      'A QC fail is coaching, not a firing.',
      'Solo after the quiz and one live manager watch.',
    ]),
  ],
  drills: [
    drill('det-d1', 'The packet has no street address. What do you do?', [
      ['Leave anyway and figure it out on the road', false],
      ['Message dispatch and do not roll until the address is on the job', true],
      ['Mark Finished so it leaves your board', false],
      ['Tap En Route from the shop lot', false],
    ]),
    drill('det-d2', 'You see a rock chip on the hood before you wash. First move?', [
      ['Ignore it so the job stays short', false],
      ['Log it in Vehicle Condition and photograph it before you wash', true],
      ['Buff it without asking', false],
      ['Mark the job Finished', false],
    ]),
    drill('det-d3', 'The car is ceramic coated and you are not sure which pad to use. What is correct?', [
      ['Guess with a cutting pad — it will probably be fine', false],
      ['Stop and ask before you put a pad on the paint', true],
      ['Skip exterior and only do glass', false],
      ['Tell the customer their coating is fake', false],
    ]),
  ],
  questions: [
    question('22', '32', 1, 'When do you tap En Route?', [
      ['When you actually leave for the customer', true],
      ['The night before, to look busy', false],
      ['After you finish the job', false],
      ['Only if the customer texts you', false],
    ]),
    question('22', '32', 2, 'You see a rock chip on the hood. What first?', [
      ['Ignore it so the job stays short', false],
      ['Log it in Vehicle Condition and photograph it before you wash', true],
      ['Buff it without asking', false],
      ['Mark the job Finished immediately', false],
    ]),
    question('22', '32', 3, 'What must be done before Finish & Send to QC?', [
      ['Required checklist items, required photos, and customer signature', true],
      ['Only the exterior rinse', false],
      ['A five-star Google review', false],
      ['Clocking out', false],
    ]),
    question('22', '32', 4, 'The live status stepper is modeled after what the customer already understands. Which sequence is correct?', [
      ['Finished → En Route → Booked', false],
      ['Booked → En Route → On site → In progress → Done', true],
      ['QC → En Route → Inspection', false],
      ['Sold → Do Not Knock → Revisit', false],
    ]),
    question('22', '32', 5, 'When are you allowed to work jobs solo?', [
      ['After you pass this academy and a manager signs off on a live job', true],
      ['After you create a login', false],
      ['As soon as you clock in the first time', false],
      ['Never — only managers detail', false],
    ]),
    question('22', '32', 6, 'Exterior Signature adds which work on top of Essential?', [
      ['A porch coating quote', false],
      ['Decontamination, door jambs, and trim', true],
      ['Full interior extraction', false],
      ['Nothing — it is the same as Essential', false],
    ]),
    question('22', '32', 7, 'Pet hair is not on the packet. The cabin is covered. What do you do?', [
      ['Spend an extra hour and surprise the invoice', false],
      ['Message dispatch before you eat the time or skip the hair', true],
      ['Mark Finished with no photos', false],
      ['Refuse the whole job and leave silently', false],
    ]),
    question('22', '32', 8, 'Which jobs count toward your pay estimate?', [
      ['Jobs you marked Started', false],
      ['Completed jobs that made it through the board', true],
      ['Jobs you thought about on the drive', false],
      ['Every En Route tap', false],
    ]),
  ],
};
