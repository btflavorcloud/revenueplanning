import {
  ScenarioWithData,
  Calculations,
  FunnelCalculations,
  QUARTERS,
  QUARTER_KEYS,
  QuarterBreakdown,
  SeasonalitySettings,
  IntegrationTimelineSettings,
  SegmentType,
  MonthlyReportData,
  SegmentGroup,
  SEGMENT_GROUP_MAPPING,
  PlanSegmentGroupMonthly,
  MonthlySegmentGroupMetrics,
} from './types';

const FIRST_MONTH_RAMP_FACTOR = 0.5;

const createEmptyQuarterBreakdown = (): QuarterBreakdown => ({
  Q1: 0,
  Q2: 0,
  Q3: 0,
  Q4: 0,
});

const getQuarterFromMonth = (monthIndex: number): keyof typeof QUARTERS | null => {
  return QUARTER_KEYS.find((quarter) => (QUARTERS[quarter] as readonly number[]).includes(monthIndex)) ?? null;
};

const getSeasonalMultiplier = (
  segmentType: SegmentType,
  monthIndex: number,
  seasonalitySettings: SeasonalitySettings
): number => {
  const segmentSettings = seasonalitySettings[segmentType];
  if (!segmentSettings) return 1;
  if (monthIndex === 10) return 1 + (segmentSettings.november / 100);
  if (monthIndex === 11) return 1 + (segmentSettings.december / 100);
  return 1;
};

const getAnnualSeasonalityFactor = (
  segmentType: SegmentType,
  seasonalitySettings: SeasonalitySettings
): number => {
  const novMultiplier = getSeasonalMultiplier(segmentType, 10, seasonalitySettings);
  const decMultiplier = getSeasonalMultiplier(segmentType, 11, seasonalitySettings);
  const regularMonths = 12 - 2;
  return regularMonths + novMultiplier + decMultiplier;
};

const getIntegrationMonths = (
  segmentType: SegmentType,
  integrationTimelineSettings: IntegrationTimelineSettings
): number => {
  const days = integrationTimelineSettings[segmentType] ?? 0;
  if (days <= 0) return 0;
  return Math.max(0, Math.ceil(days / 30));
};

