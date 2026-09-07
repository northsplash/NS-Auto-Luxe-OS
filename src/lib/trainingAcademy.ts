import { supabase, type Employee, type TrainingAssignment, type TrainingCourse, type TrainingLesson, type TrainingOption, type TrainingQuestion } from '@/lib/supabase';
import { employeeCanD2D, employeeCanDetail } from '@/lib/workCapabilities';
import { DETAIL_ACADEMY, DETAIL_ACADEMY_ID, D2D_ACADEMY, D2D_ACADEMY_ID, type AcademyCourse } from '@/lib/academyCourses';

export {
  DETAIL_ACADEMY_ID,
  D2D_ACADEMY_ID,
  type AcademyCourse,
  type AcademyDrill,
  type AcademyLesson,
  type AcademyQuestion,
  type AcademyQuizOption,
} from '@/lib/academyCourses';

export const ACADEMY_COURSES = [D2D_ACADEMY, DETAIL_ACADEMY];

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
  if (employee.id.startsWith('preview-')) return;
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

export function academyPreviewEmployee(track: 'd2d' | 'detail'): Employee {
  const d2d = track === 'd2d';
  return {
    id: d2d ? 'preview-d2d' : 'preview-detailer',
    name: d2d ? 'Jordan Hale' : 'Maya Ellison',
    role: d2d ? 'd2d_agent' : 'detailer',
    phone: '3309903956',
    email: d2d ? 'jordan.hale@northsplash.com' : 'maya.ellison@northsplash.com',
    hire_date: '2026-09-01',
    status: 'active',
    commission_rate: d2d ? 10 : 0,
    jobs_completed: 0,
    total_earnings: 0,
    notes: 'Academy preview',
    work_modes: [d2d ? 'd2d' : 'detailer'],
    title: d2d ? 'Door-to-door' : 'Mobile Detailer',
    created_at: new Date().toISOString(),
  };
}

export async function applyNewHireAcademy(employees: Employee[]) {
  const seedErrors = await ensureAcademyCourses();
  const active = employees.filter(e => e.status !== 'inactive' && e.status !== 'terminated');
  for (const employee of active) {
    await assignAcademyForEmployee(employee);
  }
  return seedErrors;
}
