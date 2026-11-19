import { readStored, writeStored } from "./storage";

/**
 * How the sidebar, the conversation and the analysis share the screen. The reader
 * drags the seams, and what they drag to is remembered.
 */

/** Narrow enough to be a reading column, not so narrow it stops being one. */
export const MIN_ROOM = 420;
/** What the analysis needs before a table stops being readable at all. */
export const MIN_PANEL = 400;
export const DEFAULT_ROOM = 560;

export function clampRoom(width: number, available: number): number {
  const ceiling = Math.max(MIN_ROOM, available - MIN_PANEL);
  return Math.round(Math.min(Math.max(width, MIN_ROOM), ceiling));
}

export function loadRoomWidth(): number {
  const stored = Number(readStored("room-width"));
  return Number.isFinite(stored) && stored >= MIN_ROOM ? stored : DEFAULT_ROOM;
}

export function saveRoomWidth(width: number): void {
  writeStored("room-width", width === DEFAULT_ROOM ? null : String(width));
}

export const MIN_SIDEBAR = 232;
export const MAX_SIDEBAR = 420;
export const DEFAULT_SIDEBAR = 272;

export function clampSidebar(width: number): number {
  return Math.round(Math.min(Math.max(width, MIN_SIDEBAR), MAX_SIDEBAR));
}

export function loadSidebarWidth(): number {
  const stored = Number(readStored("sidebar-width"));
  return Number.isFinite(stored) && stored >= MIN_SIDEBAR ? clampSidebar(stored) : DEFAULT_SIDEBAR;
}

export function saveSidebarWidth(width: number): void {
  writeStored("sidebar-width", width === DEFAULT_SIDEBAR ? null : String(width));
}
