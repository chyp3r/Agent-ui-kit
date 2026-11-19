import {
  ChartColumn,
  ClipboardCheck,
  Code,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Headset,
  Mail,
  MessageCircle,
  Route,
  Search,
  ShieldCheck,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon names a `ToolDef.icon` may use. Add your own: `TOOL_ICONS.my_icon = Rocket`.
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  route: Route,
  search: Search,
  database: Database,
  "clipboard-check": ClipboardCheck,
  "file-text": FileText,
  chart: ChartColumn,
  headset: Headset,
  message: MessageCircle,
  mail: Mail,
  globe: Globe,
  code: Code,
  folder: FolderOpen,
  shield: ShieldCheck,
  terminal: Terminal,
};

export function toolIcon(name: string | undefined): LucideIcon {
  return (name && TOOL_ICONS[name]) || Wrench;
}
