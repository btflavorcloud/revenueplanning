'use client';

import { useScenarios } from '@/lib/hooks/useScenarios';
import LeftNav from '@/components/LeftNav';
import RevenuePlanner from '@/components/RevenuePlanner';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface PlannerLayoutProps {
  scenarioId: string;
}

export default function PlannerLayout({ scenarioId }: PlannerLayoutProps) {
  const router = useRouter();
  const { scenarios, loading, createScenario } = useScenarios();

  const handleCreateScenario = async () => {
    const name = prompt('Enter scenario name:');
    if (!name) return;

    const scenario = await createScenario(name, 'Custom');
    if (scenario) {
      router.push(`/planner/${scenario.id}`);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <LeftNav
        scenarios={scenarios}
        currentScenarioId={scenarioId}
        onCreateScenario={handleCreateScenario}
      />
      <RevenuePlanner scenarioId={scenarioId} />
    </div>
  );
}
