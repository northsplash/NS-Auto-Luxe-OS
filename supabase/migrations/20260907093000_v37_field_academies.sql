-- V37: Expanded door-to-door and detailing field academies.
-- Lesson bodies and quizzes are upserted from the OS (People → Training → Apply academies).

update public.training_courses
set
  title = 'Door-to-door field academy',
  description = 'The North Splash street playbook: territory, knock colors, the door script, objections, the nine selves, the live pitch, and opening a customer account. Pass this before you canvass solo.',
  duration_minutes = 75,
  passing_score = 80,
  manager_signoff_required = true,
  status = 'active',
  updated_at = now()
where id = '7c0d2d00-a1b2-4c3d-8e9f-000000000001';

update public.training_courses
set
  title = 'Detailing field academy',
  description = 'The North Splash job: packet, Uber-style live status, inspection, the nine selves, photos, checklist, QC, and when you are allowed to run solo.',
  duration_minutes = 80,
  passing_score = 80,
  manager_signoff_required = true,
  status = 'active',
  updated_at = now()
where id = '7c0d3700-a1b2-4c3d-8e9f-000000000002';
