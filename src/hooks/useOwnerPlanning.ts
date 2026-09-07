import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeOwnerPlanningConfig, OWNER_PLAN_DEFAULTS, OwnerPlanningConfig, OwnerWeekOverride } from '@/lib/ownerPlanning';

const MODEL_ID = 'north-splash-auto-luxe';
const LOCAL_KEY = 'ns-owner-plan-v1';

function readLocal(): OwnerPlanningConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return normalizeOwnerPlanningConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocal(config: OwnerPlanningConfig) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(config)); } catch { /* ignore quota */ }
}

function isAccessError(message: string) {
  return /permission denied|row-level security|does not exist|schema cache/i.test(message);
}

export function useOwnerPlanning() {
  const [config, setConfig] = useState<OwnerPlanningConfig>(OWNER_PLAN_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string>('');

  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error: loadError } = await supabase.from('owner_profit_settings').select('assumptions,updated_at').eq('id', MODEL_ID).maybeSingle();
      if (!live) return;
      if (loadError) {
        const local = readLocal();
        if (local) setConfig(local);
        if (!isAccessError(loadError.message)) setError(loadError.message);
      } else {
        const next = normalizeOwnerPlanningConfig(data?.assumptions);
        setConfig(next);
        writeLocal(next);
        setSavedAt(data?.updated_at || '');
      }
      setLoading(false);
    })().catch((e) => {
      if (!live) return;
      const message = e instanceof Error ? e.message : 'Unable to load owner plan.';
      const local = readLocal();
      if (local) setConfig(local);
      if (!isAccessError(message)) setError(message);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const update = useCallback(<K extends keyof OwnerPlanningConfig>(key: K, value: OwnerPlanningConfig[K]) => {
    setConfig((current) => normalizeOwnerPlanningConfig({ ...current, [key]: value }));
    setDirty(true);
  }, []);

  const patch = useCallback((values: Partial<OwnerPlanningConfig>) => {
    setConfig((current) => normalizeOwnerPlanningConfig({ ...current, ...values }));
    setDirty(true);
  }, []);

  const setWeekOverride = useCallback((week: number, values: Partial<OwnerWeekOverride>) => {
    setConfig((current) => {
      const previous = current.weeklyOverrides[String(week)] || {};
      const next = { ...previous, ...values } as Record<string, any>;
      Object.keys(next).forEach((key) => {
        if (next[key] === '' || next[key] === null || next[key] === undefined || Number.isNaN(next[key])) delete next[key];
      });
      return { ...current, weeklyOverrides: { ...current.weeklyOverrides, [String(week)]: next } };
    });
    setDirty(true);
  }, []);

  const clearWeekOverride = useCallback((week: number) => {
    setConfig((current) => {
      const overrides = { ...current.weeklyOverrides };
      delete overrides[String(week)];
      return { ...current, weeklyOverrides: overrides };
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError('');
    const payload = normalizeOwnerPlanningConfig(config);
    writeLocal(payload);
    const { error: saveError } = await supabase.from('owner_profit_settings').upsert({ id: MODEL_ID, assumptions: payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (saveError) {
      if (isAccessError(saveError.message)) {
        setDirty(false);
        setSavedAt(new Date().toISOString());
      } else {
        setError(saveError.message);
      }
    } else {
      setDirty(false);
      setSavedAt(new Date().toISOString());
    }
    setSaving(false);
    return !saveError || isAccessError(saveError.message);
  }, [config]);

  const reset = useCallback(() => {
    setConfig(OWNER_PLAN_DEFAULTS);
    setDirty(true);
  }, []);

  return useMemo(() => ({ config, loading, saving, dirty, error, savedAt, update, patch, setWeekOverride, clearWeekOverride, save, reset }), [config, loading, saving, dirty, error, savedAt, update, patch, setWeekOverride, clearWeekOverride, save, reset]);
}
