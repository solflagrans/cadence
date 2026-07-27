import PlannerApp from "../../planner-app";

export default async function DirectionRoute({
  params,
}: {
  params: Promise<{ directionId: string }>;
}) {
  const { directionId } = await params;
  return <PlannerApp initialRoute={{ page: "direction", id: directionId }} />;
}
