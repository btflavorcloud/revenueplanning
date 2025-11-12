'use client';

import { ScenarioWithData } from '@/lib/types';
import { MASTER_GROUP_COLORS } from '@/lib/types';
import { Layers, Copy, Trash2, Calendar } from 'lucide-react';
import Link from 'next/link';

interface ScenarioCardProps {
  scenario: ScenarioWithData;
  onDuplicate: (scenarioId: string) => void;
  onDelete: (scenarioId: string) => void;
}

export default function ScenarioCard({ scenario, onDuplicate, onDelete }: ScenarioCardProps) {
  const colors = MASTER_GROUP_COLORS[scenario.type] || MASTER_GROUP_COLORS.Custom;

  const totalPlans = scenario.plans.length;
  const totalGtmGroups = scenario.plans.reduce((sum, plan) => sum + plan.gtm_groups.length, 0);
  const totalSegments = scenario.plans.reduce((sum, plan) =>
    sum + plan.gtm_groups.reduce((s, gtm) => s + gtm.segments.length, 0), 0
  );

  const formattedDate = new Date(scenario.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
      <Link href={`/planner/${scenario.id}`}>
        <div className="p-6 cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`${colors.accent} p-2 rounded-lg`}>
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${colors.text}`}>{scenario.name}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
              {scenario.type}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white bg-opacity-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Target Shipments</p>
              <p className="text-lg font-bold text-gray-900">
                {scenario.target_shipments.toLocaleString()}
              </p>
            </div>
            <div className="bg-white bg-opacity-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">RPS</p>
              <p className="text-lg font-bold text-gray-900">
                ${scenario.rps.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{totalGtmGroups} GTM Motion{totalGtmGroups !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{totalSegments} Segment{totalSegments !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </Link>

      <div className="border-t border-gray-200 bg-white bg-opacity-30 px-6 py-3 flex items-center justify-end gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(scenario.id);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
        >
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${scenario.name}"?`)) {
              onDelete(scenario.id);
            }
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
