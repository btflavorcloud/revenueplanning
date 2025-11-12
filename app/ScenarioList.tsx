'use client';

import { useState } from 'react';
import { useScenarios } from '@/lib/hooks/useScenarios';
import ScenarioCard from '@/components/ScenarioCard';
import { Plus, Loader2, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ScenarioList() {
  const router = useRouter();
  const { scenarios, loading, error, createScenario, deleteScenario, duplicateScenario } = useScenarios();
  const [creatingScenario, setCreatingScenario] = useState(false);

  const handleCreateScenario = async () => {
    setCreatingScenario(true);
    const name = prompt('Enter scenario name:') || 'New Scenario';
    const scenario = await createScenario(name, 'Custom');
    setCreatingScenario(false);

    if (scenario) {
      router.push(`/planner/${scenario.id}`);
    }
  };

  const handleDuplicate = async (scenarioId: string) => {
    const newScenario = await duplicateScenario(scenarioId);
    if (newScenario) {
      router.push(`/planner/${newScenario.id}`);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Target className="w-10 h-10 text-blue-600" />
            GTM Revenue Planner
          </h1>
          <p className="text-gray-600">
            Create and manage your revenue planning scenarios
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Create Scenario Button */}
        <div className="mb-8">
          <button
            onClick={handleCreateScenario}
            disabled={creatingScenario}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Create New Scenario
          </button>
        </div>

        {/* Scenarios Grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Your Scenarios ({scenarios.length})
          </h2>
          {scenarios.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No scenarios yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first revenue planning scenario to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onDuplicate={handleDuplicate}
                  onDelete={deleteScenario}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
