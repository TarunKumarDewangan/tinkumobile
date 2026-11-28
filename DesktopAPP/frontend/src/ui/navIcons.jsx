// Line icons for the NEW design's menu. The old design keeps its emoji —
// both are rendered and CSS shows one of them, so links/behaviour are identical.
import {
  LayoutDashboard, Clock, Landmark, Wallet, HandCoins, Building2, Network, ClipboardList,
  Scale, BookOpen, Receipt, FolderTree, FolderKanban, ShoppingCart, FileText, Smartphone,
  Package, Truck, CreditCard, Repeat, Boxes, BarChart3, Tag, Printer, Wrench, Zap,
  CalendarClock, PiggyBank, Briefcase, Users, Store, KeyRound, ShieldCheck, History,
  AlertTriangle, Trash2, CalendarCheck, ScanSearch, CopyCheck, Trophy, Target, Send,
  LineChart, PieChart, CalendarRange, BadgePercent, ListChecks, ListPlus, Settings,
  MessageSquare, Mail, Archive, Home, Menu, Circle, Download,
} from 'lucide-react';

const BY_PATH = {
  '/': LayoutDashboard,
  '/attendance': Clock,
  '/pending-balance': Wallet,
  '/pending-payables': CreditCard,
  '/accounts/promise-to-pay': HandCoins,
  '/accounts/bank-balances': Landmark,
  '/accounts/entity-manager': Building2,
  '/accounts/group-summary': Network,
  '/accounts/trade-summary': Scale,
  '/accounts/daybook': BookOpen,
  '/accounts/overheads': Receipt,
  '/accounts/expense-categories': FolderTree,
  '/purchases?category_group=master': ShoppingCart,
  '/sales?category_group=master': FileText,
  '/purchases': ShoppingCart,
  '/stocks': Package,
  '/stock-transfers': Truck,
  '/sales': FileText,
  '/finance-tracker': CreditCard,
  '/old-mobiles': Repeat,
  '/old-mobiles/stocks': Boxes,
  '/old-mobiles/sales': FileText,
  '/old-mobiles/report': BarChart3,
  '/products?category_group=other': Smartphone,
  '/purchases?category_group=other': ShoppingCart,
  '/sales?category_group=other': FileText,
  '/stickers/generate': Tag,
  '/stickers/print': Printer,
  '/recharge': Zap,
  '/repairs': Wrench,
  '/follow-ups': CalendarClock,
  '/loans': PiggyBank,
  '/admin/users': Users,
  '/admin/shops': Store,
  '/admin/role-permissions': KeyRound,
  '/admin/security-settings': ShieldCheck,
  '/admin/activity-logs': History,
  '/admin/exchange-credit-issues': AlertTriangle,
  '/admin/trash': Trash2,
  '/admin/attendance-report': CalendarCheck,
  '/admin/imei-audit': ScanSearch,
  '/admin/duplicate-finder': CopyCheck,
  '/incentives': Trophy,
  '/offers': Target,
  '/send-offers': Send,
  '/reports': LineChart,
  '/reports/combined-sales': PieChart,
  '/reports/set-sales-matrix': CalendarRange,
  '/reports/financer': Landmark,
  '/reports/discounts': BadgePercent,
  '/tasks': ListChecks,
  '/tasks/new': ListPlus,
  '/admin/whatsapp-config': MessageSquare,
  '/admin/notifications': Mail,
};

const BY_SECTION = {
  Accounts: Landmark,
  'Master Entries': FolderKanban,
  'New Mobile': Smartphone,
  'Old/2nd Mobile': Repeat,
  'Other Products': Archive,
  Stickers: Tag,
  Services: Wrench,
  Business: Briefcase,
  'Airtel Recovery': Zap,
  Tasks: ListChecks,
  Settings: Settings,
};

const PROPS = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, className: 'nav-line-icon' };

/** Emoji (old design) + line icon (new design); CSS shows the right one. */
export function NavIcon({ to, section, emoji, action }) {
  const Icon = (action === 'BACKUP_AIRTEL' && Download) || (to && BY_PATH[to]) || (section && BY_SECTION[section]) || Circle;
  return (
    <>
      <span className="nav-emoji">{emoji}</span>
      <Icon {...PROPS} />
    </>
  );
}

const TAB_ICONS = { '/': Home, '/sales': FileText, '/repairs': Wrench, more: Menu };

export function TabIcon({ to, emoji }) {
  const Icon = TAB_ICONS[to] || Circle;
  return (
    <>
      <span className="nav-emoji">{emoji}</span>
      <Icon size={20} strokeWidth={1.75} aria-hidden className="nav-line-icon" />
    </>
  );
}
