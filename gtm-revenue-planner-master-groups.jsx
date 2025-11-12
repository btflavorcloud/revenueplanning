import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, Plus, Download, DollarSign, Zap, ChevronDown, ChevronRight, Layers } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11]
};

const SEGMENT_CONFIGS = {
  SMB: { label: 'SMB', defaultSPM: 100, color: 'bg-yellow-400', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' },
  MM: { label: 'MM', defaultSPM: 500, color: 'bg-blue-400', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
  ENT: { label: 'ENT', defaultSPM: 1000, color: 'bg-purple-400', borderColor: 'border-purple-500', textColor: 'text-purple-700' },
  'ENT+': { label: 'ENT+', defaultSPM: 3000, color: 'bg-pink-400', borderColor: 'border-pink-500', textColor: 'text-pink-700' },
  Flagship: { label: 'Flagship', defaultSPM: 5000, color: 'bg-red-400', borderColor: 'border-red-500', textColor: 'text-red-700' },
};

const GTM_COLORS = {
  Marketing: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  Sales: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  Partnerships: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
  Custom: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
};

const MASTER_GROUP_COLORS = {
  Baseline: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-900', accent: 'bg-slate-500' },
  Stretch: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', accent: 'bg-orange-500' },
  Custom: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-900', accent: 'bg-gray-500' },
};

export default function ShipmentPlanner() {
  const [activeTab, setActiveTab] = useState('output');
  
  // New structure: Master Groups > GTM Groups > Segments
  const [masterGroups, setMasterGroups] = useState([
    {
      id: 'master-1',
      name: 'Baseline Plan',
      type: 'Baseline',
      collapsed: false,
      gtmGroups: [
        {
          id: '1-1',
          name: 'Marketing',
          type: 'Marketing',
          collapsed: false,
          segments: [
            { id: '1-1-1', segment: 'SMB', spm: 100, launches: Array(12).fill(0) },
          ]
        },
        {
          id: '1-2',
          name: 'Sales',
          type: 'Sales',
          collapsed: false,
          segments: [
            { id: '1-2-1', segment: 'MM', spm: 500, launches: Array(12).fill(0) },
          ]
        },
      ]
    },
    {
      id: 'master-2',
      name: 'Stretch Plan',
      type: 'Stretch',
      collapsed: false,
      gtmGroups: [
        {
          id: '2-1',
          name: 'Sales',
          type: 'Sales',
          collapsed: false,
          segments: [
            { id: '2-1-1', segment: 'ENT', spm: 1000, launches: Array(12).fill(0) },
          ]
        },
      ]
    },
  ]);

  const [conversionRates, setConversionRates] = useState({
    SMB: { oppToClose: 25, avgDaysToClose: 60 },
    MM: { oppToClose: 20, avgDaysToClose: 90 },
    ENT: { oppToClose: 20, avgDaysToClose: 120 },
    'ENT+': { oppToClose: 10, avgDaysToClose: 180 },
    Flagship: { oppToClose: 10, avgDaysToClose: 180 },
  });

  const TARGET_SHIPMENTS = 400000;
  const [rps, setRps] = useState(40);

  // Master Group operations
  const addMasterGroup = () => {
    const newMasterGroup = {
      id: `master-${Date.now()}`,
      name: 'New Scenario',
      type: 'Custom',
      collapsed: false,
      gtmGroups: []
    };
    setMasterGroups([...masterGroups, newMasterGroup]);
  };

  const updateMasterGroupName = (masterGroupId, newName) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId ? { ...mg, name: newName } : mg
    ));
  };

  const updateMasterGroupType = (masterGroupId, newType) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId ? { ...mg, type: newType } : mg
    ));
  };

  const toggleMasterGroupCollapse = (masterGroupId) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId ? { ...mg, collapsed: !mg.collapsed } : mg
    ));
  };

  const removeMasterGroup = (masterGroupId) => {
    setMasterGroups(masterGroups.filter(mg => mg.id !== masterGroupId));
  };

  // GTM Group operations
  const addGtmGroup = (masterGroupId) => {
    const newGtmGroup = {
      id: `${masterGroupId}-${Date.now()}`,
      name: 'New GTM Motion',
      type: 'Custom',
      collapsed: false,
      segments: []
    };
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? { ...mg, gtmGroups: [...mg.gtmGroups, newGtmGroup] }
        : mg
    ));
  };

  const updateGroupName = (masterGroupId, gtmGroupId, newName) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId ? { ...gtm, name: newName } : gtm
            )
          }
        : mg
    ));
  };

  const updateGroupType = (masterGroupId, gtmGroupId, newType) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId ? { ...gtm, type: newType } : gtm
            )
          }
        : mg
    ));
  };

  const toggleGroupCollapse = (masterGroupId, gtmGroupId) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId ? { ...gtm, collapsed: !gtm.collapsed } : gtm
            )
          }
        : mg
    ));
  };

  const removeGroup = (masterGroupId, gtmGroupId) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? { ...mg, gtmGroups: mg.gtmGroups.filter(gtm => gtm.id !== gtmGroupId) }
        : mg
    ));
  };

  // Segment operations
  const addSegmentToGroup = (masterGroupId, gtmGroupId, segmentType) => {
    const config = SEGMENT_CONFIGS[segmentType];
    const newSegment = {
      id: `${gtmGroupId}-${Date.now()}`,
      segment: segmentType,
      spm: config.defaultSPM,
      launches: Array(12).fill(0)
    };
    
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId
                ? { ...gtm, segments: [...gtm.segments, newSegment] }
                : gtm
            )
          }
        : mg
    ));
  };

  const updateSegmentLaunches = (masterGroupId, gtmGroupId, segmentId, monthIndex, value) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId
                ? {
                    ...gtm,
                    segments: gtm.segments.map(seg =>
                      seg.id === segmentId
                        ? { ...seg, launches: seg.launches.map((v, i) => i === monthIndex ? parseInt(value) || 0 : v) }
                        : seg
                    )
                  }
                : gtm
            )
          }
        : mg
    ));
  };

  const updateSegmentSPM = (masterGroupId, gtmGroupId, segmentId, value) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId
                ? {
                    ...gtm,
                    segments: gtm.segments.map(seg =>
                      seg.id === segmentId ? { ...seg, spm: parseInt(value) || 0 } : seg
                    )
                  }
                : gtm
            )
          }
        : mg
    ));
  };

  const removeSegment = (masterGroupId, gtmGroupId, segmentId) => {
    setMasterGroups(masterGroups.map(mg =>
      mg.id === masterGroupId
        ? {
            ...mg,
            gtmGroups: mg.gtmGroups.map(gtm =>
              gtm.id === gtmGroupId
                ? { ...gtm, segments: gtm.segments.filter(seg => seg.id !== segmentId) }
                : gtm
            )
          }
        : mg
    ));
  };

  const updateConversionRate = (segment, field, value) => {
    setConversionRates({
      ...conversionRates,
      [segment]: { ...conversionRates[segment], [field]: parseFloat(value) || 0 }
    });
  };

  const calculations = useMemo(() => {
    let totalShipments = 0;
    let realizedRevenue = 0;
    let annualizedRunRate = 0;
    const monthlyShipments = Array(12).fill(0);
    const quarterlyBreakdown = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const masterGroupTotals = {};
    const masterGroupRevenueBreakdown = {};
    const gtmGroupTotals = {};
    const gtmGroupRevenueBreakdown = {};
    const segmentTotals = {};
    const segmentRevenueBreakdown = {};

    masterGroups.forEach(masterGroup => {
      let masterGroupShipments = 0;
      let masterGroupRealized = 0;
      let masterGroupARR = 0;

      masterGroup.gtmGroups.forEach(gtmGroup => {
        let gtmGroupShipments = 0;
        let gtmGroupRealized = 0;
        let gtmGroupARR = 0;

        gtmGroup.segments.forEach(row => {
          let segmentShipments = 0;
          let segmentRealized = 0;
          let segmentARR = 0;

          row.launches.forEach((launchCount, monthIndex) => {
            if (launchCount > 0) {
              const monthsRemaining = 12 - monthIndex;
              const shipmentsFromThisLaunch = launchCount * row.spm * monthsRemaining;
              const revenueFromThisLaunch = shipmentsFromThisLaunch * rps;
              const annualizedFromThisLaunch = launchCount * row.spm * 12 * rps;
              
              totalShipments += shipmentsFromThisLaunch;
              segmentShipments += shipmentsFromThisLaunch;
              gtmGroupShipments += shipmentsFromThisLaunch;
              masterGroupShipments += shipmentsFromThisLaunch;
              
              realizedRevenue += revenueFromThisLaunch;
              segmentRealized += revenueFromThisLaunch;
              gtmGroupRealized += revenueFromThisLaunch;
              masterGroupRealized += revenueFromThisLaunch;
              
              annualizedRunRate += annualizedFromThisLaunch;
              segmentARR += annualizedFromThisLaunch;
              gtmGroupARR += annualizedFromThisLaunch;
              masterGroupARR += annualizedFromThisLaunch;
              
              for (let m = monthIndex; m < 12; m++) {
                monthlyShipments[m] += launchCount * row.spm;
              }
            }
          });

          segmentTotals[row.id] = segmentShipments;
          segmentRevenueBreakdown[row.id] = {
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

      masterGroupTotals[masterGroup.id] = masterGroupShipments;
      masterGroupRevenueBreakdown[masterGroup.id] = {
        realized: masterGroupRealized,
        arr: masterGroupARR
      };
    });

    monthlyShipments.forEach((shipments, monthIndex) => {
      const quarter = Object.entries(QUARTERS).find(([_, months]) => 
        months.includes(monthIndex)
      )?.[0];
      if (quarter) {
        quarterlyBreakdown[quarter] += shipments;
      }
    });

    const percentageToGoal = (totalShipments / TARGET_SHIPMENTS) * 100;
    const shortfall = TARGET_SHIPMENTS - totalShipments;

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
  }, [masterGroups, rps]);

  // Calculate opportunity creation requirements by month
  const funnelCalculations = useMemo(() => {
    const monthlyOppsTotal = Array(12).fill(0);
    const masterGroupFunnelData = {};
    const gtmGroupFunnelData = {};
    const segmentFunnelData = {};

    masterGroups.forEach(masterGroup => {
      const masterGroupMonthlyOpps = Array(12).fill(0);
      let masterGroupTotalOpps = 0;
      let masterGroupTotalMerchants = 0;

      masterGroup.gtmGroups.forEach(gtmGroup => {
        const gtmGroupMonthlyOpps = Array(12).fill(0);
        let gtmGroupTotalOpps = 0;
        let gtmGroupTotalMerchants = 0;

        gtmGroup.segments.forEach(row => {
          const rates = conversionRates[row.segment];
          const segmentMonthlyOpps = Array(12).fill(0);
          let segmentTotalOpps = 0;
          let segmentTotalMerchants = 0;
          
          row.launches.forEach((merchantsToClose, closeMonth) => {
            if (merchantsToClose > 0 && rates) {
              const monthsBack = Math.round(rates.avgDaysToClose / 30);
              const oppCreationMonth = Math.max(0, closeMonth - monthsBack);
              
              const oppsNeeded = Math.ceil(merchantsToClose / (rates.oppToClose / 100));
              
              segmentMonthlyOpps[oppCreationMonth] += oppsNeeded;
              gtmGroupMonthlyOpps[oppCreationMonth] += oppsNeeded;
              masterGroupMonthlyOpps[oppCreationMonth] += oppsNeeded;
              monthlyOppsTotal[oppCreationMonth] += oppsNeeded;
              
              segmentTotalOpps += oppsNeeded;
              gtmGroupTotalOpps += oppsNeeded;
              masterGroupTotalOpps += oppsNeeded;
              segmentTotalMerchants += merchantsToClose;
              gtmGroupTotalMerchants += merchantsToClose;
              masterGroupTotalMerchants += merchantsToClose;
            }
          });

          segmentFunnelData[row.id] = {
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

      masterGroupFunnelData[masterGroup.id] = {
        monthlyOpps: masterGroupMonthlyOpps,
        totalOpps: masterGroupTotalOpps,
        totalMerchants: masterGroupTotalMerchants
      };
    });

    const totalOpps = monthlyOppsTotal.reduce((sum, val) => sum + val, 0);
    const totalMerchants = masterGroups.reduce((sum, mg) => 
      sum + mg.gtmGroups.reduce((s, gtm) => 
        s + gtm.segments.reduce((ss, row) => 
          ss + row.launches.reduce((sss, v) => sss + v, 0), 0), 0), 0
    );

    return {
      masterGroupFunnelData,
      gtmGroupFunnelData,
      segmentFunnelData,
      monthlyOppsTotal,
      totalOpps,
      totalMerchants
    };
  }, [masterGroups, conversionRates]);

  const exportToCSV = () => {
    const rows = [];
    rows.push(['Scenario', 'GTM Motion', 'Segment', 'SPM', ...MONTHS, 'Total Shipments', 'Realized Revenue', 'ARR']);
    
    masterGroups.forEach(masterGroup => {
      masterGroup.gtmGroups.forEach(gtmGroup => {
        gtmGroup.segments.forEach((seg, idx) => {
          rows.push([
            idx === 0 ? masterGroup.name : '',
            idx === 0 ? gtmGroup.name : '',
            seg.segment,
            seg.spm,
            ...seg.launches,
            calculations.segmentTotals[seg.id],
            `$${calculations.segmentRevenueBreakdown[seg.id]?.realized.toLocaleString()}`,
            `$${calculations.segmentRevenueBreakdown[seg.id]?.arr.toLocaleString()}`
          ]);
        });
      });
      rows.push([
        `${masterGroup.name} Total`,
        '',
        '',
        '',
        ...Array(12).fill(''),
        calculations.masterGroupTotals[masterGroup.id],
        `$${calculations.masterGroupRevenueBreakdown[masterGroup.id]?.realized.toLocaleString()}`,
        `$${calculations.masterGroupRevenueBreakdown[masterGroup.id]?.arr.toLocaleString()}`
      ]);
      rows.push([]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtm-revenue-plan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                GTM Revenue Planning Model
              </h1>
              <div className="flex items-center gap-4">
                <p className="text-gray-600 text-sm">
                  Plan scenarios by GTM motion | Target: {TARGET_SHIPMENTS.toLocaleString()} shipments
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">RPS:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={rps}
                      onChange={(e) => setRps(parseFloat(e.target.value) || 0)}
                      className="w-20 pl-5 pr-2 py-1 text-sm border border-gray-300 rounded bg-white font-semibold"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('output')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'output'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Output View</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('funnel')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'funnel'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Funnel Planning</span>
              </div>
            </button>
          </div>
        </div>

        {/* Goal Progress */}
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Target className="w-7 h-7 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {calculations.totalShipments.toLocaleString()}
                </h2>
                <p className="text-xs text-gray-600">Total Annual Shipments</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {calculations.percentageToGoal.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600">of {TARGET_SHIPMENTS.toLocaleString()} goal</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden mb-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${Math.min(calculations.percentageToGoal, 100)}%` }}
            >
              {calculations.percentageToGoal > 5 && (
                <span className="text-white text-xs font-semibold">
                  {calculations.totalShipments.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {calculations.shortfall > 0 ? (
            <p className="text-sm text-orange-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Need {calculations.shortfall.toLocaleString()} more shipments
            </p>
          ) : (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Exceeding goal by {Math.abs(calculations.shortfall).toLocaleString()} shipments!
            </p>
          )}
        </div>

        {/* Revenue Summary */}
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Revenue Projection @ ${rps.toFixed(2)} per shipment
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Annual Shipments</p>
              <p className="text-2xl font-bold text-blue-600">
                {calculations.totalShipments.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Realized Revenue (Year 1)</p>
              <p className="text-2xl font-bold text-green-600">
                ${calculations.realizedRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Actual revenue earned this year</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Annualized Run Rate (ARR)</p>
              <p className="text-2xl font-bold text-purple-600">
                ${calculations.annualizedRunRate.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Full-year revenue potential</p>
            </div>
          </div>
        </div>

        {/* Scenario Breakdown */}
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            {activeTab === 'output' ? 'Scenario Breakdown' : 'Pipeline Requirements by Scenario'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {masterGroups.map(masterGroup => {
              const masterColor = MASTER_GROUP_COLORS[masterGroup.type] || MASTER_GROUP_COLORS.Custom;
              const masterFunnel = funnelCalculations.masterGroupFunnelData[masterGroup.id];
              
              return (
                <div key={masterGroup.id} className={`${masterColor.bg} rounded-lg p-4 border-2 ${masterColor.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4" />
                    <p className={`text-sm font-bold ${masterColor.text}`}>{masterGroup.name}</p>
                  </div>
                  
                  {activeTab === 'output' ? (
                    <>
                      <p className="text-3xl font-bold text-gray-900">
                        {calculations.masterGroupTotals[masterGroup.id]?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-600 mb-2">shipments</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white bg-opacity-50 rounded p-2">
                          <p className="text-xs text-gray-600">Realized</p>
                          <p className="text-sm font-bold text-green-700">
                            ${(calculations.masterGroupRevenueBreakdown[masterGroup.id]?.realized || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white bg-opacity-50 rounded p-2">
                          <p className="text-xs text-gray-600">ARR</p>
                          <p className="text-sm font-bold text-purple-700">
                            ${(calculations.masterGroupRevenueBreakdown[masterGroup.id]?.arr || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-purple-600">
                        {masterFunnel?.totalOpps?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-600 mb-1">opportunities</p>
                      <p className="text-sm font-semibold text-green-700">
                        → {masterFunnel?.totalMerchants?.toLocaleString() || '0'} merchants
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quarterly Summary */}
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Quarterly Breakdown</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(calculations.quarterlyBreakdown).map(([quarter, shipments]) => (
              <div key={quarter} className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-1">{quarter}</p>
                <p className="text-xl font-bold text-gray-900">
                  {(shipments / 3).toLocaleString(0)}
                </p>
                <p className="text-xs text-gray-500">SPM avg</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Content - Output View and Funnel View components would go here */}
        {/* Due to length, I'll create a separate message with the full timeline grid code */}
      </div>
    </div>
  );
}