export function calculateMetrics(
  scenario: ScenarioWithData,
  rps: number,
  targetShipments: number,
  _conversionRates: Record<string, { oppToClose: number; avgDaysToClose: number }>,
  seasonalitySettings: SeasonalitySettings,
  integrationTimelineSettings: IntegrationTimelineSettings
): Calculations {
  let totalShipments = 0;
  let realizedRevenue = 0;
  let annualizedRunRate = 0;
  const monthlyShipments = Array(12).fill(0);
  const quarterlyBreakdown = createEmptyQuarterBreakdown();
  const masterGroupTotals: Record<string, number> = {}; // Plan totals
  const masterGroupRevenueBreakdown: Record<string, { realized: number; arr: number }> = {}; // Plan revenue
  const gtmGroupTotals: Record<string, number> = {};
  const gtmGroupRevenueBreakdown: Record<string, { realized: number; arr: number }> = {};
  const segmentTotals: Record<string, number> = {};
  const segmentRevenueBreakdown: Record<string, { realized: number; arr: number }> = {};

  scenario.plans.forEach(plan => {
    let planShipments = 0;
    let planRealized = 0;
    let planARR = 0;

    plan.gtm_groups.forEach(gtmGroup => {
      let gtmGroupShipments = 0;
      let gtmGroupRealized = 0;
      let gtmGroupARR = 0;

      gtmGroup.segments.forEach(segment => {
        let segmentShipments = 0;
        let segmentRealized = 0;
        let segmentARR = 0;

        segment.launches.forEach((launchCount, monthIndex) => {
          if (launchCount > 0) {
            const baseMonthlyShipments = launchCount * segment.spm;
            const annualSeasonalityFactor = getAnnualSeasonalityFactor(segment.segment_type, seasonalitySettings);
            const integrationMonths = getIntegrationMonths(segment.segment_type, integrationTimelineSettings);
            const goLiveMonth = monthIndex + integrationMonths;
            let shipmentsFromThisLaunch = 0;

            if (goLiveMonth < 12) {
              for (let m = goLiveMonth; m < 12; m++) {
                const rampFactor = m === goLiveMonth ? FIRST_MONTH_RAMP_FACTOR : 1;
                const seasonalMultiplier = getSeasonalMultiplier(segment.segment_type, m, seasonalitySettings);
                const shipmentsThisMonth = baseMonthlyShipments * rampFactor * seasonalMultiplier;

                shipmentsFromThisLaunch += shipmentsThisMonth;
                monthlyShipments[m] += shipmentsThisMonth;
              }
            }

            const revenueFromThisLaunch = shipmentsFromThisLaunch * rps;
            const annualizedFromThisLaunch = baseMonthlyShipments * rps * annualSeasonalityFactor;

            totalShipments += shipmentsFromThisLaunch;
            segmentShipments += shipmentsFromThisLaunch;
            gtmGroupShipments += shipmentsFromThisLaunch;
            planShipments += shipmentsFromThisLaunch;

            realizedRevenue += revenueFromThisLaunch;
            segmentRealized += revenueFromThisLaunch;
            gtmGroupRealized += revenueFromThisLaunch;
            planRealized += revenueFromThisLaunch;

            annualizedRunRate += annualizedFromThisLaunch;
            segmentARR += annualizedFromThisLaunch;
            gtmGroupARR += annualizedFromThisLaunch;
            planARR += annualizedFromThisLaunch;

          }
        });

        segmentTotals[segment.id] = segmentShipments;
        segmentRevenueBreakdown[segment.id] = {
          realized: segmentRealized,
          arr: segmentARR
        };
      });

      gtmGroupTotals[gtmGroup.id] = gtmGroupShipments;
      gtmGroupRevenueBreakdown[gtmGroup.id] = {
        realized: gtmGroupRealized,
        arr: gtmGroupARR
      };
    });

    masterGroupTotals[plan.id] = planShipments;
    masterGroupRevenueBreakdown[plan.id] = {
      realized: planRealized,
      arr: planARR
    };
  });

  monthlyShipments.forEach((shipments, monthIndex) => {
    const quarter = getQuarterFromMonth(monthIndex);
    if (quarter) {
      quarterlyBreakdown[quarter] += shipments;
    }
  });

  const percentageToGoal = (totalShipments / targetShipments) * 100;
  const shortfall = targetShipments - totalShipments;

  return {
    totalShipments,
    realizedRevenue,
    annualizedRunRate,
    monthlyShipments,
    quarterlyBreakdown,
    masterGroupTotals,
    masterGroupRevenueBreakdown,
    gtmGroupTotals,
    gtmGroupRevenueBreakdown,
    segmentTotals,
    segmentRevenueBreakdown,
    percentageToGoal,
    shortfall
  };
}

