import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock3, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Employee, TrainingAssignment, TrainingCourse, TrainingLesson, TrainingOption, TrainingQuestion } from '@/lib/supabase';
import { prettyLabel } from '@/lib/data';
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
  academyPreviewEmployee,
} from '@/lib/trainingAcademy';
import { employeeCanD2D, employeeCanDetail } from '@/lib/workCapabilities';
import { DOOR_STATUSES } from '@/lib/fieldOps';

const LIVE_STEPS = ['Booked', 'En route', 'On site', 'In progress', 'Done'] as const;

function mergeCourses(db: TrainingCourse[]): TrainingCourse[] {
  const map = new Map<string, TrainingCourse>();
  db.forEach((c) => map.set(c.id, c));
  ACADEMY_COURSES.forEach((c) => map.set(c.id, asTrainingCourse(c)));
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

function readKey(employeeId: string, courseId: string) {
  return `ns-academy-read-${employeeId}-${courseId}`;
}

type Phase = 'lessons' | 'drill' | 'quiz';

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
  const [result, setResult] = useState('');
  const [phase, setPhase] = useState<Phase>('lessons');
  const [lessonI, setLessonI] = useState(0);
  const [drillI, setDrillI] = useState(0);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [drillPick, setDrillPick] = useState('');
  const [drillNote, setDrillNote] = useState('');

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
    needed.forEach((id) => {
      if (!merged.some((x) => x.course_id === id)) merged.push(localAssignment(employee, id, local[id]));
    });
    setAssignments(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, [employee.id]);

  const openCourse = async (assignment: TrainingAssignment) => {
    setActive(assignment);
    setAnswers({});
    setResult('');
    setPhase('lessons');
    setLessonI(0);
    setDrillI(0);
    setDrillPick('');
    setDrillNote('');
    const academy = academyById(assignment.course_id);
    try {
      const stored = JSON.parse(localStorage.getItem(readKey(employee.id, assignment.course_id)) || '[]');
      setReadIds(Array.isArray(stored) ? stored : []);
    } catch {
      setReadIds([]);
    }
    if (academy) {
      setLessons(academyLessons(assignment.course_id));
      const pack = academyQuestions(assignment.course_id);
      setQuestions(pack.questions);
      setOptions(pack.options);
    } else {
      const [l, q] = await Promise.all([
        supabase.from('training_lessons').select('*').eq('course_id', assignment.course_id).order('sort_order'),
        supabase.from('training_questions').select('*').eq('course_id', assignment.course_id).order('sort_order'),
      ]);
      setLessons((l.data ?? []) as TrainingLesson[]);
      const dbQuestions = (q.data ?? []) as TrainingQuestion[];
      setQuestions(dbQuestions);
      if (dbQuestions.length) {
        const o = await supabase.from('training_question_options').select('id,question_id,label,sort_order').in('question_id', dbQuestions.map((x) => x.id)).order('sort_order');
        setOptions((o.data ?? []) as TrainingOption[]);
      } else setOptions([]);
    }
    if (assignment.status === 'assigned') {
      const started = new Date().toISOString();
      if (!assignment.id.startsWith('local-') && !assignment.id.startsWith('preview-')) {
        await supabase.from('training_assignments').update({ status: 'in_progress', started_at: started }).eq('id', assignment.id);
      }
      writeLocalAcademyProgress(employee.id, assignment.course_id, { status: 'in_progress', started_at: started });
      setAssignments((p) => p.map((x) => x.id === assignment.id ? { ...x, status: 'in_progress', started_at: started } : x));
      setActive((p) => (p ? { ...p, status: 'in_progress', started_at: started } : p));
    }
  };

  const markLessonRead = (id: string) => {
    if (!active) return;
    const next = readIds.includes(id) ? readIds : [...readIds, id];
    setReadIds(next);
    localStorage.setItem(readKey(employee.id, active.course_id), JSON.stringify(next));
  };

  const submit = async () => {
    if (!active) return;
    setSubmitBusy(true);
    const course = courses.find((c) => c.id === active.course_id);
    const academy = academyById(active.course_id);
    let score = 100;
    let passed = true;
    if (academy && academy.questions.length) {
      const graded = gradeAcademy(active.course_id, answers);
      score = graded.score;
      passed = graded.passed;
    } else if (questions.length) {
      const { data: truth, error: truthError } = await supabase.from('training_question_options').select('id,question_id,is_correct').in('question_id', questions.map((q) => q.id));
      if (truthError) { setSubmitBusy(false); return alert(truthError.message); }
      let earned = 0, total = 0;
      questions.forEach((q) => {
        total += Number(q.points || 1);
        const found = (truth ?? []).find((x: { id: string; is_correct?: boolean }) => x.id === answers[q.id]);
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
    if (!active.id.startsWith('local-') && !employee.id.startsWith('preview-')) {
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

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const mine = courseIdsForEmployee(employee);
  const cards = assignments.filter((a) => mine.includes(a.course_id) || !ACADEMY_COURSES.some((c) => c.id === a.course_id));
  const incomplete = cards.filter((a) => a.status !== 'completed');

  if (loading) return <div className="ns-empty">Loading training…</div>;

  if (active) {
    const course = courseMap.get(active.course_id);
    const academy = academyById(active.course_id);
    const lesson = academy?.lessons[lessonI];
    const allRead = academy ? academy.lessons.every((l) => readIds.includes(l.id)) : true;
    const drills = academy?.drills || [];
    const drill = drills[drillI];
    const drillCorrect = drill?.options.find((o) => o.is_correct);
    return (
      <div className="training-course-view academy-course-v30">
        <button className="btn-outline" onClick={() => { setActive(null); setResult(''); }}>← Training</button>
        <div className="training-course-hero">
          <div>
            <span className="eyebrow">{academy ? 'FIELD ACADEMY' : 'TRAINING MODULE'}</span>
            <h2>{course?.title || academy?.title || 'Course'}</h2>
            <p>{course?.description || academy?.description}</p>
          </div>
          <Award size={34} />
        </div>
        {academy && (
          <ol className="academy-phase-bar" aria-label="Academy steps">
            <li className={phase === 'lessons' ? 'active' : allRead ? 'done' : ''}><button type="button" onClick={() => setPhase('lessons')}>Lessons</button></li>
            <li className={phase === 'drill' ? 'active' : ''}><button type="button" disabled={!allRead} onClick={() => allRead && setPhase('drill')}>Drills</button></li>
            <li className={phase === 'quiz' ? 'active' : ''}><button type="button" disabled={!allRead} onClick={() => allRead && setPhase('quiz')}>Quiz</button></li>
          </ol>
        )}
        {academy?.track === 'd2d' && phase === 'lessons' && (
          <div className="academy-knock-legend">
            {DOOR_STATUSES.slice(0, 10).map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.short}</span>
            ))}
          </div>
        )}
        {academy?.track === 'detail' && phase === 'lessons' && (
          <div className="uber-live-tracker academy-status-demo" aria-hidden>
            {LIVE_STEPS.map((label, i) => (
              <div key={label} className={i === 0 ? 'current' : ''}><b>{label}</b>Tap this on the live job</div>
            ))}
          </div>
        )}

        {phase === 'lessons' && lesson && academy && (
          <div className="academy-lesson-stage">
            <p className="academy-lesson-count">Lesson {lessonI + 1} of {academy.lessons.length}</p>
            <article className="training-lesson">
              <span className="training-step">{lessonI + 1}</span>
              <div>
                <strong>{lesson.title}</strong>
                {lesson.content.split('\n\n').map((para, pi) => <p key={pi}>{para}</p>)}
                <ul className="academy-takeaways">
                  {lesson.takeaways.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </article>
            <div className="academy-lesson-nav">
              <button type="button" className="btn-outline" disabled={lessonI === 0} onClick={() => setLessonI((n) => Math.max(0, n - 1))}><ChevronLeft size={16} /> Back</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  markLessonRead(lesson.id);
                  if (lessonI < academy.lessons.length - 1) setLessonI((n) => n + 1);
                  else setPhase(drills.length ? 'drill' : 'quiz');
                }}
              >
                {lessonI < academy.lessons.length - 1 ? 'Got it — next' : drills.length ? 'Lessons done — drills' : 'Lessons done — quiz'} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {phase === 'lessons' && !academy && (
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
        )}

        {phase === 'drill' && drill && (
          <div className="academy-drill">
            <p className="academy-lesson-count">Field drill {drillI + 1} of {drills.length}</p>
            <h3>What do you do?</h3>
            <p>{drill.prompt}</p>
            <div className="quiz-options">
              {drill.options.map((o) => (
                <label key={o.id}>
                  <input type="radio" name={drill.id} checked={drillPick === o.id} onChange={() => { setDrillPick(o.id); setDrillNote(''); }} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            {drillNote && <p className={drillNote.startsWith('Correct') ? 'academy-result pass' : 'academy-result retry'}>{drillNote}</p>}
            <div className="academy-lesson-nav">
              <button type="button" className="btn-outline" onClick={() => { setPhase('lessons'); setLessonI((academy?.lessons.length || 1) - 1); }}>Back to lessons</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!drillPick}
                onClick={() => {
                  if (drillPick !== drillCorrect?.id) {
                    setDrillNote('Not yet. Read the takeaway on the last lesson and pick again.');
                    return;
                  }
                  setDrillNote('Correct. That is the North Splash standard.');
                  if (drillI < drills.length - 1) {
                    setDrillI((n) => n + 1);
                    setDrillPick('');
                    setDrillNote('');
                  } else {
                    setPhase('quiz');
                    setDrillPick('');
                    setDrillNote('');
                  }
                }}
              >
                {drillI < drills.length - 1 ? 'Check — next drill' : 'Check — take the quiz'}
              </button>
            </div>
          </div>
        )}

        {phase === 'quiz' && questions.length > 0 && (
          <div className="training-quiz">
            <div className="tab-header">
              <div>
                <h3>Knowledge check</h3>
                <p>Passing score: {course?.passing_score ?? academy?.passing_score ?? 80}%. {academy ? 'Eight questions. You already walked the drills.' : ''}</p>
              </div>
            </div>
            {questions.map((q, i) => (
              <div className="quiz-question" key={q.id}>
                <strong>{i + 1}. {q.prompt}</strong>
                <div className="quiz-options">
                  {options.filter((o) => o.question_id === q.id).map((o) => (
                    <label key={o.id}>
                      <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((p) => ({ ...p, [q.id]: o.id }))} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {result && <p className={result.startsWith('Passed') ? 'academy-result pass' : 'academy-result retry'}>{result}</p>}
            <button className="btn-primary btn-full" disabled={submitBusy || questions.some((q) => !answers[q.id])} onClick={submit}>
              {submitBusy ? 'Scoring…' : 'Submit assessment'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="training-dashboard academy-dashboard-v30">
      <header className="ws-hero">
        <div className="ws-hero-copy">
          <p className="ws-hero-kicker">Academy</p>
          <h1 className="ws-hero-title">Field training</h1>
          <p className="ws-hero-lead">
            {employeeCanD2D(employee) && employeeCanDetail(employee)
              ? 'Door scripts and detailing standards. Pass both, then a manager signs off in the field.'
              : employeeCanD2D(employee)
                ? 'Finish the door-to-door academy before you canvass live. Lessons, field drills, then the quiz. A manager still walks one street with you.'
                : 'Finish the detailing academy before you run jobs solo. Lessons, field drills, then the quiz. A manager still watches one live job.'}
          </p>
        </div>
      </header>
      {incomplete.length > 0 && (
        <div className="academy-hire-banner">
          <BookOpen size={18} />
          <div>
            <strong>{incomplete.length} module{incomplete.length === 1 ? '' : 's'} left</strong>
            <span>Read every lesson, pass the drills, then take the quiz. Manager sign-off still happens on a live street or job.</span>
          </div>
        </div>
      )}
      <div className="training-summary">
        <div><span>Assigned</span><strong>{cards.length}</strong></div>
        <div><span>In progress</span><strong>{cards.filter((a) => ['in_progress', 'awaiting_signoff'].includes(a.status)).length}</strong></div>
        <div><span>Passed</span><strong>{cards.filter((a) => a.passed).length}</strong></div>
        <div><span>Sign-off</span><strong>{cards.filter((a) => a.status === 'awaiting_signoff').length}</strong></div>
      </div>
      <div className="training-card-grid">
        {cards.map((a) => {
          const c = courseMap.get(a.course_id);
          const academy = academyById(a.course_id);
          const complete = a.status === 'completed';
          const failed = a.passed === false;
          return (
            <button className="training-card" key={a.id} onClick={() => openCourse(a)}>
              <div className="training-card-icon">{complete ? <CheckCircle2 /> : failed ? <XCircle /> : <BookOpen />}</div>
              <div>
                <small>{academy?.track === 'd2d' ? 'Door to door' : academy?.track === 'detail' ? 'Detailing' : c?.category || 'Training'}</small>
                <h3>{c?.title || academy?.title || 'Assigned course'}</h3>
                <p>{c?.description || academy?.description}</p>
                <div className="training-meta">
                  <span><Clock3 size={13} />{c?.duration_minutes || academy?.duration_minutes || 15} min</span>
                  <span>{academy ? `${academy.lessons.length} lessons` : ''}</span>
                  {a.score != null && <span>{a.score}%</span>}
                  <span>{prettyLabel(a.status)}</span>
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

export function AcademyPreview({ track }: { track: 'd2d' | 'detail' }) {
  const employee = useMemo(() => academyPreviewEmployee(track), [track]);
  return <TrainingPortal employee={employee} />;
}
