'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Target,
  TrendingUp,
  Download,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronRight,
  X,
  Save,
  Loader2,
  Plus,
  ChevronUp,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useScenarios } from '@/lib/hooks/useScenarios';
import { calculateMetrics, calculateFunnelMetrics, calculateMonthlyReportData, debounce } from '@/lib/utils';
import {
  ScenarioWithData,
  MONTHS,
  SEGMENT_CONFIGS,
  SegmentType,
  GtmType,
  PlanWithGtmGroups,
  createDefaultScenarioSettings,
  ScenarioSettings,
  QUARTER_KEYS,
  QuarterBreakdown,
  QUARTERS,
  SegmentGroup,
  SEGMENT_GROUP_MAPPING,
} from '@/lib/types';

interface RevenuePlannerProps {
  scenarioId: string;
}

const cloneSettings = (settings: ScenarioSettings): ScenarioSettings =>
  JSON.parse(JSON.stringify(settings));

const createQuarterTotals = (): QuarterBreakdown => ({
  Q1: 0,
  Q2: 0,
  Q3: 0,
  Q4: 0,
});

const getQuarterFromMonthIndex = (monthIndex: number): (typeof QUARTER_KEYS)[number] | null =>
  QUARTER_KEYS.find((quarter) => (QUARTERS[quarter] as readonly number[]).includes(monthIndex)) ?? null;

const getSeasonalMultiplierFromSettings = (
  settings: ScenarioSettings,
  segmentType: SegmentType,
  monthIndex: number
): number => {
  const segmentSettings = settings.seasonality[segmentType];
  if (!segmentSettings) return 1;
  if (monthIndex === 10) return 1 + (segmentSettings.november / 100);
  if (monthIndex === 11) return 1 + (segmentSettings.december / 100);
  return 1;
};

const getAnnualSeasonalityFactorFromSettings = (
  settings: ScenarioSettings,
  segmentType: SegmentType
): number => {
  const novMultiplier = getSeasonalMultiplierFromSettings(settings, segmentType, 10);
  const decMultiplier = getSeasonalMultiplierFromSettings(settings, segmentType, 11);
  return (12 - 2) + novMultiplier + decMultiplier;
};

const getIntegrationMonthsFromSettings = (
  settings: ScenarioSettings,
  segmentType: SegmentType
): number => {
  const days = settings.integrationTimelineDays[segmentType] ?? 0;
  if (days <= 0) return 0;
  return Math.max(0, Math.ceil(days / 30));
};

const filterScenarioBySegment = (scenario: ScenarioWithData, filter: 'all' | 'sales' | 'smb'): ScenarioWithData => {
  const includeFn = filter === 'smb'
    ? (segment: SegmentType) => segment === 'SMB'
    : filter === 'sales'
      ? (segment: SegmentType) => segment !== 'SMB'
      : (_segment: SegmentType) => true;

  return {
    ...scenario,
    plans: scenario.plans.map(plan => ({
      ...plan,
      gtm_groups: plan.gtm_groups.map(gtm => ({
        ...gtm,
        segments: gtm.segments.filter(segment => includeFn(segment.segment_type)),
      })),
    })),
  };
};

const filterScenarioBySource = (scenario: ScenarioWithData, filter: 'all' | GtmType): ScenarioWithData => {
  if (filter === 'all') return scenario;

  return {
    ...scenario,
    plans: scenario.plans.map(plan => ({
      ...plan,
      gtm_groups: plan.gtm_groups.filter(gtm => gtm.type === filter),
    })),
  };
};

interface QuarterVisualMetrics {
  shipments: number;
  baselineRealized: number;
  stretchRealized: number;
  baselineArr: number;
  stretchArr: number;
}

interface PlanQuarterMetrics {
  shipments: number;
  realized: number;
  arr: number;
}

const FIRST_MONTH_RAMP = 0.5;
type FunnelSectionKey = 'aggregate' | 'quarterlySegments' | 'monthly' | 'tactical';