export function calculateFunnelMetrics(
  scenario: ScenarioWithData,
  conversionRates: Record<string, { oppToClose: number; avgDaysToClose: number }>,
  integrationTimelineSettings: IntegrationTimelineSettings
): FunnelCalculations {
  const monthlyOppsTotal = Array(12).fill(0);
  const masterGroupFunnelData: Record<string, any> = {}; // Plan funnel data
  const gtmGroupFunnelData: Record<string, any> = {};
  const segmentFunnelData: Record<string, any> = {};

  scenario.plans.forEach(plan => {
    const planMonthlyOpps = Array(12).fill(0);
    const planQuarterlyOpps = createEmptyQuarterBreakdown();
    let planTotalOpps = 0;
    let planTotalMerchants = 0;

    plan.gtm_groups.forEach(gtmGroup => {
      const gtmGroupMonthlyOpps = Array(12).fill(0);
      const gtmQuarterlyOpps = createEmptyQuarterBreakdown();
      let gtmGroupTotalOpps = 0;
      let gtmGroupTotalMerchants = 0;

      gtmGroup.segments.forEach(segment => {
        const rates = conversionRates[segment.segment_type];
        const segmentMonthlyOpps = Array(12).fill(0);
        const segmentQuarterlyOpps = createEmptyQuarterBreakdown();
        let segmentTotalOpps = 0;
        let segmentTotalMerchants = 0;

        segment.launches.forEach((merchantsToClose, launchMonth) => {
          if (merchantsToClose > 0 && rates) {
            const integrationMonths = getIntegrationMonths(segment.segment_type, integrationTimelineSettings);
            const monthsBack = Math.max(0, Math.round(rates.avgDaysToClose / 30));

            const closeMonth = Math.max(0, launchMonth - integrationMonths);
            const oppCreationMonth = Math.max(0, closeMonth - monthsBack);

            const oppsNeeded = Math.ceil(merchantsToClose / (rates.oppToClose / 100));

            segmentMonthlyOpps[oppCreationMonth] += oppsNeeded;
            gtmGroupMonthlyOpps[oppCreationMonth] += oppsNeeded;
            planMonthlyOpps[oppCreationMonth] += oppsNeeded;
            monthlyOppsTotal[oppCreationMonth] += oppsNeeded;

            const quarter = getQuarterFromMonth(oppCreationMonth);
            if (quarter) {
              segmentQuarterlyOpps[quarter] += oppsNeeded;
              gtmQuarterlyOpps[quarter] += oppsNeeded;
              planQuarterlyOpps[quarter] += oppsNeeded;
            }

            segmentTotalOpps += oppsNeeded;
            gtmGroupTotalOpps += oppsNeeded;
            planTotalOpps += oppsNeeded;
            segmentTotalMerchants += merchantsToClose;
            gtmGroupTotalMerchants += merchantsToClose;
            planTotalMerchants += merchantsToClose;
          }
        });

        segmentFunnelData[segment.id] = {
          monthlyOpps: segmentMonthlyOpps,
          totalOpps: segmentTotalOpps,
          totalMerchants: segmentTotalMerchants,
          quarterlyOpps: segmentQuarterlyOpps,
        };
      });

      gtmGroupFunnelData[gtmGroup.id] = {
        monthlyOpps: gtmGroupMonthlyOpps,
        totalOpps: gtmGroupTotalOpps,
        totalMerchants: gtmGroupTotalMerchants,
        quarterlyOpps: gtmQuarterlyOpps,
      };
    });

    masterGroupFunnelData[plan.id] = {
      monthlyOpps: planMonthlyOpps,
      totalOpps: planTotalOpps,
      totalMerchants: planTotalMerchants,
      quarterlyOpps: planQuarterlyOpps,
    };
  });

  const totalOpps = monthlyOppsTotal.reduce((sum, val) => sum + val, 0);
  const totalMerchants = scenario.plans.reduce((sum, plan) =>
    sum + plan.gtm_groups.reduce((s, gtm) =>
      s + gtm.segments.reduce((ss, segment) =>
        ss + segment.launches.reduce((sss, v) => sss + v, 0), 0), 0), 0
  );

  return {
    masterGroupFunnelData,
    gtmGroupFunnelData,
    segmentFunnelData,
    monthlyOppsTotal,
    totalOpps,
    totalMerchants
  };
}

