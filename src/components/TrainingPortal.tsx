import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, ChevronRight, Clock3, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Employee, TrainingAssignment, TrainingCourse, TrainingLesson, TrainingOption, TrainingQuestion } from '@/lib/supabase';
import {
  ACADEMY_COURSES,
  academyById,
  academyLessons,
  academyQuestions,
  asTrainingCourse,
  assignAcademyForEmployee,
  courseIdsForEmployee,
  gradeAcademy,
  readLocalAcademyProgress,
  writeLocalAcademyProgress,
} from '@/lib/trainingAcademy';
import { employeeCanD2D, employeeCanDetail } from '@/lib/workCapabilities';
import { DOOR_STATUSES } from '@/lib/fieldOps';

const LIVE_STEPS = ['Booked', 'En route', 'On site', 'In progress', 'Done'] as const;

function mergeCourses(db: TrainingCourse[]): TrainingCourse[] {
  const map = new Map<string, TrainingCourse>();
  ACADEMY_COURSES.forEach(c => map.set(c.id, asTrainingCourse(c)));
  db.forEach(c => map.set(c.id, c));
  return [...map.values()];
}

function localAssignment(employee: Employee, courseId: string, stored?: Partial<TrainingAssignment>): TrainingAssignment {
  return {
    id: stored?.id || `local-${courseId}`,
    course_id: courseId,
    employee_id: employee.id,
    status: stored?.status || 'assigned',
    assigned_at: stored?.assigned_at || new Date().toISOString(),
    due_at: stored?.due_at ?? null,
    started_at: stored?.started_at ?? null,
    completed_at: stored?.completed_at ?? null,
    score: stored?.score ?? null,
    passed: stored?.passed ?? null,
    manager_signoff_status: stored?.manager_signoff_status || 'pending',
    created_at: stored?.created_at || new Date().toISOString(),
  };
}

