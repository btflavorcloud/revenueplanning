'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '../supabase/client';
import { ScenarioWithData, GtmGroupWithSegments, Segment, ExecutionPlan } from '../types';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export function useScenarios() {
  const [scenarios, setScenarios] = useState<ScenarioWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const supabase = createClient();

  const fetchScenarios = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('scenarios')
        .select(`
          *,
          plans (
            *,
            gtm_groups (
              *,
              segments (*),
              gtm_execution_plans (*)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform execution plan from array to single object
      const transformedData = data?.map(scenario => ({
        ...scenario,
        plans: scenario.plans?.map((plan: any) => ({
          ...plan,
          gtm_groups: plan.gtm_groups?.map((gtm: any) => ({
            ...gtm,
            execution_plan: gtm.gtm_execution_plans?.[0] || null,
            gtm_execution_plans: undefined,
          })),
        })),
      }));

      setScenarios(transformedData as ScenarioWithData[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchScenarios();

    // Set up real-time subscriptions for collaborative editing
    const scenariosChannel = supabase
      .channel('scenarios-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scenarios' }, () => {
        setSyncing(true);
        fetchScenarios().then(() => {
          setSyncing(false);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => {
        setSyncing(true);
        fetchScenarios().then(() => {
          setSyncing(false);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtm_groups' }, () => {
        setSyncing(true);
        fetchScenarios().then(() => {
          setSyncing(false);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'segments' }, () => {
        setSyncing(true);
        fetchScenarios().then(() => {
          setSyncing(false);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gtm_execution_plans' }, () => {
        setSyncing(true);
        fetchScenarios().then(() => {
          setSyncing(false);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(scenariosChannel);
    };
  }, [fetchScenarios, supabase]);

  const createScenario = async (
    name: string,
    type: 'Baseline' | 'Stretch' | 'Custom' = 'Custom',
    targetShipments: number = 400000,
    rps: number = 40
  ) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('scenarios')
        .insert({
          user_id: SHARED_USER_ID,
          name,
          type,
          target_shipments: targetShipments,
          rps,
          collapsed: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create Baseline and Stretch plans for the new scenario
      const { error: plansError } = await supabase
        .from('plans')
        .insert([
          { scenario_id: data.id, type: 'Baseline', collapsed: false },
          { scenario_id: data.id, type: 'Stretch', collapsed: false },
        ]);

      if (plansError) throw plansError;

      await fetchScenarios();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateScenario = async (scenarioId: string, updates: Partial<ScenarioWithData>) => {
    try {
      setSaving(true);

      // Optimistic update
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario =>
          scenario.id === scenarioId ? { ...scenario, ...updates } : scenario
        )
      );

      const { error } = await supabase
        .from('scenarios')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scenarioId);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scenario');
      await fetchScenarios(); // Only refetch on error
    } finally {
      setSaving(false);
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', scenarioId);

      if (error) throw error;

      await fetchScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario');
    } finally {
      setSaving(false);
    }
  };

  const addGtmGroup = async (
    planId: string,
    name: string,
    type: 'Sales' | 'Marketing' | 'Partnerships' | 'Custom'
  ) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('gtm_groups')
        .insert({
          plan_id: planId,
          name,
          type,
          collapsed: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update - add the new GTM group to the plan
      if (data) {
        setScenarios(prevScenarios =>
          prevScenarios.map(scenario => ({
            ...scenario,
            plans: scenario.plans.map(plan =>
              plan.id === planId
                ? {
                    ...plan,
                    gtm_groups: [...plan.gtm_groups, { ...data, segments: [] }],
                  }
                : plan
            ),
          }))
        );
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add GTM group');
      await fetchScenarios(); // Only refetch on error
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateGtmGroup = async (gtmGroupId: string, updates: Partial<GtmGroupWithSegments>) => {
    try {
      setSaving(true);

      // Optimistic update
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario => ({
          ...scenario,
          plans: scenario.plans.map(plan => ({
            ...plan,
            gtm_groups: plan.gtm_groups.map(gtm =>
              gtm.id === gtmGroupId ? { ...gtm, ...updates } : gtm
            ),
          })),
        }))
      );

      const { error } = await supabase
        .from('gtm_groups')
        .update(updates)
        .eq('id', gtmGroupId);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update GTM group');
      await fetchScenarios(); // Only refetch on error
    } finally {
      setSaving(false);
    }
  };

  const deleteGtmGroup = async (gtmGroupId: string) => {
    try {
      setSaving(true);

      // Optimistic update - remove the GTM group
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario => ({
          ...scenario,
          plans: scenario.plans.map(plan => ({
            ...plan,
            gtm_groups: plan.gtm_groups.filter(gtm => gtm.id !== gtmGroupId),
          })),
        }))
      );

      const { error } = await supabase
        .from('gtm_groups')
        .delete()
        .eq('id', gtmGroupId);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete GTM group');
      await fetchScenarios(); // Only refetch on error
    } finally {
      setSaving(false);
    }
  };

  const addSegment = async (
    gtmGroupId: string,
    segmentType: 'SMB' | 'MM' | 'ENT' | 'ENT+' | 'Flagship',
    spm: number
  ) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('segments')
        .insert({
          gtm_group_id: gtmGroupId,
          segment_type: segmentType,
          spm,
          launches: Array(12).fill(0),
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update - add the new segment to the GTM group
      if (data) {
        setScenarios(prevScenarios =>
          prevScenarios.map(scenario => ({
            ...scenario,
            plans: scenario.plans.map(plan => ({
              ...plan,
              gtm_groups: plan.gtm_groups.map(gtm =>
                gtm.id === gtmGroupId
                  ? { ...gtm, segments: [...gtm.segments, data] }
                  : gtm
              ),
            })),
          }))
        );
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add segment');
      await fetchScenarios(); // Only refetch on error
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateSegment = async (segmentId: string, updates: Partial<Segment>) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('segments')
        .update(updates)
        .eq('id', segmentId);

      if (error) throw error;

      // Optimistic update
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario => ({
          ...scenario,
          plans: scenario.plans.map(plan => ({
            ...plan,
            gtm_groups: plan.gtm_groups.map(gtm => ({
              ...gtm,
              segments: gtm.segments.map(seg =>
                seg.id === segmentId ? { ...seg, ...updates } : seg
              ),
            })),
          })),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update segment');
      await fetchScenarios(); // Refetch on error
    } finally {
      setSaving(false);
    }
  };

  const deleteSegment = async (segmentId: string) => {
    try {
      setSaving(true);

      // Optimistic update - remove the segment
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario => ({
          ...scenario,
          plans: scenario.plans.map(plan => ({
            ...plan,
            gtm_groups: plan.gtm_groups.map(gtm => ({
              ...gtm,
              segments: gtm.segments.filter(seg => seg.id !== segmentId),
            })),
          })),
        }))
      );

      const { error } = await supabase
        .from('segments')
        .delete()
        .eq('id', segmentId);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete segment');
      await fetchScenarios(); // Only refetch on error
    } finally {
      setSaving(false);
    }
  };

  const duplicateScenario = async (scenarioId: string) => {
    try {
      setSaving(true);

      // Fetch the scenario with all nested data
      const { data: scenario, error: fetchError} = await supabase
        .from('scenarios')
        .select(`
          *,
          plans (
            *,
            gtm_groups (
              *,
              segments (*)
            )
          )
        `)
        .eq('id', scenarioId)
        .single();

      if (fetchError) throw fetchError;

      // Create new scenario
      const { data: newScenario, error: createError } = await supabase
        .from('scenarios')
        .insert({
          user_id: scenario.user_id,
          name: `${scenario.name} (Copy)`,
          type: scenario.type,
          target_shipments: scenario.target_shipments,
          rps: scenario.rps,
          collapsed: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate plans, GTM groups, and segments
      for (const plan of (scenario as any).plans) {
        const { data: newPlan, error: planError } = await supabase
          .from('plans')
          .insert({
            scenario_id: newScenario.id,
            type: plan.type,
            collapsed: plan.collapsed,
          })
          .select()
          .single();

        if (planError) throw planError;

        // Duplicate GTM groups under this plan
        for (const gtmGroup of plan.gtm_groups) {
          const { data: newGtmGroup, error: gtmError } = await supabase
            .from('gtm_groups')
            .insert({
              plan_id: newPlan.id,
              name: gtmGroup.name,
              type: gtmGroup.type,
              collapsed: gtmGroup.collapsed,
              sort_order: gtmGroup.sort_order,
            })
            .select()
            .single();

          if (gtmError) throw gtmError;

          // Duplicate segments
          const segmentInserts = gtmGroup.segments.map((segment: any) => ({
            gtm_group_id: newGtmGroup.id,
            segment_type: segment.segment_type,
            spm: segment.spm,
            launches: segment.launches,
          }));

          const { error: segmentError } = await supabase
            .from('segments')
            .insert(segmentInserts);

          if (segmentError) throw segmentError;
        }
      }

      await fetchScenarios();
      return newScenario;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate scenario');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateExecutionPlan = async (gtmGroupId: string, updates: Partial<ExecutionPlan>) => {
    try {
      setSaving(true);

      // Check if execution plan exists
      const { data: existingPlan } = await supabase
        .from('gtm_execution_plans')
        .select('id')
        .eq('gtm_group_id', gtmGroupId)
        .single();

      if (existingPlan) {
        // Update existing plan
        const { error } = await supabase
          .from('gtm_execution_plans')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('gtm_group_id', gtmGroupId);

        if (error) throw error;
      } else {
        // Create new plan
        const { error } = await supabase
          .from('gtm_execution_plans')
          .insert({
            gtm_group_id: gtmGroupId,
            ...updates,
          });

        if (error) throw error;
      }

      // Optimistic update
      setScenarios(prevScenarios =>
        prevScenarios.map(scenario => ({
          ...scenario,
          plans: scenario.plans.map(plan => ({
            ...plan,
            gtm_groups: plan.gtm_groups.map(gtm =>
              gtm.id === gtmGroupId
                ? {
                    ...gtm,
                    execution_plan: gtm.execution_plan
                      ? { ...gtm.execution_plan, ...updates }
                      : {
                          id: 'temp',
                          gtm_group_id: gtmGroupId,
                          reach: null,
                          confidence: null,
                          budget_usd: 0,
                          headcount_needed: [],
                          partner_dependencies: null,
                          product_requirements: null,
                          carrier_requirements: null,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          ...updates,
                        },
                  }
                : gtm
            ),
          })),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update execution plan');
      await fetchScenarios(); // Only refetch on error
    } finally {
      setSaving(false);
    }
  };

  return {
    scenarios,
    loading,
    error,
    saving,
    syncing,
    createScenario,
    updateScenario,
    deleteScenario,
    addGtmGroup,
    updateGtmGroup,
    deleteGtmGroup,
    addSegment,
    updateSegment,
    deleteSegment,
    duplicateScenario,
    updateExecutionPlan,
    refresh: fetchScenarios,
  };
}
