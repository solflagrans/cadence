import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "alert"
  | "arrow-right"
  | "calendar"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "cloud"
  | "copy"
  | "directions"
  | "download"
  | "edit"
  | "home"
  | "login"
  | "logout"
  | "more"
  | "paste"
  | "plans"
  | "plus"
  | "schedule"
  | "search"
  | "settings"
  | "spark"
  | "today"
  | "trash"
  | "upload"
  | "user"
  | "x";

export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <><path d="M4 18V9" /><path d="M10 18V5" /><path d="M16 18v-7" /><path d="M3 18h16" /></>,
    alert: <><path d="M10.3 3.7 2.7 17a1.2 1.2 0 0 0 1 1.8h15.1a1.2 1.2 0 0 0 1-1.8L12.2 3.7a1.1 1.1 0 0 0-1.9 0Z" /><path d="M11.25 8v4.5" /><path d="M11.25 16h.01" /></>,
    "arrow-right": <><path d="M4 11.5h14" /><path d="m13.5 7 4.5 4.5-4.5 4.5" /></>,
    calendar: <><rect x="3" y="5" width="17" height="15" rx="2" /><path d="M7 3v4M16 3v4M3 9h17" /></>,
    check: <path d="m4 11.5 4.2 4.2L18.5 5.5" />,
    "chevron-left": <path d="m14 5-6 6.5 6 6.5" />,
    "chevron-right": <path d="m9 5 6 6.5L9 18" />,
    cloud: <path d="M7 18.5h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9.2 4.7 4.7 0 0 0 7 18.5Z" />,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
    directions: <><circle cx="11.5" cy="11.5" r="8" /><circle cx="11.5" cy="11.5" r="3.5" /><path d="m14 9 5-5M15 4h4v4" /></>,
    download: <><path d="M11.5 3v12" /><path d="m7 11 4.5 4.5L16 11" /><path d="M4 20h15" /></>,
    edit: <><path d="M13.5 5.5 18 10" /><path d="m4 19 1-4.5L15.8 3.7a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3L8.5 18Z" /></>,
    home: <><path d="m3 10 8.5-7 8.5 7" /><path d="M5.5 8.5V20h12V8.5M9 20v-6h5v6" /></>,
    login: <><path d="M10 4H5v15h5" /><path d="M9 11.5h11M16 7.5l4 4-4 4" /></>,
    logout: <><path d="M14 4h5v15h-5" /><path d="M15 11.5H4M8 7.5l-4 4 4 4" /></>,
    more: <><circle cx="5" cy="11.5" r="1" fill="currentColor" stroke="none" /><circle cx="11.5" cy="11.5" r="1" fill="currentColor" stroke="none" /><circle cx="18" cy="11.5" r="1" fill="currentColor" stroke="none" /></>,
    paste: <><path d="M8 5H5v15h13V5h-3" /><rect x="8" y="3" width="7" height="4" rx="1.5" /><path d="M8 12h7M8 16h5" /></>,
    plans: <><rect x="3" y="4" width="17" height="17" rx="2" /><path d="M7 2v4M16 2v4M3 9h17M7 13h3M14 13h2M7 17h3" /></>,
    plus: <path d="M11.5 4v15M4 11.5h15" />,
    schedule: <><circle cx="11.5" cy="11.5" r="8.5" /><path d="M11.5 6v6l4 2" /></>,
    search: <><circle cx="10" cy="10" r="6.5" /><path d="m15 15 5 5" /></>,
    settings: <><path d="M4 6h7M15 6h4M4 11.5h3M11 11.5h8M4 17h9M17 17h2" /><circle cx="13" cy="6" r="2" /><circle cx="9" cy="11.5" r="2" /><circle cx="15" cy="17" r="2" /></>,
    spark: <><path d="m11.5 2 1.2 5.2L18 8.5l-5.3 1.2-1.2 5.3-1.2-5.3L5 8.5l5.3-1.3Z" /><path d="m18.5 15 .5 2.2 2.2.5-2.2.5-.5 2.3-.5-2.3-2.3-.5 2.3-.5Z" /></>,
    today: <><rect x="3" y="5" width="17" height="15" rx="2" /><path d="M7 3v4M16 3v4M3 9h17" /><path d="m8 14 2.2 2.2 4.5-4.5" /></>,
    trash: <><path d="M4 6h15M9 3h5l1 3M7 6l1 14h7l1-14M10 10v6M14 10v6" /></>,
    upload: <><path d="M11.5 16V4" /><path d="M7 8.5 11.5 4 16 8.5" /><path d="M4 20h15" /></>,
    user: <><circle cx="11.5" cy="8" r="4" /><path d="M4.5 20a7 7 0 0 1 14 0" /></>,
    x: <path d="m5 5 13 13M18 5 5 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 23 23"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
