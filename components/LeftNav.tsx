'use client';

import { ScenarioWithData } from '@/lib/types';
import { ChevronLeft, ChevronRight, Plus, Folder, Target } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface LeftNavProps {
  scenarios: ScenarioWithData[];
  currentScenarioId?: string;
  onCreateScenario: () => void;
}

export default function LeftNav({ scenarios, currentScenarioId, onCreateScenario }: LeftNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  if (collapsed) {
    return (
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 relative">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div className="flex-1 flex flex-col gap-3">
          {scenarios.map(scenario => (
            <Link
              key={scenario.id}
              href={`/planner/${scenario.id}`}
              className={`p-2 rounded transition-colors ${
                currentScenarioId === scenario.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              title={scenario.name}
            >
              <Folder className="w-5 h-5" />
            </Link>
          ))}
        </div>
        <button
          onClick={onCreateScenario}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors mt-4"
          title="New Scenario"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Scenarios</h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Scenarios List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {scenarios.map(scenario => {
            const isActive = currentScenarioId === scenario.id;
            const baselinePlan = scenario.plans.find(p => p.type === 'Baseline');
            const stretchPlan = scenario.plans.find(p => p.type === 'Stretch');
            const baselineGtmCount = baselinePlan?.gtm_groups.length || 0;
            const stretchGtmCount = stretchPlan?.gtm_groups.length || 0;

            return (
              <Link
                key={scenario.id}
                href={`/planner/${scenario.id}`}
                className={`block p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Folder className="w-4 h-4" />
                  <span className="font-semibold text-sm truncate">{scenario.name}</span>
                </div>
                <div className="text-xs opacity-80 space-y-1">
                  <div className="flex justify-between">
                    <span>Baseline:</span>
                    <span className="font-semibold">{baselineGtmCount} motions</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stretch:</span>
                    <span className="font-semibold">{stretchGtmCount} motions</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Create New Button */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onCreateScenario}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Scenario
        </button>
      </div>
    </div>
  );
}
