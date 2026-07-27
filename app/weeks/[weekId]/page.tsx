import PlannerApp from "../../planner-app";

export default async function WeekRoute({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  return <PlannerApp initialRoute={{ page: "week", id: weekId }} />;
}
