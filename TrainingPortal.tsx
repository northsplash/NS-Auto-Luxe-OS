import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, ChevronRight, Clock3, FileText, PlayCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Employee, TrainingAssignment, TrainingCourse, TrainingLesson, TrainingOption, TrainingQuestion } from '@/lib/supabase';

export default function TrainingPortal({ employee }: { employee: Employee }) {
  const [assignments,setAssignments]=useState<TrainingAssignment[]>([]);
  const [courses,setCourses]=useState<TrainingCourse[]>([]);
  const [lessons,setLessons]=useState<TrainingLesson[]>([]);
  const [questions,setQuestions]=useState<TrainingQuestion[]>([]);
  const [options,setOptions]=useState<TrainingOption[]>([]);
  const [active,setActive]=useState<TrainingAssignment|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);

  const load=async()=>{
    setLoading(true);
    const [a,c]=await Promise.all([
      supabase.from('training_assignments').select('*').eq('employee_id',employee.id).order('assigned_at',{ascending:false}),
      supabase.from('training_courses').select('*').eq('status','active').order('created_at'),
    ]);
    setAssignments(a.data??[]);setCourses(c.data??[]);setLoading(false);
  };
  useEffect(()=>{load()},[employee.id]);

  const openCourse=async(assignment:TrainingAssignment)=>{
    setActive(assignment);setAnswers({});
    const [l,q]=await Promise.all([
      supabase.from('training_lessons').select('*').eq('course_id',assignment.course_id).order('sort_order'),
      supabase.from('training_questions').select('*').eq('course_id',assignment.course_id).order('sort_order'),
    ]);
    setLessons(l.data??[]);setQuestions(q.data??[]);
    const ids=(q.data??[]).map(x=>x.id);
    if(ids.length){const o=await supabase.from('training_question_options').select('id,question_id,label,sort_order').in('question_id',ids).order('sort_order');setOptions((o.data??[]) as TrainingOption[])}else setOptions([]);
    if(assignment.status==='assigned'){
      await supabase.from('training_assignments').update({status:'in_progress',started_at:new Date().toISOString()}).eq('id',assignment.id);
      setAssignments(p=>p.map(x=>x.id===assignment.id?{...x,status:'in_progress',started_at:new Date().toISOString()}:x));
    }
  };

  const submit=async()=>{
    if(!active)return;
    const course=courses.find(c=>c.id===active.course_id);
    if(!questions.length){
      const passed=true;
      const status=course?.manager_signoff_required?'awaiting_signoff':'completed';
      const {error}=await supabase.from('training_assignments').update({status,score:100,passed,completed_at:course?.manager_signoff_required?null:new Date().toISOString(),manager_signoff_status:course?.manager_signoff_required?'pending':'not_required'}).eq('id',active.id);
      if(error)return alert(error.message);setActive(null);await load();return;
    }
    const optionIds=Object.values(answers).filter(Boolean);
    const {data:truth,error:truthError}=await supabase.from('training_question_options').select('id,question_id,is_correct').in('question_id',questions.map(q=>q.id));
    if(truthError)return alert(truthError.message);
    const byQuestion=new Map<string,string>();optionIds.forEach(id=>{const found=(truth??[]).find((x:any)=>x.id===id);if(found)byQuestion.set(found.question_id,id)});
    let earned=0,total=0;
    questions.forEach(q=>{total+=Number(q.points||1);const selected=byQuestion.get(q.id);const found=(truth??[]).find((x:any)=>x.id===selected);if(found?.is_correct)earned+=Number(q.points||1)});
    const score=total?Math.round(earned/total*100):100;const passed=score>=Number(course?.passing_score??80);
    await supabase.from('training_attempts').insert({assignment_id:active.id,employee_id:employee.id,course_id:active.course_id,score,passed,answers});
    const status=passed?(course?.manager_signoff_required?'awaiting_signoff':'completed'):'in_progress';
    const {error}=await supabase.from('training_assignments').update({status,score,passed,completed_at:passed&&!course?.manager_signoff_required?new Date().toISOString():null,manager_signoff_status:passed&&course?.manager_signoff_required?'pending':'not_required'}).eq('id',active.id);
    if(error)return alert(error.message);
    alert(passed?`Passed with ${score}%.${course?.manager_signoff_required?' Manager skill sign-off is still required.':''}`:`Score: ${score}%. Passing score is ${course?.passing_score??80}%. Review the course and try again.`);
    setActive(null);await load();
  };

  const courseMap=useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses]);
  if(loading)return <div className="ns-empty">Loading training…</div>;
  if(active){const course=courseMap.get(active.course_id);return <div className="training-course-view"><button className="btn-outline" onClick={()=>setActive(null)}>← Training Center</button><div className="training-course-hero"><div><span className="eyebrow">TRAINING MODULE</span><h2>{course?.title||'Course'}</h2><p>{course?.description||'Complete the lessons and assessment below.'}</p></div><Award size={34}/></div><div className="training-lesson-list">{lessons.map((l,i)=><div className="training-lesson" key={l.id}><span className="training-step">{i+1}</span><div><strong>{l.title}</strong>{l.lesson_type==='video'&&l.media_url?<a href={l.media_url} target="_blank" rel="noreferrer"><PlayCircle size={15}/> Open video</a>:l.lesson_type==='pdf'&&l.media_url?<a href={l.media_url} target="_blank" rel="noreferrer"><FileText size={15}/> Open document</a>:<p>{l.content}</p>}</div></div>)}</div>{questions.length>0&&<div className="training-quiz"><div className="tab-header"><div><h3>Knowledge Check</h3><p>Passing score: {course?.passing_score??80}%</p></div></div>{questions.map((q,i)=><div className="quiz-question" key={q.id}><strong>{i+1}. {q.prompt}</strong><div className="quiz-options">{options.filter(o=>o.question_id===q.id).map(o=><label key={o.id}><input type="radio" name={q.id} checked={answers[q.id]===o.id} onChange={()=>setAnswers(p=>({...p,[q.id]:o.id}))}/><span>{o.label}</span></label>)}</div></div>)}</div>}<button className="btn-primary btn-full" disabled={questions.length>0&&questions.some(q=>!answers[q.id])} onClick={submit}>{questions.length?'Submit Assessment':'Complete Course'}</button></div>}
  return <div className="training-dashboard"><div className="training-summary"><div><span>Assigned</span><strong>{assignments.length}</strong></div><div><span>Completed</span><strong>{assignments.filter(a=>a.status==='completed').length}</strong></div><div><span>In Progress</span><strong>{assignments.filter(a=>['in_progress','awaiting_signoff'].includes(a.status)).length}</strong></div><div><span>Passed</span><strong>{assignments.filter(a=>a.passed).length}</strong></div></div><div className="training-card-grid">{assignments.map(a=>{const c=courseMap.get(a.course_id);const complete=a.status==='completed';const failed=a.passed===false;return <button className="training-card" key={a.id} onClick={()=>openCourse(a)}><div className="training-card-icon">{complete?<CheckCircle2/>:failed?<XCircle/>:<BookOpen/>}</div><div><small>{c?.category||'Training'}</small><h3>{c?.title||'Assigned course'}</h3><p>{c?.description||'Open this module to continue.'}</p><div className="training-meta"><span><Clock3 size={13}/>{c?.duration_minutes||15} min</span>{a.score!=null&&<span>{a.score}%</span>}<span>{a.status.replaceAll('_',' ')}</span></div></div><ChevronRight/></button>})}{!assignments.length&&<div className="ns-empty">No training has been assigned yet.</div>}</div></div>;
}
