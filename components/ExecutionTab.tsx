'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { GtmGroupWithSegments, ExecutionPlan, HeadcountRole, SharedResource } from '@/lib/types';
import { debounce } from '@/lib/utils';

interface ExecutionTabProps {
  stretchGtmGroups: GtmGroupWithSegments[];
  gtmGroupRevenueBreakdown: Record<string, { realized: number; arr: number }>;
  onUpdateExecutionPlan: (gtmGroupId: string, updates: Partial<ExecutionPlan>) => void;
}

const ROLE_OPTIONS = ['Sales', 'Marketing', 'GTM Engineer', 'Partnerships', 'Product', 'Customer Success', 'Other'];

export default function ExecutionTab({
  stretchGtmGroups,
  gtmGroupRevenueBreakdown,
  onUpdateExecutionPlan
}: ExecutionTabProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'priority' | 'roi'>('priority');

  // Shared resource pool (global across all GTM motions)
  const [sharedResources, setSharedResources] = useState<SharedResource[]>([]);
  const [showNewResourceInput, setShowNewResourceInput] = useState<string | null>(null);

  // Local state for immediate UI updates
  const [localBudgets, setLocalBudgets] = useState<Record<string, number>>({});
  const [localReach, setLocalReach] = useState<Record<string, number | null>>({});
  const [localConfidence, setLocalConfidence] = useState<Record<string, number | null>>({});
  const [localTextFields, setLocalTextFields] = useState<Record<string, {
    partner_dependencies?: string;
    product_requirements?: string;
    carrier_requirements?: string;
  }>>({});

  // Initialize local state from props
  useEffect(() => {
    const budgets: Record<string, number> = {};
    const reach: Record<string, number | null> = {};
    const confidence: Record<string, number | null> = {};
    const textFields: Record<string, any> = {};

    stretchGtmGroups.forEach(gtm => {
      if (gtm.execution_plan) {
        budgets[gtm.id] = gtm.execution_plan.budget_usd;
        reach[gtm.id] = gtm.execution_plan.reach;
        confidence[gtm.id] = gtm.execution_plan.confidence;
        textFields[gtm.id] = {
          partner_dependencies: gtm.execution_plan.partner_dependencies || '',
          product_requirements: gtm.execution_plan.product_requirements || '',
          carrier_requirements: gtm.execution_plan.carrier_requirements || '',
        };
      }
    });

    setLocalBudgets(budgets);
    setLocalReach(reach);
    setLocalConfidence(confidence);
    setLocalTextFields(textFields);
  }, [stretchGtmGroups]);

  const toggleCard = (gtmGroupId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gtmGroupId)) {
        newSet.delete(gtmGroupId);
      } else {
        newSet.add(gtmGroupId);
      }
      return newSet;
    });
  };

  const calculatePriorityScore = (reach: number | null, confidence: number | null): number => {
    if (!reach || !confidence) return 0;
    return (reach * confidence) / 10;
  };

  const calculateROIScore = (
    impact: number,
    confidence: number | null,
    budget: number
  ): number => {
    if (!confidence || budget === 0) return 0;
    return (impact * (confidence / 100)) / budget;
  };

  const getPriorityBadgeColor = (score: number): string => {
    if (score >= 500) return 'bg-green-500 text-white';
    if (score >= 100) return 'bg-yellow-500 text-gray-900';
    return 'bg-gray-400 text-gray-900';
  };

  const getPriorityLabel = (score: number): string => {
    if (score >= 500) return 'High Priority';
    if (score >= 100) return 'Medium Priority';
    if (score > 0) return 'Low Priority';
    return 'Not Scored';
  };

  const getROIBadgeColor = (score: number): string => {
    if (score >= 10) return 'bg-blue-500 text-white';
    if (score >= 5) return 'bg-cyan-500 text-gray-900';
    if (score > 0) return 'bg-slate-400 text-gray-900';
    return 'bg-gray-300 text-gray-600';
  };

  const getROILabel = (score: number): string => {
    if (score >= 10) return `${score.toFixed(1)}x ROI`;
    if (score >= 5) return `${score.toFixed(1)}x ROI`;
    if (score > 0) return `${score.toFixed(1)}x ROI`;
    return 'No Budget';
  };

  const handleBudgetChange = (gtmGroupId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalBudgets(prev => ({ ...prev, [gtmGroupId]: numValue }));
  };

  const handleBudgetBlur = (gtmGroupId: string) => {
    const budget = localBudgets[gtmGroupId];
    if (budget !== undefined) {
      onUpdateExecutionPlan(gtmGroupId, { budget_usd: budget });
    }
  };

  const handleTextFieldChange = (
    gtmGroupId: string,
    field: 'partner_dependencies' | 'product_requirements' | 'carrier_requirements',
    value: string
  ) => {
    setLocalTextFields(prev => ({
      ...prev,
      [gtmGroupId]: {
        ...prev[gtmGroupId],
        [field]: value,
      },
    }));
  };

  const handleTextFieldBlur = (
    gtmGroupId: string,
    field: 'partner_dependencies' | 'product_requirements' | 'carrier_requirements'
  ) => {
    const value = localTextFields[gtmGroupId]?.[field];
    if (value !== undefined) {
      onUpdateExecutionPlan(gtmGroupId, { [field]: value });
    }
  };

  const addNewResource = (gtmGroupId: string, name: string, role: string) => {
    const newResource: SharedResource = {
      id: `temp-${Date.now()}`,
      name,
      role,
    };
    setSharedResources(prev => [...prev, newResource]);

    // Add this resource to the GTM motion
    const currentResources = stretchGtmGroups.find(g => g.id === gtmGroupId)?.execution_plan?.resource_ids || [];
    onUpdateExecutionPlan(gtmGroupId, { resource_ids: [...currentResources, newResource.id] });
    setShowNewResourceInput(null);
  };

  const toggleResource = (gtmGroupId: string, resourceId: string) => {
    const currentResources = stretchGtmGroups.find(g => g.id === gtmGroupId)?.execution_plan?.resource_ids || [];
    const newResources = currentResources.includes(resourceId)
      ? currentResources.filter(id => id !== resourceId)
      : [...currentResources, resourceId];
    onUpdateExecutionPlan(gtmGroupId, { resource_ids: newResources });
  };

  const addHeadcountRole = (gtmGroupId: string, currentHeadcount: HeadcountRole[]) => {
    const newHeadcount = [...currentHeadcount, { role: 'Sales', count: 1 }];
    onUpdateExecutionPlan(gtmGroupId, { headcount_needed: newHeadcount });
  };

  const removeHeadcountRole = (gtmGroupId: string, currentHeadcount: HeadcountRole[], index: number) => {
    const newHeadcount = currentHeadcount.filter((_, i) => i !== index);
    onUpdateExecutionPlan(gtmGroupId, { headcount_needed: newHeadcount });
  };

  const updateHeadcountRole = (
    gtmGroupId: string,
    currentHeadcount: HeadcountRole[],
    index: number,
    field: 'role' | 'count',
    value: string | number
  ) => {
    const newHeadcount = currentHeadcount.map((hc, i) => {
      if (i === index) {
        return { ...hc, [field]: value };
      }
      return hc;
    });
    onUpdateExecutionPlan(gtmGroupId, { headcount_needed: newHeadcount });
  };

  // Calculate total resources
  const totalBudget = stretchGtmGroups.reduce((sum, gtm) => {
    return sum + (gtm.execution_plan?.budget_usd || 0);
  }, 0);

  // Deduplicated headcount using shared resources
  const uniqueResourceIds = new Set<string>();
  stretchGtmGroups.forEach(gtm => {
    gtm.execution_plan?.resource_ids?.forEach(resourceId => {
      uniqueResourceIds.add(resourceId);
    });
  });

  const totalHeadcountByRole: Record<string, number> = {};
  uniqueResourceIds.forEach(resourceId => {
    const resource = sharedResources.find(r => r.id === resourceId);
    if (resource) {
      totalHeadcountByRole[resource.role] = (totalHeadcountByRole[resource.role] || 0) + 1;
    }
  });

  // Sort GTM groups by priority score or ROI (highest first) using local state
  const sortedGtmGroups = [...stretchGtmGroups].sort((a, b) => {
    const reachA = localReach[a.id] ?? a.execution_plan?.reach;
    const confidenceA = localConfidence[a.id] ?? a.execution_plan?.confidence;
    const budgetA = localBudgets[a.id] ?? a.execution_plan?.budget_usd ?? 0;
    const impactA = gtmGroupRevenueBreakdown[a.id]?.arr || 0;

    const reachB = localReach[b.id] ?? b.execution_plan?.reach;
    const confidenceB = localConfidence[b.id] ?? b.execution_plan?.confidence;
    const budgetB = localBudgets[b.id] ?? b.execution_plan?.budget_usd ?? 0;
    const impactB = gtmGroupRevenueBreakdown[b.id]?.arr || 0;

    if (sortBy === 'roi') {
      const roiA = calculateROIScore(impactA, confidenceA ?? null, budgetA);
      const roiB = calculateROIScore(impactB, confidenceB ?? null, budgetB);
      return roiB - roiA;
    } else {
      const scoreA = calculatePriorityScore(reachA || null, confidenceA || null);
      const scoreB = calculatePriorityScore(reachB || null, confidenceB || null);
      return scoreB - scoreA;
    }
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      {/* Sort Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stretch GTM Motions</h2>
          <p className="text-sm text-gray-600">Evaluate and prioritize strategic growth initiatives</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Sort by:</span>
          <button
            onClick={() => setSortBy('priority')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              sortBy === 'priority'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Priority Score
          </button>
          <button
            onClick={() => setSortBy('roi')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              sortBy === 'roi'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ROI Score
          </button>
        </div>
      </div>

      {/* Total Resources Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-blue-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Total Resource Requirements</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Total Budget</p>
            <p className="text-3xl font-bold text-gray-900">
              ${totalBudget.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Total Headcount</p>
            <div className="space-y-1">
              {Object.entries(totalHeadcountByRole).length > 0 ? (
                Object.entries(totalHeadcountByRole).map(([role, count]) => (
                  <div key={role} className="text-sm">
                    <span className="font-bold text-gray-900">{count}x</span>{' '}
                    <span className="text-gray-700">{role}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No headcount specified</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GTM Motion Cards */}
      {sortedGtmGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">No stretch GTM motions yet.</p>
          <p className="text-gray-400 text-sm mt-2">Add GTM motions to the Stretch plan to see them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGtmGroups.map((gtm) => {
            const executionPlan = gtm.execution_plan || {
              reach: null,
              confidence: null,
              budget_usd: 0,
              headcount_needed: [],
              resource_ids: [],
              partner_dependencies: null,
              product_requirements: null,
              carrier_requirements: null,
            };

            const impactARR = gtmGroupRevenueBreakdown[gtm.id]?.arr || 0;
            const currentReach = localReach[gtm.id] ?? executionPlan.reach;
            const currentConfidence = localConfidence[gtm.id] ?? executionPlan.confidence;
            const currentBudget = localBudgets[gtm.id] ?? executionPlan.budget_usd;
            const priorityScore = calculatePriorityScore(currentReach, currentConfidence);
            const roiScore = calculateROIScore(impactARR, currentConfidence, currentBudget);
            const isExpanded = expandedCards.has(gtm.id);

            return (
              <div key={gtm.id} className="bg-white rounded-lg shadow-md border-2 border-orange-400">
                {/* Card Header - RICE Section */}
                <div className="p-4 bg-orange-50 border-b-2 border-orange-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{gtm.name}</h3>
                    <div className="flex items-center gap-2">
                      <div className={`px-4 py-2 rounded-full font-bold text-sm ${getPriorityBadgeColor(priorityScore)}`}>
                        {getPriorityLabel(priorityScore)} ({priorityScore})
                      </div>
                      <div className={`px-4 py-2 rounded-full font-bold text-sm ${getROIBadgeColor(roiScore)}`}>
                        {getROILabel(roiScore)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {/* Reach */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Reach (Customers)
                      </label>
                      <select
                        value={currentReach || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) as 1 | 10 | 100 | 1000 : null;
                          setLocalReach(prev => ({ ...prev, [gtm.id]: value }));
                          onUpdateExecutionPlan(gtm.id, { reach: value });
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="1">1</option>
                        <option value="10">10</option>
                        <option value="100">100</option>
                        <option value="1000">1,000</option>
                      </select>
                    </div>

                    {/* Impact */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Impact (New ARR)
                      </label>
                      <div className="px-3 py-2 text-sm border border-blue-300 rounded-lg font-bold bg-blue-50 text-blue-900">
                        ${impactARR.toLocaleString()}
                      </div>
                    </div>

                    {/* Confidence */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Confidence
                      </label>
                      <select
                        value={currentConfidence || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) as 20 | 50 | 80 : null;
                          setLocalConfidence(prev => ({ ...prev, [gtm.id]: value }));
                          onUpdateExecutionPlan(gtm.id, { confidence: value });
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="20">20%</option>
                        <option value="50">50%</option>
                        <option value="80">80%</option>
                      </select>
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Budget (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={(localBudgets[gtm.id] ?? executionPlan.budget_usd) || ''}
                          onChange={(e) => handleBudgetChange(gtm.id, e.target.value)}
                          onBlur={() => handleBudgetBlur(gtm.id)}
                          className="w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold bg-white"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Resources Section */}
                <div>
                  <button
                    onClick={() => toggleCard(gtm.id)}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
                  >
                    <span className="font-semibold text-gray-700 text-sm">
                      Resource Requirements & Dependencies
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-gray-50">
                      {/* Shared Resources (Tag-based) */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Team Members Needed
                        </label>

                        {/* Selected Resources */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {executionPlan.resource_ids?.map(resourceId => {
                            const resource = sharedResources.find(r => r.id === resourceId);
                            if (!resource) return null;
                            return (
                              <div
                                key={resourceId}
                                className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold border border-blue-300"
                              >
                                <span>{resource.name}</span>
                                <button
                                  onClick={() => toggleResource(gtm.id, resourceId)}
                                  className="hover:text-blue-900"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Available Resources to Add */}
                        {sharedResources.filter(r => !executionPlan.resource_ids?.includes(r.id)).length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-600 mb-2">Available resources:</p>
                            <div className="flex flex-wrap gap-2">
                              {sharedResources
                                .filter(r => !executionPlan.resource_ids?.includes(r.id))
                                .map(resource => (
                                  <button
                                    key={resource.id}
                                    onClick={() => toggleResource(gtm.id, resource.id)}
                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 border border-gray-300"
                                  >
                                    + {resource.name} ({resource.role})
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Add New Resource */}
                        {showNewResourceInput === gtm.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Resource name (e.g., Sarah - Event Manager)"
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const name = e.currentTarget.value;
                                  const role = name.includes('-') ? name.split('-')[1].trim() : 'Other';
                                  if (name) addNewResource(gtm.id, name, role);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => setShowNewResourceInput(null)}
                              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNewResourceInput(gtm.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add New Resource
                          </button>
                        )}
                      </div>

                      {/* 3rd Party Dependencies */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          3rd Party Dependencies
                        </label>
                        <textarea
                          value={(localTextFields[gtm.id]?.partner_dependencies ?? executionPlan.partner_dependencies) || ''}
                          onChange={(e) => handleTextFieldChange(gtm.id, 'partner_dependencies', e.target.value)}
                          onBlur={() => handleTextFieldBlur(gtm.id, 'partner_dependencies')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                          rows={2}
                          placeholder="e.g., Partnership with ShipBob, Shopify Plus relationship"
                        />
                      </div>

                      {/* Product Build Requirements */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Product Build Requirements
                        </label>
                        <textarea
                          value={(localTextFields[gtm.id]?.product_requirements ?? executionPlan.product_requirements) || ''}
                          onChange={(e) => handleTextFieldChange(gtm.id, 'product_requirements', e.target.value)}
                          onBlur={() => handleTextFieldBlur(gtm.id, 'product_requirements')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                          rows={2}
                          placeholder="e.g., API integration, new dashboard"
                        />
                      </div>

                      {/* Carrier Network Requirements */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Carrier Network Requirements
                        </label>
                        <textarea
                          value={(localTextFields[gtm.id]?.carrier_requirements ?? executionPlan.carrier_requirements) || ''}
                          onChange={(e) => handleTextFieldChange(gtm.id, 'carrier_requirements', e.target.value)}
                          onBlur={() => handleTextFieldBlur(gtm.id, 'carrier_requirements')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                          rows={2}
                          placeholder="e.g., FedEx SmartPost access"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