export function calculateMonthlyReportData(
  scenario: ScenarioWithData,
  rps: number,
  conversionRates: Record<string, { oppToClose: number; avgDaysToClose: number }>,
  seasonalitySettings: SeasonalitySettings,
  integrationTimelineSettings: IntegrationTimelineSettings
): MonthlyReportData {
  const reports: PlanSegmentGroupMonthly[] = [];

  scenario.plans.forEach(plan => {
    // Initialize data structure for each segment group
    const segmentGroupData: Record<SegmentGroup, MonthlySegmentGroupMetrics[]> = {
      'SMB': Array(12).fill(null).map(() => ({
        scheduledLaunches: 0,
        goLiveMerchants: 0,
        topOfFunnel: 0,
        realizedRevenue: 0,
        cumulativeRevenue: 0,
        arr: 0,
        shipments: 0,
        cumulativeShipments: 0,
        cumulativeARR: 0,
      })),
      'Mid-Market': Array(12).fill(null).map(() => ({
        scheduledLaunches: 0,
        goLiveMerchants: 0,
        topOfFunnel: 0,
        realizedRevenue: 0,
        cumulativeRevenue: 0,
        arr: 0,
        shipments: 0,
        cumulativeShipments: 0,
        cumulativeARR: 0,
      })),
      'Enterprise': Array(12).fill(null).map(() => ({
        scheduledLaunches: 0,
        goLiveMerchants: 0,
        topOfFunnel: 0,
        realizedRevenue: 0,
        cumulativeRevenue: 0,
        arr: 0,
        shipments: 0,
        cumulativeShipments: 0,
        cumulativeARR: 0,
      })),
    };

    // Process each segment
    plan.gtm_groups.forEach(gtmGroup => {
      gtmGroup.segments.forEach(segment => {
        const segmentGroup = SEGMENT_GROUP_MAPPING[segment.segment_type];
        const rates = conversionRates[segment.segment_type];
        const integrationMonths = getIntegrationMonths(segment.segment_type, integrationTimelineSettings);
        const annualSeasonalityFactor = getAnnualSeasonalityFactor(segment.segment_type, seasonalitySettings);

        // Process each launch month
        segment.launches.forEach((launchCount, launchMonth) => {
          if (launchCount === 0) return;

          // 1. Scheduled launches (input value)
          segmentGroupData[segmentGroup][launchMonth].scheduledLaunches += launchCount;

          // 2. Go-live merchants (after integration delay)
          const goLiveMonth = launchMonth + integrationMonths;

          if (goLiveMonth < 12) {
            segmentGroupData[segmentGroup][goLiveMonth].goLiveMerchants += launchCount;

            // 3. Calculate monthly shipments and revenue
            const baseMonthlyShipments = launchCount * segment.spm;

            for (let currentMonth = goLiveMonth; currentMonth < 12; currentMonth++) {
              const rampFactor = currentMonth === goLiveMonth ? FIRST_MONTH_RAMP_FACTOR : 1;
              const seasonalMultiplier = getSeasonalMultiplier(segment.segment_type, currentMonth, seasonalitySettings);
              const shipmentsThisMonth = baseMonthlyShipments * rampFactor * seasonalMultiplier;
              const revenueThisMonth = shipmentsThisMonth * rps;

              segmentGroupData[segmentGroup][currentMonth].shipments += shipmentsThisMonth;
              segmentGroupData[segmentGroup][currentMonth].realizedRevenue += revenueThisMonth;
            }

            // 4. ARR from this go-live
            const arr = baseMonthlyShipments * rps * annualSeasonalityFactor;
            segmentGroupData[segmentGroup][goLiveMonth].arr += arr;
          }

          // 5. Top of funnel (opportunities needed)
          if (rates) {
            const monthsBack = Math.max(0, Math.round(rates.avgDaysToClose / 30));
            const closeMonth = Math.max(0, launchMonth - integrationMonths);
            const oppCreationMonth = Math.max(0, closeMonth - monthsBack);
            const oppsNeeded = Math.ceil(launchCount / (rates.oppToClose / 100));

            if (oppCreationMonth < 12) {
              segmentGroupData[segmentGroup][oppCreationMonth].topOfFunnel += oppsNeeded;
            }
          }
        });
      });
    });

    // Calculate cumulative values for each segment group
    (['SMB', 'Mid-Market', 'Enterprise'] as SegmentGroup[]).forEach(segmentGroup => {
      let cumulativeRevenue = 0;
      let cumulativeShipments = 0;
      let cumulativeARR = 0;

      segmentGroupData[segmentGroup].forEach(monthData => {
        cumulativeRevenue += monthData.realizedRevenue;
        cumulativeShipments += monthData.shipments;
        cumulativeARR += monthData.arr;

        monthData.cumulativeRevenue = cumulativeRevenue;
        monthData.cumulativeShipments = cumulativeShipments;
        monthData.cumulativeARR = cumulativeARR;
      });

      // Add to reports
      reports.push({
        planId: plan.id,
        planType: plan.type,
        segmentGroup,
        monthlyData: segmentGroupData[segmentGroup],
      });
    });
  });

  return { reports };
}

// Debounce utility for auto-save
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
