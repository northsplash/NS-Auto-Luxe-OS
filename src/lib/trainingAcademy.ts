import { supabase, type Employee, type TrainingAssignment, type TrainingCourse, type TrainingLesson, type TrainingOption, type TrainingQuestion } from '@/lib/supabase';
import { employeeCanD2D, employeeCanDetail } from '@/lib/workCapabilities';

export const D2D_ACADEMY_ID = '7c0d2d00-a1b2-4c3d-8e9f-000000000001';
export const DETAIL_ACADEMY_ID = '7c0d3700-a1b2-4c3d-8e9f-000000000002';

export type AcademyQuizOption = { id: string; label: string; is_correct: boolean; sort_order: number };
export type AcademyQuestion = { id: string; prompt: string; sort_order: number; points: number; options: AcademyQuizOption[] };
export type AcademyLesson = { id: string; title: string; sort_order: number; content: string };
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
  questions: AcademyQuestion[];
};

const uid = (prefix: string, n: number) => `7c0d2d00-a1b2-4c3d-8e9f-${prefix}${String(n).padStart(10, '0')}`;

export const ACADEMY_COURSES: AcademyCourse[] = [
  {
    id: D2D_ACADEMY_ID,
    title: 'Door-to-door academy',
    description: 'SalesRabbit playbook for North Splash: map, pins, knock colors, the door script, and the next house. Finish this before you canvass live.',
    category: 'd2d_academy',
    required_role: 'd2d_agent',
    passing_score: 80,
    duration_minutes: 45,
    manager_signoff_required: true,
    track: 'd2d',
    modeled: 'SalesRabbit + SPOTIO',
    lessons: [
      {
        id: uid('11', 1),
        title: 'How a North Splash door day works',
        sort_order: 1,
        content: `You work one assigned territory. The map is the product — not a clipboard.

Clock in. Open Field Work. Confirm the territory name at the top. The command bar shows the next best house. Your job is to knock, log the outcome, and move.

Daily goals (typical): 50 doors, 15 contacts, 4 appointments, $1,500 estimated. Quality beats a fake door count. A honest No Answer is better than marking Contacted.

Never canvass a neighborhood that is not yours. If someone asks you to leave, leave and mark Do Not Knock.`,
      },
      {
        id: uid('11', 2),
        title: 'Knock colors — log every door',
        sort_order: 2,
        content: `Every pin has a color. Update it before you walk away.

Unworked — you have not knocked.
No Answer — nobody came. Revisit later the same day if the street is still open.
Revisit — they asked you to come back at a time. Set the follow-up.
Contacted — you spoke; no interest yet.
Interested — they want to hear the offer. Open the presentation.
Follow Up — they need a spouse, a quote, or a later slot.
Estimate — you sent or showed a price.
Appointment Set — booked on the calendar. This is the win.
Sold / Customer — they paid or they already belong to North Splash.
Not Interested — polite no. Do not argue.
Do Not Knock (DNK) — never return. Signs, hostility, or a request to stop.

DNK is permanent. Tapping the wrong color wastes the next rep’s day.`,
      },
      {
        id: uid('11', 3),
        title: 'The door script',
        sort_order: 3,
        content: `Stand off the door, smile, and keep it short.

1. Name and company: “Hi, I’m [name] with North Splash Auto Luxe. We detail in this neighborhood.”
2. Why you: “We come to the driveway so you don’t sit at a wash.”
3. Permission: “Do you have a minute about your [vehicle you can see]?”
4. Problem: swirl, pollen, interior dust, water spots — only what you can see. Do not invent damage.
5. Offer: Exterior or Interior at Essential / Signature / Elite. Full vehicle if they want both. Membership if they keep a nice car in the driveway.
6. Book: open the calendar and take a day this week. Do not “I’ll text you later” unless they refuse a time.

If they shut the door, log Not Interested and go. If they say “my husband handles that,” log Follow Up with a time, not a maybe.`,
      },
      {
        id: uid('11', 4),
        title: 'Next door, route, and the presentation',
        sort_order: 4,
        content: `After you log a door, tap Next Best House. The app picks the nearest unworked or revisit pin. Do not zigzag across the territory.

Start Route builds a walking order. Stay on it unless a follow-up is due now.

When they are Interested, open Sales Presentation. Hand them the phone or tablet. Walk the 8 slides: who we are, why a wash is not a detail, packages, membership, then the live quote. Save the offer onto the lead.

Never quote a coating or paint correction at the door unless you have been signed off to sell it. Book the inspection appointment instead.`,
      },
      {
        id: uid('11', 5),
        title: 'What you never do',
        sort_order: 5,
        content: `Do not collect a Social Security number, full bank account, or a photo of a driver’s license at the door. Tax and deposit last-fours live in the hire packet — not in a lead.

Do not enter a fenced yard, a garage, or a house. Do not argue with Do Not Knock.

Do not park blocking a driveway. Do not knock after dark.

If you lose signal, keep knocking and sync when you are back online. Queued outcomes still count.

Finish this academy, pass the quiz, then a manager watches one live street with you before you go solo.`,
      },
    ],
    questions: [
      {
        id: uid('21', 1),
        prompt: 'A house has a No Soliciting sign. What do you log?',
        sort_order: 1,
        points: 1,
        options: [
          { id: uid('31', 11), label: 'Do Not Knock — and leave', is_correct: true, sort_order: 1 },
          { id: uid('31', 12), label: 'No Answer, then try the back door', is_correct: false, sort_order: 2 },
          { id: uid('31', 13), label: 'Not Interested after a short pitch', is_correct: false, sort_order: 3 },
          { id: uid('31', 14), label: 'Leave it Unworked so someone else can try', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('21', 2),
        prompt: 'What is the win you are paid to create at the door?',
        sort_order: 2,
        points: 1,
        options: [
          { id: uid('31', 21), label: 'A long conversation about coatings', is_correct: false, sort_order: 1 },
          { id: uid('31', 22), label: 'An appointment on the calendar this week', is_correct: true, sort_order: 2 },
          { id: uid('31', 23), label: 'A promise that they will “think about it”', is_correct: false, sort_order: 3 },
          { id: uid('31', 24), label: 'Fifty Unworked pins turned to Contacted', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('21', 3),
        prompt: 'Nobody answers. What is the honest log?',
        sort_order: 3,
        points: 1,
        options: [
          { id: uid('31', 31), label: 'Not Interested', is_correct: false, sort_order: 1 },
          { id: uid('31', 32), label: 'Sold', is_correct: false, sort_order: 2 },
          { id: uid('31', 33), label: 'No Answer, then take Next Best House', is_correct: true, sort_order: 3 },
          { id: uid('31', 34), label: 'Do Not Knock', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('21', 4),
        prompt: 'When do you open the sales presentation?',
        sort_order: 4,
        points: 1,
        options: [
          { id: uid('31', 41), label: 'On every Unworked pin before you knock', is_correct: false, sort_order: 1 },
          { id: uid('31', 42), label: 'After they are Interested and willing to look', is_correct: true, sort_order: 2 },
          { id: uid('31', 43), label: 'Only after they have paid', is_correct: false, sort_order: 3 },
          { id: uid('31', 44), label: 'Never — quote from memory', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('21', 5),
        prompt: 'What personal data do you never take at the door?',
        sort_order: 5,
        points: 1,
        options: [
          { id: uid('31', 51), label: 'Name and mobile number for the appointment', is_correct: false, sort_order: 1 },
          { id: uid('31', 52), label: 'Full Social Security number or full bank account', is_correct: true, sort_order: 2 },
          { id: uid('31', 53), label: 'Vehicle year and make', is_correct: false, sort_order: 3 },
          { id: uid('31', 54), label: 'Preferred day for the detail', is_correct: false, sort_order: 4 },
        ],
      },
    ],
  },
  {
    id: DETAIL_ACADEMY_ID,
    title: 'Detailing academy',
    description: 'Housecall Pro job packet plus Uber-style live status. Inspection, photos, checklist, sign-off, and QC before you go live.',
    category: 'detail_academy',
    required_role: 'detailer',
    passing_score: 80,
    duration_minutes: 50,
    manager_signoff_required: true,
    track: 'detail',
    modeled: 'Housecall Pro + Uber',
    lessons: [
      {
        id: uid('12', 1),
        title: 'The job packet before you roll',
        sort_order: 1,
        content: `Open My Jobs. Confirm customer name, address, vehicle, package, add-ons, and notes. If the address is missing, do not leave — message dispatch.

Clock in. Navigate with the in-job map. Travel time is part of the job. Update status to En Route when you actually pull away, not from the shop parking lot.

Bring: towels for the package, chemistry on the inventory list, phone charged, and a way to take before/after photos in daylight or with even lighting.`,
      },
      {
        id: uid('12', 2),
        title: 'Live status like Uber',
        sort_order: 2,
        content: `The customer sees the same steps you tap:

Booked — the appointment is on the board.
En Route — you are driving. This sends the on-the-way message.
On Site / Arrived — you are in the driveway. Walk the vehicle with the customer if they are home.
In Progress / Started — chemistry is on the car. Start the timer.
Done / Finished — checklist, photos, and signature are complete. The job goes to QC.

Skipping a step breaks the customer texts and the dispatch board. Do not mark Finished from the next job.`,
      },
      {
        id: uid('12', 3),
        title: 'Inspection and belongings',
        sort_order: 3,
        content: `Before you wash, walk the car. Write existing swirls, dents, chips, stains, and wheel rash in Vehicle Condition. Photograph damage. If you do not log it, it becomes “you did that.”

Ask about valuables. Do not move firearms, cash, or jewelry. If the interior is a biohazard or the paint is failing, stop and call your manager before you proceed.

Coatings and paint correction are not a surprise add-on in the driveway unless the packet already includes them.`,
      },
      {
        id: uid('12', 4),
        title: 'Photos, checklist, and the standard',
        sort_order: 4,
        content: `Before photos: all four corners, both sides, interior front and rear, wheels. After photos: the same angles.

Work the service checklist in order. Required items must be checked. Exterior selves: foam, hand wash, wheels, glass, sealant — Signature adds decon, Elite adds paint enhancement. Interior selves: vacuum, surfaces, glass — Signature adds leather, Elite adds extraction.

Do not use the wrong pad or compound on a ceramic-coated car. If you are unsure, stop.

Finish with a walk-around. Get the customer signature. Then Finish & Send to QC. Rework is cheaper than a chargeback.`,
      },
      {
        id: uid('12', 5),
        title: 'QC, pay, and going solo',
        sort_order: 5,
        content: `QC is a manager reviewing your photos and notes. A fail means you return. That is normal for new hires — not a punishment.

Your pay estimate uses completed jobs, not jobs you marked started. Clock out when the last car is done.

You are not solo until this academy is passed and a manager signs off after watching one live job. Until then, take the extra photo and ask.`,
      },
    ],
    questions: [
      {
        id: uid('22', 1),
        prompt: 'When do you tap En Route?',
        sort_order: 1,
        points: 1,
        options: [
          { id: uid('32', 11), label: 'When you actually leave for the customer', is_correct: true, sort_order: 1 },
          { id: uid('32', 12), label: 'The night before, to look busy', is_correct: false, sort_order: 2 },
          { id: uid('32', 13), label: 'After you finish the job', is_correct: false, sort_order: 3 },
          { id: uid('32', 14), label: 'Only if the customer texts you', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('22', 2),
        prompt: 'You see a rock chip on the hood. What first?',
        sort_order: 2,
        points: 1,
        options: [
          { id: uid('32', 21), label: 'Ignore it so the job stays short', is_correct: false, sort_order: 1 },
          { id: uid('32', 22), label: 'Log it in Vehicle Condition and photograph it before you wash', is_correct: true, sort_order: 2 },
          { id: uid('32', 23), label: 'Buff it without asking', is_correct: false, sort_order: 3 },
          { id: uid('32', 24), label: 'Mark the job Finished immediately', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('22', 3),
        prompt: 'What must be done before Finish & Send to QC?',
        sort_order: 3,
        points: 1,
        options: [
          { id: uid('32', 31), label: 'Required checklist items, required photos, and customer signature', is_correct: true, sort_order: 1 },
          { id: uid('32', 32), label: 'Only the exterior rinse', is_correct: false, sort_order: 2 },
          { id: uid('32', 33), label: 'A five-star Google review', is_correct: false, sort_order: 3 },
          { id: uid('32', 34), label: 'Clocking out', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('22', 4),
        prompt: 'The live status stepper is modeled after what the customer already understands. Which sequence is correct?',
        sort_order: 4,
        points: 1,
        options: [
          { id: uid('32', 41), label: 'Finished → En Route → Booked', is_correct: false, sort_order: 1 },
          { id: uid('32', 42), label: 'Booked → En Route → On site → In progress → Done', is_correct: true, sort_order: 2 },
          { id: uid('32', 43), label: 'QC → En Route → Inspection', is_correct: false, sort_order: 3 },
          { id: uid('32', 44), label: 'Sold → Do Not Knock → Revisit', is_correct: false, sort_order: 4 },
        ],
      },
      {
        id: uid('22', 5),
        prompt: 'When are you allowed to work jobs solo?',
        sort_order: 5,
        points: 1,
        options: [
          { id: uid('32', 51), label: 'After you pass this academy and a manager signs off on a live job', is_correct: true, sort_order: 1 },
          { id: uid('32', 52), label: 'After you create a login', is_correct: false, sort_order: 2 },
          { id: uid('32', 53), label: 'As soon as you clock in the first time', is_correct: false, sort_order: 3 },
          { id: uid('32', 54), label: 'Never — only managers detail', is_correct: false, sort_order: 4 },
        ],
      },
    ],
  },
];

export const academyById = (id: string) => ACADEMY_COURSES.find(c => c.id === id);

export function academyCoursesForEmployee(employee: Employee) {
  return ACADEMY_COURSES.filter(c =>
    (c.track === 'd2d' && employeeCanD2D(employee)) ||
    (c.track === 'detail' && employeeCanDetail(employee)) ||
    (!employeeCanD2D(employee) && !employeeCanDetail(employee)),
  );
}

export function asTrainingCourse(course: AcademyCourse): TrainingCourse {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    required_role: course.required_role,
    passing_score: course.passing_score,
    duration_minutes: course.duration_minutes,
    manager_signoff_required: course.manager_signoff_required,
    renewal_months: null,
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

export function academyLessons(courseId: string): TrainingLesson[] {
  const course = academyById(courseId);
  if (!course) return [];
  return course.lessons.map(l => ({
    id: l.id,
    course_id: courseId,
    title: l.title,
    lesson_type: 'text',
    content: l.content,
    media_url: null,
    sort_order: l.sort_order,
    required: true,
    created_at: new Date().toISOString(),
  }));
}

export function academyQuestions(courseId: string): { questions: TrainingQuestion[]; options: TrainingOption[] } {
  const course = academyById(courseId);
  if (!course) return { questions: [], options: [] };
  return {
    questions: course.questions.map(q => ({
      id: q.id,
      course_id: courseId,
      prompt: q.prompt,
      question_type: 'multiple_choice',
      sort_order: q.sort_order,
      points: q.points,
      created_at: new Date().toISOString(),
    })),
    options: course.questions.flatMap(q =>
      q.options.map(o => ({
        id: o.id,
        question_id: q.id,
        label: o.label,
        is_correct: o.is_correct,
        sort_order: o.sort_order,
      })),
    ),
  };
}

export function gradeAcademy(courseId: string, answers: Record<string, string>) {
  const course = academyById(courseId);
  if (!course || !course.questions.length) return { score: 100, passed: true, earned: 0, total: 0 };
  let earned = 0;
  let total = 0;
  course.questions.forEach(q => {
    total += q.points;
    const selected = q.options.find(o => o.id === answers[q.id]);
    if (selected?.is_correct) earned += q.points;
  });
  const score = total ? Math.round((earned / total) * 100) : 100;
  return { score, passed: score >= course.passing_score, earned, total };
}

function progressKey(employeeId: string) {
  return `ns-academy-progress-${employeeId}`;
}

export function readLocalAcademyProgress(employeeId: string): Record<string, Partial<TrainingAssignment>> {
  try {
    return JSON.parse(localStorage.getItem(progressKey(employeeId)) || '{}');
  } catch {
    return {};
  }
}

export function writeLocalAcademyProgress(employeeId: string, courseId: string, patch: Partial<TrainingAssignment>) {
  const all = readLocalAcademyProgress(employeeId);
  all[courseId] = { ...(all[courseId] || {}), ...patch, course_id: courseId, employee_id: employeeId };
  localStorage.setItem(progressKey(employeeId), JSON.stringify(all));
}

export async function ensureAcademyCourses() {
  const errors: string[] = [];
  for (const course of ACADEMY_COURSES) {
    const row = {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      required_role: course.required_role,
      passing_score: course.passing_score,
      duration_minutes: course.duration_minutes,
      manager_signoff_required: course.manager_signoff_required,
      status: 'active',
    };
    const upsert = await supabase.from('training_courses').upsert(row, { onConflict: 'id' });
    if (upsert.error) {
      errors.push(upsert.error.message);
      continue;
    }
    const lessonRows = course.lessons.map(l => ({
      id: l.id,
      course_id: course.id,
      title: l.title,
      lesson_type: 'text',
      content: l.content,
      sort_order: l.sort_order,
      required: true,
    }));
    const lessons = await supabase.from('training_lessons').upsert(lessonRows, { onConflict: 'id' });
    if (lessons.error) errors.push(lessons.error.message);

    const questionRows = course.questions.map(q => ({
      id: q.id,
      course_id: course.id,
      prompt: q.prompt,
      question_type: 'multiple_choice',
      sort_order: q.sort_order,
      points: q.points,
    }));
    const questions = await supabase.from('training_questions').upsert(questionRows, { onConflict: 'id' });
    if (questions.error) errors.push(questions.error.message);

    const optionRows = course.questions.flatMap(q =>
      q.options.map(o => ({
        id: o.id,
        question_id: q.id,
        label: o.label,
        is_correct: o.is_correct,
        sort_order: o.sort_order,
      })),
    );
    const options = await supabase.from('training_question_options').upsert(optionRows, { onConflict: 'id' });
    if (options.error) errors.push(options.error.message);
  }
  return errors;
}

export function courseIdsForEmployee(employee: Employee) {
  const ids: string[] = [];
  if (employeeCanD2D(employee)) ids.push(D2D_ACADEMY_ID);
  if (employeeCanDetail(employee)) ids.push(DETAIL_ACADEMY_ID);
  if (!ids.length) ids.push(D2D_ACADEMY_ID, DETAIL_ACADEMY_ID);
  return ids;
}

export async function assignAcademyForEmployee(employee: Employee) {
  await ensureAcademyCourses();
  const ids = courseIdsForEmployee(employee);
  for (const courseId of ids) {
    const existing = await supabase.from('training_assignments').select('id').eq('course_id', courseId).eq('employee_id', employee.id).maybeSingle();
    if (existing.data) continue;
    const inserted = await supabase.from('training_assignments').insert({
      course_id: courseId,
      employee_id: employee.id,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    });
    if (inserted.error) {
      writeLocalAcademyProgress(employee.id, courseId, {
        id: `local-${courseId}`,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        due_at: null,
        started_at: null,
        completed_at: null,
        score: null,
        passed: null,
        manager_signoff_status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
  }
}

export async function applyNewHireAcademy(employees: Employee[]) {
  const seedErrors = await ensureAcademyCourses();
  const active = employees.filter(e => e.status !== 'inactive' && e.status !== 'terminated');
  for (const employee of active) {
    await assignAcademyForEmployee(employee);
  }
  return seedErrors;
}
