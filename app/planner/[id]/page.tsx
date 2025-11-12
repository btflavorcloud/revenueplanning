import PlannerLayout from './PlannerLayout';

export default async function PlannerPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  return <PlannerLayout scenarioId={id} />;
}
