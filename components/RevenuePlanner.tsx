'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Target, TrendingUp, Download, DollarSign, Zap, ChevronDown, ChevronRight,
  X, Save, Loader2, Plus, ChevronUp, RefreshCw, Clipboard
} from 'lucide-react';
import { useScenarios } from '@/lib/hooks/useScenarios';
import { calculateMetrics, calculateFunnelMetrics, debounce } from '@/lib/utils';
import {
  ScenarioWithData, MONTHS, SEGMENT_CONFIGS, SegmentType, GtmType, PlanWithGtmGroups, ExecutionPlan
} from '@/lib/types';
import ExecutionTab from './ExecutionTab';

interface RevenuePlannerProps {
  scenarioId: string;
}

export default function RevenuePlanner({ scenarioId }: RevenuePlannerProps) {
  const [activeTab, setActiveTab] = useState<'output' | 'funnel' | 'visual' | 'execution'>('output');
  const [conversionRates, setConversionRates] = useState({
    SMB: { oppToClose: 25, avgDaysToClose: 60 },
    MM: { oppToClose: 20, avgDaysToClose: 90 },
    ENT: { oppToClose: 20, avgDaysToClose: 120 },
    'ENT+': { oppToClose: 10, avgDaysToClose: 180 },
    Flagship: { oppToClose: 10, avgDaysToClose: 180 },
  });

  const { scenarios, loading, error, saving, syncing, updateScenario, addGtmGroup, updateGtmGroup,
    deleteGtmGroup, addSegment, updateSegment, deleteSegment, updateExecutionPlan, refresh } = useScenarios();

  const scenario = scenarios.find(s => s.id === scenarioId);
  const [localRps, setLocalRps] = useState(scenario?.rps || 40);
  const [localTargetShipments, setLocalTargetShipments] = useState(scenario?.target_shipments || 400000);

  // Local state for segment launches and SPM - for instant UI updates
  const [localLaunches, setLocalLaunches] = useState<Record<string, number[]>>({});
  const [localSPM, setLocalSPM] = useState<Record<string, number>>({});

  useEffect(() => {
    if (scenario) {
      setLocalRps(scenario.rps);
      setLocalTargetShipments(scenario.target_shipments);

      // Initialize local launches and SPM from scenario data
      const launchesMap: Record<string, number[]> = {};
      const spmMap: Record<string, number> = {};
      scenario.plans.forEach(plan => {
        plan.gtm_groups.forEach(gtmGroup => {
          gtmGroup.segments.forEach(segment => {
            launchesMap[segment.id] = [...segment.launches];
            spmMap[segment.id] = segment.spm;
          });
        });
      });
      setLocalLaunches(launchesMap);
      setLocalSPM(spmMap);
    }
  }, [scenario?.id]); // Only re-initialize when scenario ID changes

  const debouncedUpdateScenario = useCallback(
    debounce((id: string, updates: any) => {
      updateScenario(id, updates);
    }, 500),
    [updateScenario]
  );

  const handleRpsChange = (value: number) => {
    setLocalRps(value);
    if (scenario) {
      debouncedUpdateScenario(scenario.id, { rps: value });
    }
  };

  const handleTargetShipmentsChange = (value: number) => {
    setLocalTargetShipments(value);
    if (scenario) {
      debouncedUpdateScenario(scenario.id, { target_shipments: value });
    }
  };

  const debouncedUpdateSegment = useCallback(
    debounce((segmentId: string, updates: any) => {
      updateSegment(segmentId, updates);
    }, 500),
    [updateSegment]
  );

  const handleSegmentLaunchChange = (segmentId: string, monthIndex: number, value: string) => {
    const numValue = parseInt(value) || 0;

    // Update local state immediately for instant feedback
    setLocalLaunches(prev => {
      const current = prev[segmentId] || Array(12).fill(0);
      const newLaunches = current.map((v, i) => i === monthIndex ? numValue : v);
      return { ...prev, [segmentId]: newLaunches };
    });

    // Debounce the database save
    const currentLaunches = localLaunches[segmentId] || Array(12).fill(0);
    const newLaunches = currentLaunches.map((v, i) => i === monthIndex ? numValue : v);
    debouncedUpdateSegment(segmentId, { launches: newLaunches });
  };

  const handleSegmentLaunchIncrement = (segmentId: string, monthIndex: number, delta: number) => {
    const currentLaunches = localLaunches[segmentId] || Array(12).fill(0);
    const currentValue = currentLaunches[monthIndex] || 0;
    const newValue = Math.max(0, currentValue + delta);

    // Update local state immediately
    setLocalLaunches(prev => {
      const current = prev[segmentId] || Array(12).fill(0);
      const newLaunches = current.map((v, i) => i === monthIndex ? newValue : v);
      return { ...prev, [segmentId]: newLaunches };
    });

    // Debounce the database save
    const newLaunches = currentLaunches.map((v, i) => i === monthIndex ? newValue : v);
    debouncedUpdateSegment(segmentId, { launches: newLaunches });
  };

  const handleSegmentSpmChange = (segmentId: string, value: string) => {
    const numValue = parseInt(value) || 0;

    // Update local state immediately for instant feedback
    setLocalSPM(prev => ({ ...prev, [segmentId]: numValue }));

    // Debounce the database save
    debouncedUpdateSegment(segmentId, { spm: numValue });
  };

  const updateConversionRate = (segment: SegmentType, field: 'oppToClose' | 'avgDaysToClose', value: number) => {
    setConversionRates({
      ...conversionRates,
      [segment]: { ...conversionRates[segment], [field]: value }
    });
  };

  const calculations = useMemo(() => {
    if (!scenario) return null;

    // Create a temporary scenario with local launches and SPM for instant calculations
    const tempScenario = {
      ...scenario,
      plans: scenario.plans.map(plan => ({
        ...plan,
        gtm_groups: plan.gtm_groups.map(gtm => ({
          ...gtm,
          segments: gtm.segments.map(seg => ({
            ...seg,
            launches: localLaunches[seg.id] || seg.launches,
            spm: localSPM[seg.id] ?? seg.spm,
          })),
        })),
      })),
    };

    return calculateMetrics(tempScenario, localRps, localTargetShipments, conversionRates);
  }, [scenario, localRps, localTargetShipments, conversionRates, localLaunches, localSPM]);

  const funnelCalculations = useMemo(() => {
    if (!scenario) return null;

    // Use local launches and SPM for instant funnel calculations
    const tempScenario = {
      ...scenario,
      plans: scenario.plans.map(plan => ({
        ...plan,
        gtm_groups: plan.gtm_groups.map(gtm => ({
          ...gtm,
          segments: gtm.segments.map(seg => ({
            ...seg,
            launches: localLaunches[seg.id] || seg.launches,
            spm: localSPM[seg.id] ?? seg.spm,
          })),
        })),
      })),
    };

    return calculateFunnelMetrics(tempScenario, conversionRates);
  }, [scenario, conversionRates, localLaunches, localSPM]);

  const exportToCSV = () => {
    if (!scenario || !calculations) return;

    const rows = [];
    rows.push(['Plan', 'GTM Motion', 'Segment', 'SPM', ...MONTHS, 'Total Shipments', 'Realized Revenue', 'ARR']);

    scenario.plans.forEach(plan => {
      plan.gtm_groups.forEach(gtmGroup => {
        gtmGroup.segments.forEach((seg, idx) => {
          rows.push([
            idx === 0 ? `${plan.type}` : '',
            idx === 0 ? gtmGroup.name : '',
            seg.segment_type,
            seg.spm,
            ...seg.launches,
            calculations.segmentTotals[seg.id] || 0,
            `$${(calculations.segmentRevenueBreakdown[seg.id]?.realized || 0).toLocaleString()}`,
            `$${(calculations.segmentRevenueBreakdown[seg.id]?.arr || 0).toLocaleString()}`
          ]);
        });
      });
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-revenue-plan-${scenario.name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario || !calculations || !funnelCalculations) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">{error || 'Scenario not found'}</p>
        </div>
      </div>
    );
  }

  const baselinePlan = scenario.plans.find(p => p.type === 'Baseline');
  const stretchPlan = scenario.plans.find(p => p.type === 'Stretch');

  const renderPlan = (plan: PlanWithGtmGroups | undefined, planType: 'Baseline' | 'Stretch') => {
    if (!plan) return null;

    const planColors = planType === 'Baseline'
      ? { headerBg: 'bg-gray-200', headerText: 'text-gray-900' }
      : { headerBg: 'bg-orange-100', headerText: 'text-orange-900' };

    return (
      <div className="mb-6">
        {/* Plan Header */}
        <div className={`${planColors.headerBg} p-4 rounded-t-lg border-2 border-gray-400`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold ${planColors.headerText}">{planType} Plan</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <span className="text-gray-600">Shipments: </span>
                <span className="font-bold text-gray-900">
                  {calculations.masterGroupTotals[plan.id]?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-600">Revenue: </span>
                <span className="font-bold text-gray-900">
                  ${(calculations.masterGroupRevenueBreakdown[plan.id]?.realized || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GTM Groups */}
        <div className="border-2 border-t-0 border-gray-400 rounded-b-lg bg-white">
          {plan.gtm_groups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No GTM motions yet</p>
              <button
                onClick={() => addGtmGroup(plan.id, 'New GTM Motion', 'Custom')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First GTM Motion
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {plan.gtm_groups.map((gtmGroup) => {
                const gtmFunnel = funnelCalculations.gtmGroupFunnelData[gtmGroup.id];

                return (
                  <div key={gtmGroup.id} className="border-2 border-gray-300 rounded-lg bg-gray-50">
                    {/* GTM Group Header */}
                    <div className="bg-gray-100 p-3 flex items-center justify-between border-b-2 border-gray-300">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={() => updateGtmGroup(gtmGroup.id, { collapsed: !gtmGroup.collapsed })}
                          className="text-gray-700 hover:text-gray-900"
                        >
                          {gtmGroup.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <input
                          type="text"
                          value={gtmGroup.name}
                          onChange={(e) => updateGtmGroup(gtmGroup.id, { name: e.target.value })}
                          className="text-base font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-700 rounded px-2 py-1 flex-1"
                        />
                        <select
                          value={gtmGroup.type}
                          onChange={(e) => updateGtmGroup(gtmGroup.id, { type: e.target.value as GtmType })}
                          className="text-sm font-semibold text-gray-700 bg-white border border-gray-400 rounded px-2 py-1"
                        >
                          <option value="Sales">Sales</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Partnerships">Partnerships</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <span className="text-gray-600">Shipments: </span>
                          <span className="font-bold text-gray-900">
                            {calculations.gtmGroupTotals[gtmGroup.id]?.toLocaleString() || '0'}
                          </span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-gray-600">Realized: </span>
                          <span className="font-bold text-gray-900">
                            ${(calculations.gtmGroupRevenueBreakdown[gtmGroup.id]?.realized || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-gray-600">ARR: </span>
                          <span className="font-bold text-gray-900">
                            ${(calculations.gtmGroupRevenueBreakdown[gtmGroup.id]?.arr || 0).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteGtmGroup(gtmGroup.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Segments */}
                    {!gtmGroup.collapsed && (
                      <div className="p-4 space-y-4">
                        {gtmGroup.segments.map((segment) => {
                          const segmentFunnel = funnelCalculations.segmentFunnelData[segment.id];
                          const segmentRates = conversionRates[segment.segment_type];

                          return (
                            <div key={segment.id} className="bg-white rounded-lg p-3 border border-gray-300">
                              {/* Segment Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`px-3 py-1 rounded font-bold text-sm ${SEGMENT_CONFIGS[segment.segment_type].color} ${SEGMENT_CONFIGS[segment.segment_type].textColor} border ${SEGMENT_CONFIGS[segment.segment_type].borderColor}`}>
                                    {segment.segment_type}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-600">SPM:</span>
                                    <input
                                      type="number"
                                      value={localSPM[segment.id] ?? segment.spm}
                                      onChange={(e) => handleSegmentSpmChange(segment.id, e.target.value)}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded font-semibold"
                                      min="0"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  {activeTab === 'output' ? (
                                    <>
                                      <div>
                                        <span className="text-gray-600">Total: </span>
                                        <span className="font-bold text-gray-900">
                                          {calculations.segmentTotals[segment.id]?.toLocaleString() || '0'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Realized: </span>
                                        <span className="font-bold text-gray-900">
                                          ${(calculations.segmentRevenueBreakdown[segment.id]?.realized || 0).toLocaleString()}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">ARR: </span>
                                        <span className="font-bold text-gray-900">
                                          ${(calculations.segmentRevenueBreakdown[segment.id]?.arr || 0).toLocaleString()}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <span className="text-gray-600">Opps Needed: </span>
                                        <span className="font-bold text-gray-900">
                                          {segmentFunnel?.totalOpps?.toLocaleString() || '0'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">→ Merchants: </span>
                                        <span className="font-bold text-gray-900">
                                          {segmentFunnel?.totalMerchants?.toLocaleString() || '0'}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                  <button
                                    onClick={() => deleteSegment(segment.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Conversion Rates (Funnel View Only) */}
                              {activeTab === 'funnel' && (
                                <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                                  <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700 font-semibold">Opp → Close %:</span>
                                      <input
                                        type="number"
                                        value={segmentRates.oppToClose}
                                        onChange={(e) => updateConversionRate(segment.segment_type, 'oppToClose', parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                                        min="0"
                                        max="100"
                                        step="1"
                                      />
                                      <span className="text-gray-600">%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700 font-semibold">Sales Cycle:</span>
                                      <input
                                        type="number"
                                        value={segmentRates.avgDaysToClose}
                                        onChange={(e) => updateConversionRate(segment.segment_type, 'avgDaysToClose', parseInt(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                                        min="0"
                                        step="1"
                                      />
                                      <span className="text-gray-600">days</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Monthly Grid - Full Width */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr>
                                      {MONTHS.map((month) => (
                                        <th key={month} className="px-1 py-1 text-center text-gray-600 font-semibold bg-gray-100 border border-gray-300">
                                          {month}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {(localLaunches[segment.id] || segment.launches).map((value, monthIndex) => (
                                        <td key={monthIndex} className="p-0 border border-gray-300">
                                          <div className="flex flex-col">
                                            <button
                                              onClick={() => handleSegmentLaunchIncrement(segment.id, monthIndex, 1)}
                                              className="px-1 py-0.5 hover:bg-blue-100 text-gray-600 hover:text-blue-600 transition-colors border-b border-gray-200"
                                            >
                                              <ChevronUp className="w-3 h-3 mx-auto" />
                                            </button>
                                            <input
                                              type="number"
                                              value={value}
                                              onChange={(e) => handleSegmentLaunchChange(segment.id, monthIndex, e.target.value)}
                                              className="w-full px-1 py-1 text-center border-none focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-semibold"
                                              min="0"
                                            />
                                            <button
                                              onClick={() => handleSegmentLaunchIncrement(segment.id, monthIndex, -1)}
                                              className="px-1 py-0.5 hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors border-t border-gray-200"
                                            >
                                              <ChevronDown className="w-3 h-3 mx-auto" />
                                            </button>
                                          </div>
                                          {activeTab === 'funnel' && segmentFunnel && (
                                            <div className="text-[10px] text-purple-700 font-bold text-center bg-purple-50 py-0.5 border-t border-purple-200">
                                              {segmentFunnel.monthlyOpps[monthIndex] || '-'}
                                            </div>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add Segment */}
                        <div className="flex gap-2 flex-wrap items-center">
                          <span className="text-sm text-gray-600 font-semibold">Add Segment:</span>
                          {Object.entries(SEGMENT_CONFIGS).map(([type, config]) => (
                            <button
                              key={type}
                              onClick={async () => {
                                const customSpm = prompt(`Enter SPM for ${config.label}:`, config.defaultSPM.toString());
                                if (customSpm !== null) {
                                  await addSegment(gtmGroup.id, type as SegmentType, parseInt(customSpm) || config.defaultSPM);
                                }
                              }}
                              className="px-3 py-1 bg-gray-200 text-gray-700 border border-gray-400 rounded text-sm font-semibold hover:bg-gray-300 transition-colors"
                            >
                              + {config.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add GTM Group */}
              <div className="p-4">
                <button
                  onClick={() => addGtmGroup(plan.id, 'New GTM Motion', 'Custom')}
                  className="w-full py-3 border-2 border-dashed border-gray-400 rounded-lg text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add GTM Motion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-300 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <input
              type="text"
              value={scenario.name}
              onChange={(e) => updateScenario(scenario.id, { name: e.target.value })}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-700 rounded px-2 py-1"
            />
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Target:</label>
                <input
                  type="number"
                  value={localTargetShipments}
                  onChange={(e) => handleTargetShipmentsChange(parseInt(e.target.value) || 0)}
                  className="w-32 px-2 py-1 text-sm border border-gray-300 rounded font-semibold"
                  min="0"
                />
                <span className="text-sm text-gray-600">shipments</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">RPS:</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={localRps}
                    onChange={(e) => handleRpsChange(parseFloat(e.target.value) || 0)}
                    className="w-20 pl-5 pr-2 py-1 text-sm border border-gray-300 rounded font-semibold"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              {saving && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Save className="w-4 h-4 animate-pulse" />
                  <span>Saving...</span>
                </div>
              )}
              {syncing && !saving && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing changes...</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('output')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'output'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Output View</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('funnel')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'funnel'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Funnel Planning</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'visual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Visual</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('execution')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'execution'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clipboard className="w-4 h-4" />
              <span>Execution</span>
            </div>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="bg-white border-b-2 border-gray-300 p-4 flex-shrink-0">
        {/* Funnel View - Aggregate Top of Funnel */}
        {activeTab === 'funnel' && funnelCalculations && (
          <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-400">
            <h3 className="text-sm font-bold text-purple-900 mb-3">Aggregate Top of Funnel Requirements</h3>
            <div className="grid grid-cols-6 gap-3">
              {/* SMB */}
              {Object.entries(
                scenario.plans.reduce((acc, plan) => {
                  plan.gtm_groups.forEach(gtm => {
                    gtm.segments.forEach(seg => {
                      if (!acc[seg.segment_type]) {
                        acc[seg.segment_type] = { opps: 0, merchants: 0 };
                      }
                      const segFunnel = funnelCalculations.segmentFunnelData[seg.id];
                      if (segFunnel) {
                        acc[seg.segment_type].opps += segFunnel.totalOpps || 0;
                        acc[seg.segment_type].merchants += segFunnel.totalMerchants || 0;
                      }
                    });
                  });
                  return acc;
                }, {} as Record<string, { opps: number; merchants: number }>)
              ).map(([segmentType, data]) => (
                <div key={segmentType} className="bg-white rounded-lg p-3 border border-purple-300">
                  <div className={`text-xs font-bold mb-2 px-2 py-1 rounded text-center ${SEGMENT_CONFIGS[segmentType as SegmentType].color} ${SEGMENT_CONFIGS[segmentType as SegmentType].textColor}`}>
                    {segmentType}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Opps Needed</p>
                    <p className="text-lg font-bold text-purple-900">{data.opps.toLocaleString()}</p>
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-xs text-gray-600">Merchants</p>
                    <p className="text-sm font-bold text-gray-700">{data.merchants.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 border-4 border-blue-700">
            <p className="text-xs font-semibold text-gray-600 mb-1">Total Annual Shipments</p>
            <p className="text-2xl font-bold text-gray-900">
              {calculations.totalShipments.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {calculations.percentageToGoal.toFixed(1)}% of {localTargetShipments.toLocaleString()} goal
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border-4 border-blue-700">
            <p className="text-xs font-semibold text-gray-600 mb-1">Realized Revenue (Year 1)</p>
            <p className="text-2xl font-bold text-gray-900">
              ${calculations.realizedRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Actual revenue this year</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border-4 border-blue-700">
            <p className="text-xs font-semibold text-gray-600 mb-1">Annualized Run Rate (ARR)</p>
            <p className="text-2xl font-bold text-gray-900">
              ${calculations.annualizedRunRate.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Full-year potential</p>
          </div>
        </div>

        {/* Baseline vs Stretch Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {/* Baseline */}
          <div className="bg-gray-100 rounded-lg p-3 border-2 border-gray-400">
            <p className="text-sm font-bold text-gray-900 mb-2">Baseline Plan</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-600">Shipments</p>
                <p className="font-bold text-gray-900">
                  {calculations.masterGroupTotals[baselinePlan?.id || '']?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Realized</p>
                <p className="font-bold text-gray-900">
                  ${(calculations.masterGroupRevenueBreakdown[baselinePlan?.id || '']?.realized || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">ARR</p>
                <p className="font-bold text-gray-900">
                  ${(calculations.masterGroupRevenueBreakdown[baselinePlan?.id || '']?.arr || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Stretch */}
          <div className="bg-orange-50 rounded-lg p-3 border-2 border-orange-400">
            <p className="text-sm font-bold text-orange-900 mb-2">Stretch Plan</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-600">Shipments</p>
                <p className="font-bold text-gray-900">
                  {calculations.masterGroupTotals[stretchPlan?.id || '']?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Realized</p>
                <p className="font-bold text-gray-900">
                  ${(calculations.masterGroupRevenueBreakdown[stretchPlan?.id || '']?.realized || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">ARR</p>
                <p className="font-bold text-gray-900">
                  ${(calculations.masterGroupRevenueBreakdown[stretchPlan?.id || '']?.arr || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Conditional Based on Tab */}
      {activeTab === 'execution' ? (
        <ExecutionTab
          stretchGtmGroups={stretchPlan?.gtm_groups || []}
          gtmGroupRevenueBreakdown={calculations.gtmGroupRevenueBreakdown}
          onUpdateExecutionPlan={updateExecutionPlan}
        />
      ) : activeTab === 'visual' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Growth Over Time</h3>

            {/* Stacked Area Chart */}
            <div className="relative h-96 border-2 border-gray-300 rounded-lg p-6">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 w-20 flex flex-col justify-between text-xs text-gray-600 pr-2 text-right">
                {[4, 3, 2, 1, 0].map(i => {
                  const value = (calculations.annualizedRunRate / 4) * i;
                  return (
                    <div key={i}>${(value / 1000).toFixed(0)}k</div>
                  );
                })}
              </div>

              {/* Chart area */}
              <div className="ml-20 h-full relative">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="absolute w-full border-t border-gray-200"
                    style={{ top: `${i * 25}%` }}
                  />
                ))}

                {/* Monthly bars */}
                <div className="h-full flex items-end gap-1 pb-8">
                  {MONTHS.map((month, monthIndex) => {
                    // Calculate revenue separately for Baseline and Stretch
                    let baselineRealized = 0;
                    let baselineARR = 0;
                    let stretchRealized = 0;
                    let stretchARR = 0;

                    scenario.plans.forEach(plan => {
                      let planRealized = 0;
                      let planARR = 0;

                      plan.gtm_groups.forEach(gtmGroup => {
                        gtmGroup.segments.forEach(segment => {
                          const launches = localLaunches[segment.id] || segment.launches;
                          const spm = localSPM[segment.id] ?? segment.spm;

                          for (let launchMonth = 0; launchMonth <= monthIndex; launchMonth++) {
                            const launchCount = launches[launchMonth] || 0;
                            if (launchCount > 0) {
                              const monthlyRevenue = launchCount * spm * localRps;
                              const monthsOfRevenue = monthIndex - launchMonth + 1;
                              planRealized += monthlyRevenue * monthsOfRevenue;
                              planARR += monthlyRevenue * 12;
                            }
                          }
                        });
                      });

                      if (plan.type === 'Baseline') {
                        baselineRealized = planRealized;
                        baselineARR = planARR;
                      } else if (plan.type === 'Stretch') {
                        stretchRealized = planRealized;
                        stretchARR = planARR;
                      }
                    });

                    const maxValue = calculations.annualizedRunRate || 1;
                    const baselineRealizedPct = (baselineRealized / maxValue) * 100;
                    const baselineARRPct = (baselineARR / maxValue) * 100;
                    const stretchRealizedPct = (stretchRealized / maxValue) * 100;
                    const stretchARRPct = (stretchARR / maxValue) * 100;

                    return (
                      <div key={month} className="flex-1 h-full flex flex-col justify-end relative group">
                        {/* Stacked bars - Bottom to Top: Baseline Realized, Baseline ARR, Stretch Realized, Stretch ARR */}
                        <div className="relative h-full flex flex-col justify-end">
                          {/* Layer 4 (Top): Stretch ARR - Light Orange */}
                          {stretchARRPct > 0 && (
                            <div
                              className="bg-orange-300 opacity-70"
                              style={{ height: `${stretchARRPct}%` }}
                            />
                          )}
                          {/* Layer 3: Stretch Realized - Dark Orange */}
                          {stretchRealizedPct > 0 && (
                            <div
                              className="bg-orange-600"
                              style={{ height: `${stretchRealizedPct}%` }}
                            />
                          )}
                          {/* Layer 2: Baseline ARR - Light Blue */}
                          {baselineARRPct > 0 && (
                            <div
                              className="bg-blue-300 opacity-80"
                              style={{ height: `${baselineARRPct}%` }}
                            />
                          )}
                          {/* Layer 1 (Bottom): Baseline Realized - Dark Blue */}
                          {baselineRealizedPct > 0 && (
                            <div
                              className="bg-blue-600 rounded-b"
                              style={{ height: `${baselineRealizedPct}%` }}
                            />
                          )}
                        </div>

                        {/* Month label */}
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 font-semibold whitespace-nowrap">
                          {month}
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg">
                          <div className="font-bold mb-1 border-b border-gray-600 pb-1">{month}</div>
                          <div className="mb-1">
                            <div className="font-semibold text-blue-300">Baseline:</div>
                            <div>Realized: ${baselineRealized.toLocaleString()}</div>
                            <div>ARR: ${baselineARR.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-orange-300">Stretch:</div>
                            <div>Realized: ${stretchRealized.toLocaleString()}</div>
                            <div>ARR: ${stretchARR.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-axis line */}
                <div className="absolute bottom-0 w-full border-b-2 border-gray-400" />
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded" />
                <span className="text-sm text-gray-700 font-semibold">Baseline Realized</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-300 rounded" />
                <span className="text-sm text-gray-700 font-semibold">Baseline ARR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-600 rounded" />
                <span className="text-sm text-gray-700 font-semibold">Stretch Realized</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-300 rounded" />
                <span className="text-sm text-gray-700 font-semibold">Stretch ARR</span>
              </div>
            </div>

            {/* Quarterly Summary */}
            <div className="mt-8 pt-6 border-t-2 border-gray-300">
              <h4 className="text-md font-bold text-gray-900 mb-4">Quarterly Breakdown</h4>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(calculations.quarterlyBreakdown).map(([quarter, shipments]) => (
                  <div key={quarter} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
                    <p className="text-sm font-semibold text-gray-600 mb-2">{quarter}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(shipments / 3).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500">SPM avg</p>
                    <p className="text-sm font-semibold text-gray-700 mt-2">
                      ${((shipments / 3) * localRps).toLocaleString()} / mo
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {renderPlan(baselinePlan, 'Baseline')}
          {renderPlan(stretchPlan, 'Stretch')}
        </div>
      )}
    </div>
  );
}
