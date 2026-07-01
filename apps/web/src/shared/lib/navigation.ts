import { BarChart3, Bell, BookOpen, Briefcase, FileText, Home, Scale, Users, Compass } from "lucide-react";
import type { UserRole } from "@/entities/types";

export const NAV: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  user: [
    { href: "/user/dashboard",      label: "Dashboard",            icon: Home },
    { href: "/user/matters",        label: "My Cases",             icon: BookOpen },
    { href: "/user/lawyers",        label: "Find a Lawyer",        icon: Users },
    { href: "/user/legal-tools",    label: "Legal Tools",          icon: Scale },
    { href: "/user/practice",       label: "Court Simulator",      icon: Compass },
    { href: "/user/notifications",  label: "Notifications",        icon: Bell },
  ],
  lawyer: [
    { href: "/lawyer/dashboard", label: "Dashboard",    icon: Home },
    { href: "/lawyer/matters",   label: "Matters",      icon: BookOpen },
    { href: "/lawyer/clients",   label: "Clients",      icon: Users },
    { href: "/lawyer/legal-tools", label: "Legal Tools", icon: Scale },
    { href: "/lawyer/legal-notice", label: "Legal Notice", icon: FileText },
    { href: "/lawyer/practice",    label: "Court Simulator", icon: Compass },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard",   icon: BarChart3 },
    { href: "/admin/lawyers",   label: "Lawyers",     icon: Briefcase },
    { href: "/admin/users",     label: "Users",       icon: Users },
    { href: "/admin/matters",   label: "Matters",     icon: BookOpen },
  ],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "Client",
  lawyer: "Lawyer",
  admin: "Administrator",
};

export const ROLE_COLOR: Record<UserRole, string> = {
  user: "text-brand-gold border-brand-gold/40",
  lawyer: "text-brand-teal border-brand-teal/40",
  admin: "text-red-400 border-red-400/30",
};

