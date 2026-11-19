import type { IconType } from "react-icons";
import {
  LuCalendarDays,
  LuChartColumn,
  LuHouse,
  LuLink2,
  LuSettings,
  LuSparkles,
  LuSquarePlus,
} from "react-icons/lu";
import type { WorkspaceRole } from "@/app/lib/api/types";

export interface NavItem {
  label: string;
  path: string;
  Icon: IconType;
  role?: WorkspaceRole;
}

export const NAV: NavItem[] = [
  { label: "Home", path: "", Icon: LuHouse },
  { label: "Calendar", path: "/calendar", Icon: LuCalendarDays },
  { label: "Create", path: "/create", Icon: LuSquarePlus, role: "editor" },
  { label: "Plan with AI", path: "/plan", Icon: LuSparkles, role: "editor" },
  { label: "Analytics", path: "/analytics", Icon: LuChartColumn },
  { label: "Accounts", path: "/accounts", Icon: LuLink2 },
  { label: "Settings", path: "/settings", Icon: LuSettings },
];

export const TOGGLE_SIDEBAR = "toggle-sidebar";

export const toggleSidebar = () => window.dispatchEvent(new Event(TOGGLE_SIDEBAR));

/** Exact match for home, prefix match for everything nested under an item. */
export function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
