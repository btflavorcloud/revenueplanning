import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch all scenarios (no user filtering - shared access)
  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  // If there are scenarios, redirect to the first one
  if (scenarios && scenarios.length > 0) {
    redirect(`/planner/${scenarios[0].id}`);
  }

  // Otherwise, create a first scenario and redirect
  const { data: newScenario } = await supabase
    .from('scenarios')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // Shared user ID
      name: '2024 Revenue Plan',
      type: 'Custom',
      target_shipments: 400000,
      rps: 40,
      collapsed: false,
    })
    .select()
    .single();

  if (newScenario) {
    // Create Baseline and Stretch plans
    await supabase.from('plans').insert([
      { scenario_id: newScenario.id, type: 'Baseline', collapsed: false },
      { scenario_id: newScenario.id, type: 'Stretch', collapsed: false },
    ]);

    redirect(`/planner/${newScenario.id}`);
  }

  // Fallback
  return <div className="p-8">Loading...</div>;
}
