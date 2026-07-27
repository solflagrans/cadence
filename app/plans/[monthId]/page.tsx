import PlannerApp from "../../planner-app";

export default async function MonthRoute({
  params,
}: {
  params: Promise<{ monthId: string }>;
}) {
  const { monthId } = await params;
  return <PlannerApp initialRoute={{ page: "month", id: monthId }} />;
}
