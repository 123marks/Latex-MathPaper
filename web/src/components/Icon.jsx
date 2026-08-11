// Central Lucide icon registry. All UI icons MUST come from here — no emoji,
// no unicode glyphs in chrome. Semantic names keep call-sites readable and let
// us swap the underlying glyph in one place.
import {
  LayoutDashboard,
  SquarePen,
  KeyRound,
  Gauge,
  Users,
  Settings,
  Sparkles,
  Home,
  ShieldCheck,
  ScrollText,
  FileEdit,
  Download,
  SlidersHorizontal,
  BarChart3,
  FileCode2,
  Crosshair,
  PenLine,
  Layers,
  Blocks,
  HardDrive,
  Check,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  LogOut,
  Search,
  Terminal,
  Monitor,
  Apple,
  Laptop,
  Building2,
  Lock,
  Network,
  Award,
  CircleDot,
  Command,
  X,
  Menu,
  FilePlus2,
  GitBranch,
  RefreshCw,
  ScanSearch,
  FileCheck2,
  PlugZap,
  Play,
  ListFilter,
  FileOutput,
} from "lucide-react";

const MAP = {
  dashboard: LayoutDashboard,
  workbench: SquarePen,
  key: KeyRound,
  usage: Gauge,
  community: Users,
  account: Settings,
  features: Sparkles,
  home: Home,
  admin: ShieldCheck,
  audit: ScrollText,
  content: FileEdit,
  releases: Download,
  system: SlidersHorizontal,
  users: Users,
  compose: PenLine,
  team: Layers,
  skills: Blocks,
  local: HardDrive,
  check: Check,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  arrowUp: ArrowUp,
  like: ThumbsUp,
  comment: MessageSquare,
  bookmark: Bookmark,
  logout: LogOut,
  search: Search,
  terminal: Terminal,
  windows: Monitor,
  macos: Apple,
  linux: Laptop,
  enterprise: Building2,
  lock: Lock,
  network: Network,
  award: Award,
  dot: CircleDot,
  command: Command,
  close: X,
  menu: Menu,
  template: FilePlus2,
  "git-branch": GitBranch,
  sync: RefreshCw,
  magnifier: ScanSearch,
  evidence: FileCheck2,
  mcp: PlugZap,
  play: Play,
  filter: ListFilter,
  export: FileOutput,
};

export const ICON_NAMES = Object.freeze(Object.keys(MAP));

export default function Icon({ name, size = 16, strokeWidth = 1.8, className, style, ...rest }) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}