export default function RevenuePlanner({ scenarioId }: RevenuePlannerProps) {
  const [activeTab, setActiveTab] = useState<'output' | 'funnel' | 'visual' | 'monthly' | 'settings'>('output');
  const [conversionRates, setConversionRates] = useState({
    SMB: { oppToClose: 25, avgDaysToClose: 60 },
    MM: { oppToClose: 20, avgDaysToClose: 90 },
    ENT: { oppToClose: 20, avgDaysToClose: 120 },
    'ENT+': { oppToClose: 10, avgDaysToClose: 180 },
    Flagship: { oppToClose: 10, avgDaysToClose: 180 },
  });

  const { scenarios, loading, error, saving, syncing, updateScenario, addGtmGroup, updateGtmGroup,
    deleteGtmGroup, addSegment, updateSegment, deleteSegment, refresh } = useScenarios();

  const baseScenario = scenarios.find(s => s.id === scenarioId);
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'sales' | 'smb'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | GtmType>('all');
  const [localRps, setLocalRps] = useState(baseScenario?.rps || 40);
  const [localTargetShipments, setLocalTargetShipments] = useState(baseScenario?.target_shipments || 400000);

  // Local state for segment launches and SPM - for instant UI updates
  const [localLaunches, setLocalLaunches] = useState<Record<string, number[]>>({});
  const [localSPM, setLocalSPM] = useState<Record<string, number>>({});
  const [localSettings, setLocalSettings] = useState<ScenarioSettings>(createDefaultScenarioSettings());
  const [funnelSectionsOpen, setFunnelSectionsOpen] = useState<Record<FunnelSectionKey, boolean>>({
    aggregate: true,
    quarterlySegments: true,
    monthly: true,
    tactical: true,
  });
  const [planSummaryOpen, setPlanSummaryOpen] = useState(true);
  const [segmentSummaryOpen, setSegmentSummaryOpen] = useState(true);
  const [planSummariesOpen, setPlanSummariesOpen] = useState({
    baseline: true,
    stretch: true,
  });

  const scenario = useMemo(() => {
    if (!baseScenario) return null;
    const segmentFiltered = filterScenarioBySegment(baseScenario, segmentFilter);
    return filterScenarioBySource(segmentFiltered, sourceFilter);
  }, [baseScenario, segmentFilter, sourceFilter]);

  useEffect(() => {
    if (baseScenario) {
      setLocalRps(baseScenario.rps);
      setLocalTargetShipments(baseScenario.target_shipments);

      // Initialize local launches and SPM from scenario data
      const launchesMap: Record<string, number[]> = {};
      const spmMap: Record<string, number> = {};
      baseScenario.plans.forEach(plan => {
        plan.gtm_groups.forEach(gtmGroup => {
          gtmGroup.segments.forEach(segment => {
            launchesMap[segment.id] = [...segment.launches];
            spmMap[segment.id] = segment.spm;
          });
        });
      });
      setLocalLaunches(launchesMap);
      setLocalSPM(spmMap);
      setLocalSettings(cloneSettings(baseScenario.settings));
    }
  }, [baseScenario]);

  const debouncedUpdateScenario = useCallback(
    debounce((id: string, updates: any) => {
      updateScenario(id, updates);
    }, 500),
    [updateScenario]
  );

  const handleRpsChange = (value: number) => {
    setLocalRps(value);
    if (baseScenario) {
      debouncedUpdateScenario(baseScenario.id, { rps: value });
    }
  };

  const handleTargetShipmentsChange = (value: number) => {
    setLocalTargetShipments(value);
    if (baseScenario) {
      debouncedUpdateScenario(baseScenario.id, { target_shipments: value });
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

  const persistSettingsUpdate = (updater: (prev: ScenarioSettings) => ScenarioSettings) => {
    if (!baseScenario) return;
    setLocalSettings(prev => {
      const updated = updater(prev);
      debouncedUpdateScenario(baseScenario.id, { settings: updated });
      return updated;
    });
  };

  const handleSeasonalityChange = (segmentType: SegmentType, month: 'november' | 'december', value: string) => {
    const numValue = parseFloat(value);
    persistSettingsUpdate(prev => ({
      ...prev,
      seasonality: {
        ...prev.seasonality,
        [segmentType]: {
          ...prev.seasonality[segmentType],
          [month]: isNaN(numValue) ? 0 : numValue,
        },
      },
    }));
  };

  const handleIntegrationTimelineChange = (segmentType: SegmentType, value: string) => {
    const numValue = parseInt(value) || 0;
    persistSettingsUpdate(prev => ({
      ...prev,
      integrationTimelineDays: {
        ...prev.integrationTimelineDays,
        [segmentType]: Math.max(0, numValue),
      },
    }));
  };

  const toggleFunnelSection = (section: FunnelSectionKey) => {
    setFunnelSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const togglePlanSummary = (planKey: 'baseline' | 'stretch') => {
    setPlanSummariesOpen(prev => ({
      ...prev,
      [planKey]: !prev[planKey],
    }));
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

    return calculateMetrics(
      tempScenario,
      localRps,
      localTargetShipments,
      conversionRates,
      localSettings.seasonality,
      localSettings.integrationTimelineDays
    );
  }, [scenario, localRps, localTargetShipments, conversionRates, localLaunches, localSPM, localSettings]);

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

    return calculateFunnelMetrics(
      tempScenario,
      conversionRates,
      localSettings.integrationTimelineDays
    );
  }, [scenario, conversionRates, localLaunches, localSPM, localSettings]);

  const monthlyReportData = useMemo(() => {
    if (!scenario) return null;

    // Use local launches and SPM for instant calculations
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

    return calculateMonthlyReportData(
      tempScenario,
      localRps,
      conversionRates,
      localSettings.seasonality,
      localSettings.integrationTimelineDays
    );
  }, [scenario, localRps, conversionRates, localLaunches, localSPM, localSettings]);

  const segmentQuarterlyBreakdown = useMemo(() => {
    if (!scenario || !funnelCalculations) return null;
    const base = {} as Record<SegmentType, { opps: QuarterBreakdown; merchants: QuarterBreakdown }>;
    (Object.keys(SEGMENT_CONFIGS) as SegmentType[]).forEach(segmentType => {
      base[segmentType] = {
        opps: createQuarterTotals(),
        merchants: createQuarterTotals(),
      };
    });

    scenario.plans.forEach(plan => {
      plan.gtm_groups.forEach(gtmGroup => {
        gtmGroup.segments.forEach(segment => {
          const segFunnel = funnelCalculations.segmentFunnelData[segment.id];
          if (segFunnel) {
            QUARTER_KEYS.forEach(quarter => {
              base[segment.segment_type].opps[quarter] += segFunnel.quarterlyOpps[quarter];
            });
          }

          const launches = localLaunches[segment.id] || segment.launches;
          launches.forEach((value, monthIndex) => {
            if (!value) return;
            const integrationMonths = getIntegrationMonthsFromSettings(localSettings, segment.segment_type);
            const goLiveMonth = monthIndex + integrationMonths;
            const quarter = getQuarterFromMonthIndex(goLiveMonth);
            if (quarter && goLiveMonth < 12) {
              base[segment.segment_type].merchants[quarter] += value;
            }
          });
        });
      });
    });

    return base;
  }, [scenario, funnelCalculations, localLaunches, localSettings]);

  const quarterVisualData = useMemo(() => {
    if (!scenario) return null;

    const data = QUARTER_KEYS.reduce<Record<string, QuarterVisualMetrics>>((acc, quarter) => {
      acc[quarter] = {
        shipments: 0,
        baselineRealized: 0,
        stretchRealized: 0,
        baselineArr: 0,
        stretchArr: 0,
      };
      return acc;
    }, {});

    scenario.plans.forEach(plan => {
      plan.gtm_groups.forEach(gtm => {
        gtm.segments.forEach(segment => {
          const launches = localLaunches[segment.id] || segment.launches;
          const spm = localSPM[segment.id] ?? segment.spm;

          launches.forEach((launchCount, launchMonth) => {
            if (!launchCount) return;
            const baseMonthlyShipments = launchCount * spm;
            const annualFactor = getAnnualSeasonalityFactorFromSettings(localSettings, segment.segment_type);
            const integrationMonths = getIntegrationMonthsFromSettings(localSettings, segment.segment_type);
            const goLiveMonth = launchMonth + integrationMonths;

            if (goLiveMonth < 12) {
              for (let month = goLiveMonth; month < 12; month++) {
                const rampFactor = month === goLiveMonth ? FIRST_MONTH_RAMP : 1;
                const seasonalMultiplier = getSeasonalMultiplierFromSettings(localSettings, segment.segment_type, month);
                const shipmentsThisMonth = baseMonthlyShipments * rampFactor * seasonalMultiplier;
                const revenueThisMonth = shipmentsThisMonth * localRps;
                const quarter = getQuarterFromMonthIndex(month);
                if (!quarter) continue;

                data[quarter].shipments += shipmentsThisMonth;
                if (plan.type === 'Baseline') {
                  data[quarter].baselineRealized += revenueThisMonth;
                } else if (plan.type === 'Stretch') {
                  data[quarter].stretchRealized += revenueThisMonth;
                }
              }
            }

            const launchQuarter = getQuarterFromMonthIndex(goLiveMonth);
            if (launchQuarter && goLiveMonth < 12) {
              const annualizedRevenue = baseMonthlyShipments * localRps * annualFactor;
              if (plan.type === 'Baseline') {
                data[launchQuarter].baselineArr += annualizedRevenue;
              } else if (plan.type === 'Stretch') {
                data[launchQuarter].stretchArr += annualizedRevenue;
              }
            }
          });
        });
      });
    });

    return data;
  }, [scenario, localLaunches, localSPM, localSettings, localRps]);

  const planQuarterData = useMemo(() => {
    if (!scenario) return null;

    const data: Record<string, Record<string, PlanQuarterMetrics>> = {};

    scenario.plans.forEach(plan => {
      data[plan.id] = QUARTER_KEYS.reduce<Record<string, PlanQuarterMetrics>>((acc, quarter) => {
        acc[quarter] = { shipments: 0, realized: 0, arr: 0 };
        return acc;
      }, {} as Record<string, PlanQuarterMetrics>);

      plan.gtm_groups.forEach(gtm => {
        gtm.segments.forEach(segment => {
          const launches = localLaunches[segment.id] || segment.launches;
          const spm = localSPM[segment.id] ?? segment.spm;

          launches.forEach((launchCount, launchMonth) => {
            if (!launchCount) return;
            const baseMonthlyShipments = launchCount * spm;
            const annualFactor = getAnnualSeasonalityFactorFromSettings(localSettings, segment.segment_type);
            const integrationMonths = getIntegrationMonthsFromSettings(localSettings, segment.segment_type);
            const goLiveMonth = launchMonth + integrationMonths;

            if (goLiveMonth < 12) {
              for (let month = goLiveMonth; month < 12; month++) {
                const quarter = getQuarterFromMonthIndex(month);
                if (!quarter) continue;
                const rampFactor = month === goLiveMonth ? FIRST_MONTH_RAMP : 1;
                const seasonalMultiplier = getSeasonalMultiplierFromSettings(localSettings, segment.segment_type, month);
                const shipmentsThisMonth = baseMonthlyShipments * rampFactor * seasonalMultiplier;
                data[plan.id][quarter].shipments += shipmentsThisMonth;
                data[plan.id][quarter].realized += shipmentsThisMonth * localRps;
              }
            }

            const launchQuarter = getQuarterFromMonthIndex(goLiveMonth);
            if (launchQuarter && goLiveMonth < 12) {
              data[plan.id][launchQuarter].arr += baseMonthlyShipments * localRps * annualFactor;
            }
          });
        });
      });
    });

    return data;
  }, [scenario, localLaunches, localSPM, localSettings, localRps]);

  const exportSummaryCSV = () => {
    if (!scenario || !calculations || !monthlyReportData) return;

    const rows = [];

    // Header row
    rows.push([
      'Plan',
      'Segment Group',
      'Month',
      'Top of Funnel',
      'Scheduled Launches',
      'Go-Live Merchants',
      'Shipments',
      'Realized Revenue',
      'Cumulative Revenue',
      'ARR Added',
      'Cumulative ARR'
    ]);

    // Data rows - long format with cumulative ARR
    monthlyReportData.reports.forEach(report => {
      let cumulativeARR = 0;
      report.monthlyData.forEach((monthData, monthIndex) => {
        cumulativeARR += monthData.arr;
        rows.push([
          report.planType,
          report.segmentGroup,
          MONTHS[monthIndex],
          monthData.topOfFunnel,
          monthData.scheduledLaunches,
          monthData.goLiveMerchants,
          Math.round(monthData.shipments),
          Math.round(monthData.realizedRevenue),
          Math.round(monthData.cumulativeRevenue),
          Math.round(monthData.arr),
          Math.round(cumulativeARR)
        ]);
      });
    });

    // Generate CSV with proper escaping
    const csvContent = rows.map(row =>
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-summary-${scenario.name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportDetailedCSV = () => {
    if (!scenario || !funnelCalculations) return;

    const rows = [];

    // Header row
    rows.push([
      'Plan',
      'GTM Motion',
      'Segment',
      'Month',
      'Top of Funnel',
      'Scheduled Launches',
      'Go-Live Merchants',
      'Shipments',
      'Realized Revenue',
      'Cumulative Revenue',
      'ARR Added',
      'Cumulative ARR'
    ]);

    // Detailed data by individual segment
    scenario.plans.forEach(plan => {
      plan.gtm_groups.forEach(gtmGroup => {
        gtmGroup.segments.forEach(segment => {
          const segmentFunnel = funnelCalculations.segmentFunnelData[segment.id];
          const integrationMonths = Math.ceil((localSettings.integrationTimelineDays[segment.segment_type] || 0) / 30);
          const annualSeasonalityFactor = getAnnualSeasonalityFactorFromSettings(localSettings, segment.segment_type);

          // Calculate monthly data for this segment
          const monthlyData = Array(12).fill(null).map(() => ({
            topOfFunnel: 0,
            scheduledLaunches: 0,
            goLiveMerchants: 0,
            shipments: 0,
            realizedRevenue: 0,
            arr: 0
          }));

          // Process each launch
          (localLaunches[segment.id] || segment.launches).forEach((launchCount, launchMonth) => {
            if (launchCount === 0) return;

            // Scheduled launches
            monthlyData[launchMonth].scheduledLaunches += launchCount;

            // Go-live and revenue
            const goLiveMonth = launchMonth + integrationMonths;
            if (goLiveMonth < 12) {
              monthlyData[goLiveMonth].goLiveMerchants += launchCount;

              const baseMonthlyShipments = launchCount * (localSPM[segment.id] ?? segment.spm);
              for (let m = goLiveMonth; m < 12; m++) {
                const rampFactor = m === goLiveMonth ? FIRST_MONTH_RAMP : 1;
                const seasonalMultiplier = getSeasonalMultiplierFromSettings(localSettings, segment.segment_type, m);
                const shipments = baseMonthlyShipments * rampFactor * seasonalMultiplier;
                monthlyData[m].shipments += shipments;
                monthlyData[m].realizedRevenue += shipments * localRps;
              }

              monthlyData[goLiveMonth].arr += baseMonthlyShipments * localRps * annualSeasonalityFactor;
            }
          });

          // Top of funnel from funnel calculations
          if (segmentFunnel) {
            segmentFunnel.monthlyOpps.forEach((opps, monthIndex) => {
              monthlyData[monthIndex].topOfFunnel = opps;
            });
          }

          // Output rows with cumulative values
          let cumulativeRevenue = 0;
          let cumulativeARR = 0;
          monthlyData.forEach((data, monthIndex) => {
            cumulativeRevenue += data.realizedRevenue;
            cumulativeARR += data.arr;

            rows.push([
              plan.type,
              gtmGroup.name,
              segment.segment_type,
              MONTHS[monthIndex],
              Math.round(data.topOfFunnel),
              data.scheduledLaunches,
              data.goLiveMerchants,
              Math.round(data.shipments),
              Math.round(data.realizedRevenue),
              Math.round(cumulativeRevenue),
              Math.round(data.arr),
              Math.round(cumulativeARR)
            ]);
          });
        });
      });
    });

    // Generate CSV
    const csvContent = rows.map(row =>
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-detailed-${scenario.name}-${new Date().toISOString().split('T')[0]}.csv`;
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

  if (error || !baseScenario || !scenario || !calculations || !funnelCalculations) {
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
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700 font-semibold">Integration Timeline:</span>
                                      <input
                                        type="number"
                                        value={localSettings.integrationTimelineDays[segment.segment_type]}
                                        onChange={(e) => handleIntegrationTimelineChange(segment.segment_type, e.target.value)}
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
                                        <td key={monthIndex} className="p-0 border border-gray-300 align-top">
                                          {activeTab === 'funnel' && segmentFunnel && (
                                            <div className="bg-purple-100 border-b border-purple-300 text-center py-1">
                                              <p className="text-[9px] uppercase font-semibold text-purple-700 tracking-wide">
                                                Opps Needed
                                              </p>
                                              <p className="text-xs font-bold text-purple-900">
                                                {(segmentFunnel.monthlyOpps[monthIndex] || 0).toLocaleString()}
                                              </p>
                                            </div>
                                          )}
                                          <div className={`flex flex-col ${activeTab === 'funnel' && segmentFunnel ? 'bg-white' : ''}`}>
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
                                          {activeTab === 'funnel' && (
                                            <p className="text-[10px] text-gray-600 text-center py-0.5 font-semibold border-t border-gray-200">
                                              New Merchants
                                            </p>
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

  const summaryContainerClass = `bg-white border-b-2 border-gray-300 p-4 ${
    activeTab === 'funnel' ? 'overflow-y-auto max-h-[70vh]' : 'flex-shrink-0'
  }`;

  return (
    <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-300 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <input
              type="text"
              value={baseScenario?.name || ''}
              onChange={(e) => baseScenario && updateScenario(baseScenario.id, { name: e.target.value })}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-700 rounded px-2 py-1"
              disabled={!baseScenario}
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
                <label className="text-sm font-semibold text-gray-700">Segment view:</label>
                <select
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value as 'all' | 'sales' | 'smb')}
                  className="px-2 py-1 text-sm border border-gray-300 rounded font-semibold bg-white"
                >
                  <option value="all">All</option>
                  <option value="sales">Sales (MM, ENT, ENT+, Flagship)</option>
                  <option value="smb">SMB</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Source:</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as 'all' | GtmType)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded font-semibold bg-white"
                >
                  <option value="all">All</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Partnerships">Partnerships</option>
                  <option value="Custom">Custom</option>
                </select>
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
              onClick={exportSummaryCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              title="Export aggregated summary by segment group"
            >
              <Download className="w-4 h-4" />
              Export Summary
            </button>
            <button
              onClick={exportDetailedCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm"
              title="Export detailed breakdown by GTM motion and segment"
            >
              <Download className="w-4 h-4" />
              Export Detailed
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
              <span>New Merchants</span>
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
              <span>Top of Funnel</span>
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
            onClick={() => setActiveTab('monthly')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>Monthly Report</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Assumptions</span>
            </div>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className={summaryContainerClass}>
        {(segmentFilter !== 'all' || sourceFilter !== 'all') && (
          <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-semibold text-blue-800">
            {segmentFilter !== 'all' && `Viewing ${segmentFilter === 'smb' ? 'SMB only' : 'Sales (MM, ENT, ENT+, Flagship)'} segments`}
            {segmentFilter !== 'all' && sourceFilter !== 'all' && ' • '}
            {sourceFilter !== 'all' && `Source: ${sourceFilter}`}
          </div>
        )}
        {/* Funnel View - Aggregate Top of Funnel */}
        {activeTab === 'funnel' && funnelCalculations && (
          <>
            <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-400">
              <button
                onClick={() => toggleFunnelSection('aggregate')}
                className="w-full flex items-center justify-between text-purple-900 font-bold text-sm"
              >
                <span>Aggregate Top of Funnel Requirements</span>
                {funnelSectionsOpen.aggregate ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {funnelSectionsOpen.aggregate && (
                <div className="grid grid-cols-6 gap-3 mt-3">
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
                    <div key={segmentType} className="bg-white rounded-lg p-3 border border-purple-300 flex flex-col gap-2">
                      <div className={`text-xs font-bold px-2 py-1 rounded text-center ${SEGMENT_CONFIGS[segmentType as SegmentType].color} ${SEGMENT_CONFIGS[segmentType as SegmentType].textColor}`}>
                        {segmentType}
                      </div>
                      <div className="text-center bg-purple-100 border border-purple-200 rounded-lg p-2">
                        <p className="text-[10px] uppercase text-purple-700 font-semibold tracking-wide">Top of Funnel Needed</p>
                        <p className="text-2xl font-black text-purple-900">{data.opps.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">New Merchants</p>
                        <p className="text-sm font-bold text-gray-700">{data.merchants.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {segmentQuarterlyBreakdown && (
              <div className="mb-4 bg-white rounded-lg p-4 border-2 border-purple-200">
                <button
                  onClick={() => toggleFunnelSection('quarterlySegments')}
                  className="w-full flex items-center justify-between text-purple-900 font-bold text-sm"
                >
                  <span>Quarterly Top of Funnel by Segment</span>
                  {funnelSectionsOpen.quarterlySegments ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {funnelSectionsOpen.quarterlySegments && (
                  <div className="space-y-3 mt-3">
                    {(Object.keys(SEGMENT_CONFIGS) as SegmentType[]).map(segmentType => (
                      <div key={segmentType} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`inline-flex items-center px-3 py-1 rounded text-xs font-semibold ${SEGMENT_CONFIGS[segmentType].color} ${SEGMENT_CONFIGS[segmentType].textColor}`}>
                            {segmentType}
                          </div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">TOP OF FUNNEL → MERCHANT YIELD</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-purple-100 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-purple-50 text-purple-900">
                                <th className="px-2 py-1 text-left font-semibold">Quarter</th>
                                <th className="px-2 py-1 text-right font-semibold">Top of Funnel Needed</th>
                                <th className="px-2 py-1 text-right font-semibold">New Merchants</th>
                              </tr>
                            </thead>
                            <tbody>
                              {QUARTER_KEYS.map(quarter => (
                                <tr key={`${segmentType}-${quarter}`} className="border-t border-purple-100">
                                  <td className="px-2 py-1 font-semibold text-gray-700">{quarter}</td>
                                  <td className="px-2 py-1 text-right text-purple-900">
                                    {segmentQuarterlyBreakdown[segmentType].opps[quarter].toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1 text-right text-gray-900">
                                    {segmentQuarterlyBreakdown[segmentType].merchants[quarter].toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Monthly Breakdown Section */}
            {monthlyReportData && (
              <div className="mb-4 bg-white rounded-lg p-4 border-2 border-purple-200">
                <button
                  onClick={() => toggleFunnelSection('monthly')}
                  className="w-full flex items-center justify-between text-purple-900 font-bold text-sm"
                >
                  <span>Monthly Top of Funnel & Launches</span>
                  {funnelSectionsOpen.monthly ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {funnelSectionsOpen.monthly && (
                  <div className="space-y-4 mt-3">
                    {(['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).map(segmentGroup => {
                      const baselineReport = monthlyReportData.reports.find(
                        r => r.planType === 'Baseline' && r.segmentGroup === segmentGroup
                      );
                      const stretchReport = monthlyReportData.reports.find(
                        r => r.planType === 'Stretch' && r.segmentGroup === segmentGroup
                      );

                      return (
                        <div key={segmentGroup} className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                          <h5 className="text-sm font-bold text-purple-900 mb-3">{segmentGroup}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border border-purple-200 rounded-lg overflow-hidden">
                              <thead>
                                <tr className="bg-purple-100">
                                  <th className="px-2 py-1 text-left text-purple-900 font-semibold border-r border-purple-200">Month</th>
                                  <th className="px-2 py-1 text-center text-purple-900 font-semibold border-r border-purple-200" colSpan={2}>
                                    Baseline
                                  </th>
                                  <th className="px-2 py-1 text-center text-orange-900 font-semibold" colSpan={2}>
                                    Stretch
                                  </th>
                                </tr>
                                <tr className="bg-purple-50">
                                  <th className="px-2 py-1 text-left text-purple-800 font-semibold border-r border-purple-200"></th>
                                  <th className="px-2 py-1 text-right text-purple-800 font-semibold text-[10px]">Top of Funnel</th>
                                  <th className="px-2 py-1 text-right text-purple-800 font-semibold text-[10px] border-r border-purple-200">Launches</th>
                                  <th className="px-2 py-1 text-right text-orange-800 font-semibold text-[10px]">Top of Funnel</th>
                                  <th className="px-2 py-1 text-right text-orange-800 font-semibold text-[10px]">Launches</th>
                                </tr>
                              </thead>
                              <tbody>
                                {MONTHS.map((month, monthIndex) => (
                                  <tr key={monthIndex} className="border-t border-purple-100">
                                    <td className="px-2 py-1 font-semibold text-gray-700 border-r border-purple-200">{month}</td>
                                    <td className="px-2 py-1 text-right text-purple-900">
                                      {baselineReport?.monthlyData[monthIndex].topOfFunnel.toLocaleString() || 0}
                                    </td>
                                    <td className="px-2 py-1 text-right text-gray-900 border-r border-purple-200">
                                      {baselineReport?.monthlyData[monthIndex].scheduledLaunches.toLocaleString() || 0}
                                    </td>
                                    <td className="px-2 py-1 text-right text-orange-900">
                                      {stretchReport?.monthlyData[monthIndex].topOfFunnel.toLocaleString() || 0}
                                    </td>
                                    <td className="px-2 py-1 text-right text-orange-900">
                                      {stretchReport?.monthlyData[monthIndex].scheduledLaunches.toLocaleString() || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tactical GTM View */}
            <div className="mb-4 bg-white rounded-lg p-4 border-2 border-purple-200">
              <button
                onClick={() => toggleFunnelSection('tactical')}
                className="w-full flex items-center justify-between text-purple-900 font-bold text-sm"
              >
                <span>GTM Motion Top of Funnel Details</span>
                {funnelSectionsOpen.tactical ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {funnelSectionsOpen.tactical && (
                <div className="grid gap-4 mt-3">
                  {scenario.plans.map(plan => (
                    <div key={plan.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wide">{plan.type} Plan</p>
                          <p className="text-base font-bold text-gray-900">
                            {funnelCalculations.masterGroupFunnelData[plan.id]?.totalOpps?.toLocaleString() || 0} opps
                          </p>
                        </div>
                        <p className="text-sm text-gray-600">
                          {funnelCalculations.masterGroupFunnelData[plan.id]?.totalMerchants?.toLocaleString() || 0} merchants
                        </p>
                      </div>

                      <div className="space-y-3">
                        {plan.gtm_groups.map(gtm => {
                          const gtmFunnel = funnelCalculations.gtmGroupFunnelData[gtm.id];
                          return (
                            <div key={gtm.id} className="bg-white rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{gtm.name}</p>
                                  <p className="text-xs uppercase text-gray-500">{gtm.type}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 uppercase tracking-wide">Top of Funnel</p>
                                  <p className="text-lg font-bold text-purple-900">
                                    {gtmFunnel?.totalOpps?.toLocaleString() || 0}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 text-xs gap-3 mb-3">
                                <div>
                                  <p className="text-gray-500 uppercase tracking-wide text-[10px]">Merchants</p>
                                  <p className="font-semibold text-gray-900">{gtmFunnel?.totalMerchants?.toLocaleString() || 0}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 uppercase tracking-wide text-[10px]">Avg Sales Cycle</p>
                                  <p className="font-semibold text-gray-900">
                                    {Math.round(gtm.segments.reduce((sum, seg) => sum + conversionRates[seg.segment_type].avgDaysToClose, 0) /
                                      (gtm.segments.length || 1)).toLocaleString()} days
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 uppercase tracking-wide text-[10px]">Avg Integration</p>
                                  <p className="font-semibold text-gray-900">
                                    {Math.round(gtm.segments.reduce((sum, seg) => sum + localSettings.integrationTimelineDays[seg.segment_type], 0) /
                                      (gtm.segments.length || 1)).toLocaleString()} days
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {gtm.segments.map(segment => {
                                  const rates = conversionRates[segment.segment_type];
                                  const integrationDays = localSettings.integrationTimelineDays[segment.segment_type];
                                  return (
                                    <div key={segment.id} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${SEGMENT_CONFIGS[segment.segment_type].color} ${SEGMENT_CONFIGS[segment.segment_type].textColor}`}>
                                          {segment.segment_type}
                                        </span>
                                        <span className="text-gray-600">{segment.segment_type}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <p className="text-[10px] uppercase text-gray-500">Close Rate</p>
                                          <p className="font-semibold text-gray-900">{rates.oppToClose.toFixed(1)}%</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] uppercase text-gray-500">Sales Cycle</p>
                                          <p className="font-semibold text-gray-900">{rates.avgDaysToClose}d</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] uppercase text-gray-500">Integration</p>
                                          <p className="font-semibold text-gray-900">{integrationDays}d</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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

        {/* Plan Summary - Consolidated Section */}
        <div className="bg-blue-50 rounded-lg border-2 border-blue-400">
          <button
            onClick={() => setPlanSummaryOpen(!planSummaryOpen)}
            className="w-full flex items-center justify-between px-3 py-2"
          >
            <p className="text-sm font-bold text-blue-900">Plan Summary</p>
            {planSummaryOpen ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
          </button>

          {planSummaryOpen && (
            <div className="p-3 space-y-3">
              {/* Baseline vs Stretch Quarterly Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                {/* Baseline */}
                <div className="bg-gray-100 rounded-lg border-2 border-gray-400">
                  <button
                    onClick={() => togglePlanSummary('baseline')}
                    className="w-full flex items-center justify-between px-3 py-2 border-b border-gray-300"
                  >
                    <p className="text-sm font-bold text-gray-900">Baseline Plan</p>
                    {planSummariesOpen.baseline ? <ChevronDown className="w-4 h-4 text-gray-700" /> : <ChevronRight className="w-4 h-4 text-gray-700" />}
                  </button>
                  {planSummariesOpen.baseline && (
                    <div className="p-3 space-y-3">
                      {planQuarterData && baselinePlan && planQuarterData[baselinePlan.id] && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-white">
                                <th className="px-2 py-1 text-left text-gray-600 font-semibold">Quarter</th>
                                <th className="px-2 py-1 text-right text-gray-600 font-semibold">Shipments</th>
                                <th className="px-2 py-1 text-right text-gray-600 font-semibold">Realized</th>
                                <th className="px-2 py-1 text-right text-gray-600 font-semibold">ARR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {QUARTER_KEYS.map(quarter => {
                                const data = planQuarterData[baselinePlan.id][quarter];
                                return (
                                  <tr key={`baseline-${quarter}`} className="border-t border-gray-100">
                                    <td className="px-2 py-1 font-semibold text-gray-700">{quarter}</td>
                                    <td className="px-2 py-1 text-right text-gray-900">{Math.round(data.shipments).toLocaleString()}</td>
                                    <td className="px-2 py-1 text-right text-gray-900">${Math.round(data.realized).toLocaleString()}</td>
                                    <td className="px-2 py-1 text-right text-gray-900">${Math.round(data.arr).toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-gray-100 font-semibold text-gray-800 border-t border-gray-200">
                                <td className="px-2 py-1">Total</td>
                                <td className="px-2 py-1 text-right">
                                  {calculations.masterGroupTotals[baselinePlan?.id || '']?.toLocaleString() || '0'}
                                </td>
                                <td className="px-2 py-1 text-right">
                                  ${(calculations.masterGroupRevenueBreakdown[baselinePlan?.id || '']?.realized || 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-1 text-right">
                                  ${(calculations.masterGroupRevenueBreakdown[baselinePlan?.id || '']?.arr || 0).toLocaleString()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Stretch */}
                <div className="bg-orange-50 rounded-lg border-2 border-orange-400">
                  <button
                    onClick={() => togglePlanSummary('stretch')}
                    className="w-full flex items-center justify-between px-3 py-2 border-b border-orange-200"
                  >
                    <p className="text-sm font-bold text-orange-900">Stretch Plan</p>
                    {planSummariesOpen.stretch ? <ChevronDown className="w-4 h-4 text-orange-700" /> : <ChevronRight className="w-4 h-4 text-orange-700" />}
                  </button>
                  {planSummariesOpen.stretch && (
                    <div className="p-3 space-y-3">
                      {planQuarterData && stretchPlan && planQuarterData[stretchPlan.id] && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-orange-200 rounded-lg overflow-hidden">
                            <thead>
                              <tr className="bg-orange-100">
                                <th className="px-2 py-1 text-left text-orange-800 font-semibold">Quarter</th>
                                <th className="px-2 py-1 text-right text-orange-800 font-semibold">Shipments</th>
                                <th className="px-2 py-1 text-right text-orange-800 font-semibold">Realized</th>
                                <th className="px-2 py-1 text-right text-orange-800 font-semibold">ARR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {QUARTER_KEYS.map(quarter => {
                                const data = planQuarterData[stretchPlan.id][quarter];
                                return (
                                  <tr key={`stretch-${quarter}`} className="border-t border-orange-100">
                                    <td className="px-2 py-1 font-semibold text-orange-800">{quarter}</td>
                                    <td className="px-2 py-1 text-right text-orange-900">{Math.round(data.shipments).toLocaleString()}</td>
                                    <td className="px-2 py-1 text-right text-orange-900">${Math.round(data.realized).toLocaleString()}</td>
                                    <td className="px-2 py-1 text-right text-orange-900">${Math.round(data.arr).toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-orange-100 font-semibold text-orange-900 border-t border-orange-200">
                                <td className="px-2 py-1">Total</td>
                                <td className="px-2 py-1 text-right">
                                  {calculations.masterGroupTotals[stretchPlan?.id || '']?.toLocaleString() || '0'}
                                </td>
                                <td className="px-2 py-1 text-right">
                                  ${(calculations.masterGroupRevenueBreakdown[stretchPlan?.id || '']?.realized || 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-1 text-right">
                                  ${(calculations.masterGroupRevenueBreakdown[stretchPlan?.id || '']?.arr || 0).toLocaleString()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Segment Summary */}
              {monthlyReportData && (
                <div className="bg-white rounded-lg border border-blue-300">
                  <button
                    onClick={() => setSegmentSummaryOpen(!segmentSummaryOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-blue-100"
                  >
                    <p className="text-sm font-bold text-blue-900">Segment Summary</p>
                    {segmentSummaryOpen ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
                  </button>
                  {segmentSummaryOpen && (
                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Baseline Column */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Baseline</p>
                          {(['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).map(segmentGroup => {
                            const report = monthlyReportData.reports.find(
                              r => r.planType === 'Baseline' && r.segmentGroup === segmentGroup
                            );
                            if (!report) return null;

                            const lastMonth = report.monthlyData[11];
                            const totalShipments = report.monthlyData.reduce((sum, m) => sum + m.shipments, 0);
                            const totalMerchants = report.monthlyData.reduce((sum, m) => sum + m.goLiveMerchants, 0);
                            const totalARR = report.monthlyData.reduce((sum, m) => sum + m.arr, 0);

                            return (
                              <div key={segmentGroup} className="bg-white rounded border border-gray-300 p-2">
                                <p className="text-xs font-semibold text-gray-900 mb-1">{segmentGroup}</p>
                                <div className="grid grid-cols-2 gap-1 text-[10px]">
                                  <div>
                                    <span className="text-gray-600">Total Merchants:</span>
                                    <span className="font-bold text-gray-900 ml-1">
                                      {totalMerchants.toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Total Shipments:</span>
                                    <span className="font-bold text-gray-900 ml-1">
                                      {Math.round(totalShipments).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Year 1 Revenue:</span>
                                    <span className="font-bold text-green-900 ml-1">
                                      ${Math.round(lastMonth.cumulativeRevenue).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Total ARR:</span>
                                    <span className="font-bold text-blue-900 ml-1">
                                      ${Math.round(totalARR).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Stretch Column */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Stretch</p>
                          {(['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).map(segmentGroup => {
                            const report = monthlyReportData.reports.find(
                              r => r.planType === 'Stretch' && r.segmentGroup === segmentGroup
                            );
                            if (!report) return null;

                            const lastMonth = report.monthlyData[11];
                            const totalShipments = report.monthlyData.reduce((sum, m) => sum + m.shipments, 0);
                            const totalMerchants = report.monthlyData.reduce((sum, m) => sum + m.goLiveMerchants, 0);
                            const totalARR = report.monthlyData.reduce((sum, m) => sum + m.arr, 0);

                            return (
                              <div key={segmentGroup} className="bg-orange-50 rounded border border-orange-300 p-2">
                                <p className="text-xs font-semibold text-orange-900 mb-1">{segmentGroup}</p>
                                <div className="grid grid-cols-2 gap-1 text-[10px]">
                                  <div>
                                    <span className="text-orange-700">Total Merchants:</span>
                                    <span className="font-bold text-orange-900 ml-1">
                                      {totalMerchants.toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-orange-700">Total Shipments:</span>
                                    <span className="font-bold text-orange-900 ml-1">
                                      {Math.round(totalShipments).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-orange-700">Year 1 Revenue:</span>
                                    <span className="font-bold text-green-900 ml-1">
                                      ${Math.round(lastMonth.cumulativeRevenue).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-orange-700">Total ARR:</span>
                                    <span className="font-bold text-blue-900 ml-1">
                                      ${Math.round(totalARR).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Conditional Based on Tab */}
      {activeTab === 'visual' ? (
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
            {quarterVisualData && (
              <div className="mt-8 pt-6 border-t-2 border-gray-300">
                <h4 className="text-md font-bold text-gray-900 mb-4">Quarterly Breakdown</h4>
                <div className="grid grid-cols-4 gap-4">
                  {QUARTER_KEYS.map((quarter) => {
                    const data = quarterVisualData[quarter];
                    return (
                      <div key={quarter} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                        <p className="text-sm font-semibold text-gray-600 mb-2">{quarter}</p>
                        <p className="text-xs uppercase text-gray-500 mb-1 tracking-wide">Shipments</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {data.shipments.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <div className="mt-4 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-blue-700">
                            <span className="font-semibold">Baseline Realized</span>
                            <span className="font-bold">${Math.round(data.baselineRealized).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-blue-500">
                            <span className="font-semibold">Baseline ARR</span>
                            <span className="font-bold">${Math.round(data.baselineArr).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-orange-700 border-t border-gray-200 pt-2">
                            <span className="font-semibold">Stretch Realized</span>
                            <span className="font-bold">${Math.round(data.stretchRealized).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-orange-500">
                            <span className="font-semibold">Stretch ARR</span>
                            <span className="font-bold">${Math.round(data.stretchArr).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Peak Season Multipliers</h3>
              <p className="text-sm text-gray-600 mb-4">
                Adjust the percent increase applied to November and December shipments for each segment type.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-4 py-2 text-left">Segment</th>
                      <th className="px-4 py-2 text-left">November Boost</th>
                      <th className="px-4 py-2 text-left">December Boost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(SEGMENT_CONFIGS) as SegmentType[]).map(segmentType => (
                      <tr key={segmentType} className="border-t border-gray-200">
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${SEGMENT_CONFIGS[segmentType].color} ${SEGMENT_CONFIGS[segmentType].textColor}`}>
                            {segmentType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={localSettings.seasonality[segmentType].november}
                              onChange={(e) => handleSeasonalityChange(segmentType, 'november', e.target.value)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded"
                              step="1"
                            />
                            <span className="text-gray-600 text-sm">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={localSettings.seasonality[segmentType].december}
                              onChange={(e) => handleSeasonalityChange(segmentType, 'december', e.target.value)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded"
                              step="1"
                            />
                            <span className="text-gray-600 text-sm">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-semibold mb-1">Ramp Reminder</p>
              <p>
                Merchants now ship 50% of their SPM in their first month before moving to full output.
                Peak season multipliers apply on top of that ramp, so high-performing segments can capture seasonal upside automatically.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'monthly' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Revenue Report</h3>

            {monthlyReportData && (
              <div className="space-y-8">
                {/* Baseline Plan */}
                <div className="border-2 border-gray-400 rounded-lg overflow-hidden">
                  <div className="bg-gray-200 px-4 py-3 border-b-2 border-gray-400">
                    <h4 className="text-md font-bold text-gray-900">Baseline Plan</h4>
                  </div>
                  <div className="p-4 space-y-6">
                    {(['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).map(segmentGroup => {
                      const report = monthlyReportData.reports.find(
                        r => r.planType === 'Baseline' && r.segmentGroup === segmentGroup
                      );
                      if (!report) return null;

                      return (
                        <div key={segmentGroup} className="border border-gray-300 rounded-lg overflow-hidden">
                          <div className="bg-blue-50 px-3 py-2 border-b border-gray-300">
                            <h5 className="text-sm font-bold text-blue-900">{segmentGroup}</h5>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-300">
                                  <th className="px-2 py-2 text-left text-gray-700 font-semibold">Month</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Top of Funnel</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Scheduled Launches</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Go-Live Merchants</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Shipments</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Realized Revenue</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">Cumulative Revenue</th>
                                  <th className="px-2 py-2 text-right text-gray-700 font-semibold">ARR Added</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.monthlyData.map((monthData, monthIndex) => (
                                  <tr key={monthIndex} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-2 py-2 font-semibold text-gray-900">{MONTHS[monthIndex]}</td>
                                    <td className="px-2 py-2 text-right text-purple-900">
                                      {monthData.topOfFunnel.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-900">
                                      {monthData.scheduledLaunches.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-blue-900 font-semibold">
                                      {monthData.goLiveMerchants.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-700">
                                      {Math.round(monthData.shipments).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-green-900 font-semibold">
                                      ${Math.round(monthData.realizedRevenue).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-green-700">
                                      ${Math.round(monthData.cumulativeRevenue).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-blue-700">
                                      ${Math.round(monthData.arr).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stretch Plan */}
                <div className="border-2 border-orange-400 rounded-lg overflow-hidden">
                  <div className="bg-orange-100 px-4 py-3 border-b-2 border-orange-400">
                    <h4 className="text-md font-bold text-orange-900">Stretch Plan</h4>
                  </div>
                  <div className="p-4 space-y-6">
                    {(['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).map(segmentGroup => {
                      const report = monthlyReportData.reports.find(
                        r => r.planType === 'Stretch' && r.segmentGroup === segmentGroup
                      );
                      if (!report) return null;

                      return (
                        <div key={segmentGroup} className="border border-orange-300 rounded-lg overflow-hidden">
                          <div className="bg-orange-50 px-3 py-2 border-b border-orange-300">
                            <h5 className="text-sm font-bold text-orange-900">{segmentGroup}</h5>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-orange-50 border-b border-orange-300">
                                  <th className="px-2 py-2 text-left text-orange-800 font-semibold">Month</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Top of Funnel</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Scheduled Launches</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Go-Live Merchants</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Shipments</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Realized Revenue</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">Cumulative Revenue</th>
                                  <th className="px-2 py-2 text-right text-orange-800 font-semibold">ARR Added</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.monthlyData.map((monthData, monthIndex) => (
                                  <tr key={monthIndex} className="border-b border-orange-200 hover:bg-orange-50">
                                    <td className="px-2 py-2 font-semibold text-orange-900">{MONTHS[monthIndex]}</td>
                                    <td className="px-2 py-2 text-right text-purple-900">
                                      {monthData.topOfFunnel.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-orange-900">
                                      {monthData.scheduledLaunches.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-orange-900 font-semibold">
                                      {monthData.goLiveMerchants.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-orange-800">
                                      {Math.round(monthData.shipments).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-green-900 font-semibold">
                                      ${Math.round(monthData.realizedRevenue).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-green-800">
                                      ${Math.round(monthData.cumulativeRevenue).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-blue-800">
                                      ${Math.round(monthData.arr).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
