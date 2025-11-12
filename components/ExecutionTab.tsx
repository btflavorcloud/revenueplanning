'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { GtmGroupWithSegments, ExecutionPlan, HeadcountRole } from '@/lib/types';
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

  // Local state for immediate UI updates
  const [localBudgets, setLocalBudgets] = useState<Record<string, number>>({});
  const [localTextFields, setLocalTextFields] = useState<Record<string, {
    partner_dependencies?: string;
    product_requirements?: string;
    carrier_requirements?: string;
  }>>({});

  // Initialize local state from props
  useEffect(() => {
    const budgets: Record<string, number> = {};
    const textFields: Record<string, any> = {};

    stretchGtmGroups.forEach(gtm => {
      if (gtm.execution_plan) {
        budgets[gtm.id] = gtm.execution_plan.budget_usd;
        textFields[gtm.id] = {
          partner_dependencies: gtm.execution_plan.partner_dependencies || '',
          product_requirements: gtm.execution_plan.product_requirements || '',
          carrier_requirements: gtm.execution_plan.carrier_requirements || '',
        };
      }
    });

    setLocalBudgets(budgets);
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

  const totalHeadcountByRole: Record<string, number> = {};
  stretchGtmGroups.forEach(gtm => {
    gtm.execution_plan?.headcount_needed?.forEach(hc => {
      totalHeadcountByRole[hc.role] = (totalHeadcountByRole[hc.role] || 0) + hc.count;
    });
  });

  // Sort GTM groups by priority score (highest first)
  const sortedGtmGroups = [...stretchGtmGroups].sort((a, b) => {
    const scoreA = calculatePriorityScore(a.execution_plan?.reach || null, a.execution_plan?.confidence || null);
    const scoreB = calculatePriorityScore(b.execution_plan?.reach || null, b.execution_plan?.confidence || null);
    return scoreB - scoreA;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
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
              partner_dependencies: null,
              product_requirements: null,
              carrier_requirements: null,
            };

            const impactARR = gtmGroupRevenueBreakdown[gtm.id]?.arr || 0;
            const priorityScore = calculatePriorityScore(executionPlan.reach, executionPlan.confidence);
            const isExpanded = expandedCards.has(gtm.id);

            return (
              <div key={gtm.id} className="bg-white rounded-lg shadow-md border-2 border-orange-400">
                {/* Card Header - RICE Section */}
                <div className="p-4 bg-orange-50 border-b-2 border-orange-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{gtm.name}</h3>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm ${getPriorityBadgeColor(priorityScore)}`}>
                      {getPriorityLabel(priorityScore)} ({priorityScore})
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {/* Reach */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Reach (Customers)
                      </label>
                      <select
                        value={executionPlan.reach || ''}
                        onChange={(e) => onUpdateExecutionPlan(gtm.id, {
                          reach: e.target.value ? parseInt(e.target.value) as 1 | 10 | 100 | 1000 : null
                        })}
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
                        value={executionPlan.confidence || ''}
                        onChange={(e) => onUpdateExecutionPlan(gtm.id, {
                          confidence: e.target.value ? parseInt(e.target.value) as 20 | 50 | 80 : null
                        })}
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
                      {/* Headcount */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Team Members Needed
                        </label>
                        <div className="space-y-2">
                          {executionPlan.headcount_needed?.map((hc, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={hc.role}
                                onChange={(e) => updateHeadcountRole(gtm.id, executionPlan.headcount_needed, index, 'role', e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                              >
                                {ROLE_OPTIONS.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={hc.count}
                                onChange={(e) => updateHeadcountRole(gtm.id, executionPlan.headcount_needed, index, 'count', parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                                min="1"
                              />
                              <button
                                onClick={() => removeHeadcountRole(gtm.id, executionPlan.headcount_needed, index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addHeadcountRole(gtm.id, executionPlan.headcount_needed || [])}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Role
                          </button>
                        </div>
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
