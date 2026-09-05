import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeOwnerPlanningConfig, OWNER_PLAN_DEFAULTS, OwnerPlanningConfig, OwnerWeekOverride } from '@/lib/ownerPlanning';

const MODEL_ID = 'north-splash-auto-luxe';

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
      if (loadError) setError(loadError.message);
      setConfig(normalizeOwnerPlanningConfig(data?.assumptions));
      setSavedAt(data?.updated_at || '');
      setLoading(false);
    })().catch((e) => {
      if (!live) return;
      setError(e instanceof Error ? e.message : 'Unable to load owner plan.');
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
    const { error: saveError } = await supabase.from('owner_profit_settings').upsert({ id: MODEL_ID, assumptions: payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (saveError) setError(saveError.message);
    else { setDirty(false); setSavedAt(new Date().toISOString()); }
    setSaving(false);
    return !saveError;
  }, [config]);

  const reset = useCallback(() => {
    setConfig(OWNER_PLAN_DEFAULTS);
    setDirty(true);
  }, []);

  return useMemo(() => ({ config, loading, saving, dirty, error, savedAt, update, patch, setWeekOverride, clearWeekOverride, save, reset }), [config, loading, saving, dirty, error, savedAt, update, patch, setWeekOverride, clearWeekOverride, save, reset]);
}
