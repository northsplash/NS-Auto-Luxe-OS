const KEY = 'ns_owner_board_filter_v1';
const JOB_KEY = 'ns_owner_focus_job_v1';

export type OwnerBoardFilter = 'unassigned' | 'run' | 'collect' | '';

export function setOwnerBoardFilter(filter: OwnerBoardFilter) {
  try {
    if (filter) sessionStorage.setItem(KEY, filter);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function takeOwnerBoardFilter(): OwnerBoardFilter {
  try {
    const value = sessionStorage.getItem(KEY) as OwnerBoardFilter | null;
    sessionStorage.removeItem(KEY);
    if (value === 'unassigned' || value === 'run' || value === 'collect') return value;
  } catch {
    /* private mode */
  }
  return '';
}

export function setOwnerFocusJob(id: string) {
  try {
    if (id) sessionStorage.setItem(JOB_KEY, id);
    else sessionStorage.removeItem(JOB_KEY);
  } catch {
    /* private mode */
  }
}

export function takeOwnerFocusJob() {
  try {
    const value = sessionStorage.getItem(JOB_KEY);
    sessionStorage.removeItem(JOB_KEY);
    return value || '';
  } catch {
    return '';
  }
}