export default function TrainingPortal({ employee }: { employee: Employee }) {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>(() => ACADEMY_COURSES.map(asTrainingCourse));
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [options, setOptions] = useState<TrainingOption[]>([]);
  const [active, setActive] = useState<TrainingAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [result, setResult] = useState<string>('');

  const load = async () => {
    setLoading(true);
    await assignAcademyForEmployee(employee);
    const [a, c] = await Promise.all([
      supabase.from('training_assignments').select('*').eq('employee_id', employee.id).order('assigned_at', { ascending: false }),
      supabase.from('training_courses').select('*').eq('status', 'active').order('created_at'),
    ]);
    const dbCourses = mergeCourses((c.data ?? []) as TrainingCourse[]);
    setCourses(dbCourses);
    const dbAssign = (a.data ?? []) as TrainingAssignment[];
    const local = readLocalAcademyProgress(employee.id);
    const needed = courseIdsForEmployee(employee);
    const merged = [...dbAssign];
    needed.forEach(id => {
      if (!merged.some(x => x.course_id === id)) merged.push(localAssignment(employee, id, local[id]));
    });
    setAssignments(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, [employee.id]);

  const openCourse = async (assignment: TrainingAssignment) => {
    setActive(assignment);
    setAnswers({});
    setResult('');
    const academy = academyById(assignment.course_id);
    const [l, q] = await Promise.all([
      supabase.from('training_lessons').select('*').eq('course_id', assignment.course_id).order('sort_order'),
      supabase.from('training_questions').select('*').eq('course_id', assignment.course_id).order('sort_order'),
    ]);
    const dbLessons = (l.data ?? []) as TrainingLesson[];
    setLessons(dbLessons.length ? dbLessons : academyLessons(assignment.course_id));
    const dbQuestions = (q.data ?? []) as TrainingQuestion[];
    if (dbQuestions.length) {
      setQuestions(dbQuestions);
      const ids = dbQuestions.map(x => x.id);
      const o = await supabase.from('training_question_options').select('id,question_id,label,sort_order').in('question_id', ids).order('sort_order');
      setOptions((o.data ?? []) as TrainingOption[]);
    } else if (academy) {
      const pack = academyQuestions(assignment.course_id);
      setQuestions(pack.questions);
      setOptions(pack.options);
    } else {
      setQuestions([]);
      setOptions([]);
    }
    if (assignment.status === 'assigned') {
      const started = new Date().toISOString();
      if (!assignment.id.startsWith('local-')) {
        await supabase.from('training_assignments').update({ status: 'in_progress', started_at: started }).eq('id', assignment.id);
      }
      writeLocalAcademyProgress(employee.id, assignment.course_id, { status: 'in_progress', started_at: started });
      setAssignments(p => p.map(x => x.id === assignment.id ? { ...x, status: 'in_progress', started_at: started } : x));
      setActive(p => p ? { ...p, status: 'in_progress', started_at: started } : p);
    }
  };

  const submit = async () => {
    if (!active) return;
    setSubmitBusy(true);
    const course = courses.find(c => c.id === active.course_id);
    const academy = academyById(active.course_id);
    let score = 100;
    let passed = true;
    if (academy && academy.questions.length) {
      const graded = gradeAcademy(active.course_id, answers);
      score = graded.score;
      passed = graded.passed;
    } else if (questions.length) {
      const { data: truth, error: truthError } = await supabase.from('training_question_options').select('id,question_id,is_correct').in('question_id', questions.map(q => q.id));
      if (truthError) { setSubmitBusy(false); return alert(truthError.message); }
      let earned = 0, total = 0;
      questions.forEach(q => {
        total += Number(q.points || 1);
        const selected = answers[q.id];
        const found = (truth ?? []).find((x: { id: string; is_correct?: boolean }) => x.id === selected);
        if (found?.is_correct) earned += Number(q.points || 1);
      });
      score = total ? Math.round(earned / total * 100) : 100;
      passed = score >= Number(course?.passing_score ?? 80);
    }
    const needsSignoff = Boolean(course?.manager_signoff_required || academy?.manager_signoff_required);
    const status = passed ? (needsSignoff ? 'awaiting_signoff' : 'completed') : 'in_progress';
    const completedAt = passed && !needsSignoff ? new Date().toISOString() : null;
    const patch = {
      status,
      score,
      passed,
      completed_at: completedAt,
      manager_signoff_status: passed && needsSignoff ? 'pending' : 'not_required',
    };
    if (!active.id.startsWith('local-')) {
      await supabase.from('training_attempts').insert({
        assignment_id: active.id,
        employee_id: employee.id,
        course_id: active.course_id,
        score,
        passed,
        answers,
      });
      const { error } = await supabase.from('training_assignments').update(patch).eq('id', active.id);
      if (error) console.warn(error.message);
    }
    writeLocalAcademyProgress(employee.id, active.course_id, patch);
    setSubmitBusy(false);
    setResult(passed
      ? `Passed with ${score}%.${needsSignoff ? ' A manager still signs off after they watch you in the field.' : ''}`
      : `Score: ${score}%. Passing is ${course?.passing_score ?? academy?.passing_score ?? 80}%. Review the lessons and try again.`);
    await load();
  };

  const courseMap = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses]);
  const mine = courseIdsForEmployee(employee);
  const cards = assignments.filter(a => mine.includes(a.course_id) || !ACADEMY_COURSES.some(c => c.id === a.course_id));
  const incomplete = cards.filter(a => a.status !== 'completed');

  if (loading) return <div className="ns-empty">Loading training…</div>;

  if (active) {
    const course = courseMap.get(active.course_id);
    const academy = academyById(active.course_id);
    return (
      <div className="training-course-view academy-course-v30">
        <button className="btn-outline" onClick={() => { setActive(null); setResult(''); }}>← Training</button>
        <div className="training-course-hero">
          <div>
            <span className="eyebrow">{academy ? `NEW HIRE · ${academy.modeled.toUpperCase()}` : 'TRAINING MODULE'}</span>
            <h2>{course?.title || academy?.title || 'Course'}</h2>
            <p>{course?.description || academy?.description}</p>
          </div>
          <Award size={34} />
        </div>
        {academy?.track === 'd2d' && (
          <div className="academy-knock-legend">
            {DOOR_STATUSES.slice(0, 10).map(s => (
              <span key={s.key}><i style={{ background: s.color }} />{s.short}</span>
            ))}
          </div>
        )}
        {academy?.track === 'detail' && (
          <div className="uber-live-tracker academy-status-demo" aria-hidden>
            {LIVE_STEPS.map((label, i) => (
              <div key={label} className={i === 0 ? 'current' : ''}><b>{label}</b>Tap this on the live job</div>
            ))}
          </div>
        )}
        <div className="training-lesson-list">
          {lessons.map((l, i) => (
            <article className="training-lesson" key={l.id}>
              <span className="training-step">{i + 1}</span>
              <div>
                <strong>{l.title}</strong>
                {String(l.content || '').split('\n\n').map((para, pi) => <p key={pi}>{para}</p>)}
              </div>
            </article>
          ))}
        </div>
        {questions.length > 0 && (
          <div className="training-quiz">
            <div className="tab-header">
              <div>
                <h3>Knowledge check</h3>
                <p>Passing score: {course?.passing_score ?? academy?.passing_score ?? 80}%</p>
              </div>
            </div>
            {questions.map((q, i) => (
              <div className="quiz-question" key={q.id}>
                <strong>{i + 1}. {q.prompt}</strong>
                <div className="quiz-options">
                  {options.filter(o => o.question_id === q.id).map(o => (
                    <label key={o.id}>
                      <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers(p => ({ ...p, [q.id]: o.id }))} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {result && <p className={result.startsWith('Passed') ? 'academy-result pass' : 'academy-result retry'}>{result}</p>}
        <button className="btn-primary btn-full" disabled={submitBusy || (questions.length > 0 && questions.some(q => !answers[q.id]))} onClick={submit}>
          {submitBusy ? 'Scoring…' : questions.length ? 'Submit assessment' : 'Complete course'}
        </button>
      </div>
    );
  }

  return (
    <div className="training-dashboard academy-dashboard-v30">
      <header className="ws-hero">
        <div className="ws-hero-copy">
          <p className="ws-hero-kicker">
            Academy
            <span className="ws-hero-modeled">Modeled after Gusto onboarding + SalesRabbit playbooks</span>
          </p>
          <h1 className="ws-hero-title">New-hire training</h1>
          <p className="ws-hero-lead">
            {employeeCanD2D(employee) && employeeCanDetail(employee)
              ? 'Door scripts and detailing standards. Pass both, then a manager signs off in the field.'
              : employeeCanD2D(employee)
                ? 'Finish the door-to-door academy before you canvass live. A manager still walks one street with you.'
                : 'Finish the detailing academy before you run jobs solo. A manager still watches one live job.'}
          </p>
        </div>
      </header>
      {incomplete.length > 0 && (
        <div className="academy-hire-banner">
          <BookOpen size={18} />
          <div>
            <strong>{incomplete.length} module{incomplete.length === 1 ? '' : 's'} left</strong>
            <span>Required for new hires. Open a card, read the lessons, then take the quiz.</span>
          </div>
        </div>
      )}
      <div className="training-summary">
        <div><span>Assigned</span><strong>{cards.length}</strong></div>
        <div><span>In progress</span><strong>{cards.filter(a => ['in_progress', 'awaiting_signoff'].includes(a.status)).length}</strong></div>
        <div><span>Passed</span><strong>{cards.filter(a => a.passed).length}</strong></div>
        <div><span>Sign-off</span><strong>{cards.filter(a => a.status === 'awaiting_signoff').length}</strong></div>
      </div>
      <div className="training-card-grid">
        {cards.map(a => {
          const c = courseMap.get(a.course_id);
          const academy = academyById(a.course_id);
          const complete = a.status === 'completed';
          const failed = a.passed === false;
          return (
            <button className="training-card" key={a.id} onClick={() => openCourse(a)}>
              <div className="training-card-icon">{complete ? <CheckCircle2 /> : failed ? <XCircle /> : <BookOpen />}</div>
              <div>
                <small>{academy?.modeled || c?.category || 'Training'}</small>
                <h3>{c?.title || academy?.title || 'Assigned course'}</h3>
                <p>{c?.description || academy?.description}</p>
                <div className="training-meta">
                  <span><Clock3 size={13} />{c?.duration_minutes || academy?.duration_minutes || 15} min</span>
                  {a.score != null && <span>{a.score}%</span>}
                  <span>{a.status.replaceAll('_', ' ')}</span>
                </div>
              </div>
              <ChevronRight />
            </button>
          );
        })}
      </div>
    </div>
  );
}
