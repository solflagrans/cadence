export type PlannerRoute =
  | { page: "overview" }
  | { page: "today" }
  | { page: "plans" }
  | { page: "month"; id: string }
  | { page: "week"; id: string }
  | { page: "schedule" }
  | { page: "directions" }
  | { page: "direction"; id: string }
  | { page: "settings" };

export const routeToPath = (route: PlannerRoute): string => {
  switch (route.page) {
    case "overview": return "/";
    case "today": return "/today";
    case "plans": return "/plans";
    case "month": return `/plans/${route.id}`;
    case "week": return `/weeks/${route.id}`;
    case "schedule": return "/schedule";
    case "directions": return "/directions";
    case "direction": return `/directions/${route.id}`;
    case "settings": return "/settings";
  }
};

export const routeFromPathname = (pathname: string): PlannerRoute => {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return { page: "overview" };
  if (parts[0] === "today") return { page: "today" };
  if (parts[0] === "plans" && parts[1]) {
    return { page: "month", id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "plans") return { page: "plans" };
  if (parts[0] === "weeks" && parts[1]) {
    return { page: "week", id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "schedule") return { page: "schedule" };
  if (parts[0] === "directions" && parts[1]) {
    return { page: "direction", id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "directions") return { page: "directions" };
  if (parts[0] === "settings") return { page: "settings" };
  return { page: "overview" };
};

export function navigate(route: PlannerRoute): void {
  const path = routeToPath(route);
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  window.dispatchEvent(
    new CustomEvent<PlannerRoute>("cadence:navigate", { detail: route }),
  );
}
