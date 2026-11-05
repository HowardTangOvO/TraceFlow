import {
  BookOpen,
  Boxes,
  FileText,
  FlaskConical,
  GitPullRequestArrow,
  LayoutDashboard,
  ListChecks,
  RotateCcw,
  ScrollText,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

/** 侧边导航：覆盖三维度 + 知识库 + 系统管理 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Project overview", icon: LayoutDashboard, description: "Progress, risks and dimension summaries" },
    ],
  },
  {
    title: "PM",
    items: [
      { href: "/requirements", label: "Requirements", icon: FileText, description: "Requirements, traceability and changes" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, description: "Task progress and effort" },
    ],
  },
  {
    title: "Engineering",
    items: [
      { href: "/code", label: "Code modules", icon: Boxes, description: "Module traceability and impact" },
      { href: "/changes", label: "Change center", icon: GitPullRequestArrow, description: "Impact, effort and approval" },
    ],
  },
  {
    title: "Testing",
    items: [
      { href: "/tests", label: "Test cases", icon: FlaskConical, description: "Cases and coverage" },
      { href: "/regression", label: "Regression plans", icon: RotateCcw, description: "Plans and execution records" },
    ],
  },
  {
    title: "Knowledge base",
    items: [
      { href: "/docs", label: "Knowledge documents", icon: BookOpen, description: "Requirements, designs and test strategies" },
      { href: "/ask", label: "Knowledge Q&A", icon: Sparkles, description: "Answers based on project knowledge" },
    ],
  },
  {
    title: "System",
    adminOnly: true,
    items: [
      { href: "/admin/users", label: "User management", icon: Users, description: "Accounts, roles and permissions" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, description: "Recorded operations" },
    ],
  },
];
