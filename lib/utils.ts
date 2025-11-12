import { ScenarioWithData, PlanWithGtmGroups, Calculations, FunnelCalculations, QUARTERS } from './types';

export function calculateMetrics(
  scenario: ScenarioWithData,
  rps: number,
  targetShipments: number,
  conversionRates: Record<string, { oppToClose: number; avgDaysToClose: number }>
): Calculations {
  let totalShipments = 0;
  let realizedRevenue = 0;
  let annualizedRunRate = 0;
  const monthlyShipments = Array(12).fill(0);
  const quarterlyBreakdown = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
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
            const monthsRemaining = 12 - monthIndex;
            const shipmentsFromThisLaunch = launchCount * segment.spm * monthsRemaining;
            const revenueFromThisLaunch = shipmentsFromThisLaunch * rps;
            const annualizedFromThisLaunch = launchCount * segment.spm * 12 * rps;

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

            for (let m = monthIndex; m < 12; m++) {
              monthlyShipments[m] += launchCount * segment.spm;
            }
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
    const quarter = Object.entries(QUARTERS).find(([_, months]) =>
      (months as readonly number[]).includes(monthIndex)
    )?.[0] as keyof typeof quarterlyBreakdown;
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
  conversionRates: Record<string, { oppToClose: number; avgDaysToClose: number }>
): FunnelCalculations {
  const monthlyOppsTotal = Array(12).fill(0);
  const masterGroupFunnelData: Record<string, any> = {}; // Plan funnel data
  const gtmGroupFunnelData: Record<string, any> = {};
  const segmentFunnelData: Record<string, any> = {};

  scenario.plans.forEach(plan => {
    const planMonthlyOpps = Array(12).fill(0);
    let planTotalOpps = 0;
    let planTotalMerchants = 0;

    plan.gtm_groups.forEach(gtmGroup => {
      const gtmGroupMonthlyOpps = Array(12).fill(0);
      let gtmGroupTotalOpps = 0;
      let gtmGroupTotalMerchants = 0;

      gtmGroup.segments.forEach(segment => {
        const rates = conversionRates[segment.segment_type];
        const segmentMonthlyOpps = Array(12).fill(0);
        let segmentTotalOpps = 0;
        let segmentTotalMerchants = 0;

        segment.launches.forEach((merchantsToClose, closeMonth) => {
          if (merchantsToClose > 0 && rates) {
            const monthsBack = Math.round(rates.avgDaysToClose / 30);
            const oppCreationMonth = Math.max(0, closeMonth - monthsBack);

            const oppsNeeded = Math.ceil(merchantsToClose / (rates.oppToClose / 100));

            segmentMonthlyOpps[oppCreationMonth] += oppsNeeded;
            gtmGroupMonthlyOpps[oppCreationMonth] += oppsNeeded;
            planMonthlyOpps[oppCreationMonth] += oppsNeeded;
            monthlyOppsTotal[oppCreationMonth] += oppsNeeded;

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
          totalMerchants: segmentTotalMerchants
        };
      });

      gtmGroupFunnelData[gtmGroup.id] = {
        monthlyOpps: gtmGroupMonthlyOpps,
        totalOpps: gtmGroupTotalOpps,
        totalMerchants: gtmGroupTotalMerchants
      };
    });

    masterGroupFunnelData[plan.id] = {
      monthlyOpps: planMonthlyOpps,
      totalOpps: planTotalOpps,
      totalMerchants: planTotalMerchants
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
