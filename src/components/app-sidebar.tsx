"use client";

import {
  LayoutDashboard,
  ClipboardCheck,
  Radio,
  FileText,
  RefreshCw,
  Settings,
  LogOut,
  ShieldCheck,
  Building2,
  Briefcase,
} from "lucide-react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/components/role-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { LucideIcon } from "lucide-react";

interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  module: string;
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const menuItems: MenuGroup[] = [
  {
    group: "Principal",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { title: "Clientes", href: "/dashboard/clientes", icon: Building2, module: "clientes" },
      { title: "Solicitudes", href: "/dashboard/solicitudes", icon: Briefcase, module: "solicitudes" },
      { title: "Mis Visitas", href: "/dashboard/visitas", icon: ClipboardCheck, module: "visitas" },
      { title: "Revisión", href: "/dashboard/revision", icon: ShieldCheck, module: "revision" },
    ],
  },
  {
    group: "Operación",
    items: [
      { title: "Equipos", href: "/dashboard/equipos", icon: Radio, module: "equipos" },
      { title: "Informes", href: "/dashboard/informes", icon: FileText, module: "informes" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { title: "Sincronización", href: "/dashboard/sync", icon: RefreshCw, module: "sync" },
      { title: "Configuración", href: "/dashboard/configuracion", icon: Settings, module: "configuracion" },
    ],
  },
];

const CARGO_COLORS: Record<string, string> = {
  tecnico: "text-primary",
  comercial: "text-emerald-600",
  coordinador: "text-amber-600",
  programador: "text-violet-600",
};

const CARGO_LABELS: Record<string, string> = {
  tecnico: "Técnico",
  comercial: "Comercial",
  coordinador: "Coordinador",
  programador: "Programador",
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, hasPermission } = useRole();
  const cargo = role?.cargo ?? "tecnico";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-5 sm:p-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/logo-sievert.png"
            alt="Sievert Protección Radiológica"
            width={180}
            height={60}
            className="h-10 sm:h-12 w-auto object-contain"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 sm:px-4">
        {menuItems.map((group) => {
          const visibleItems = group.items.filter((item) =>
            hasPermission(item.module)
          );
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.group}>
              <SidebarGroupLabel className="px-2 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] mb-2">
                {group.group}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-1">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        className="h-11 rounded-xl hover:bg-primary/5 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                        render={<Link href={item.href} />}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-bold text-sm">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4 sm:p-5 mt-auto border-t border-sidebar-border">
        {role && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <Avatar className="h-10 w-10 border-2 border-primary/20 p-0.5">
              <AvatarFallback className="bg-primary text-white font-bold text-sm">
                {role.nombre
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black text-slate-900 truncate">
                {role.nombre}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${CARGO_COLORS[cargo] ?? "text-primary"}`}
              >
                {CARGO_LABELS[cargo] ?? cargo}
              </span>
            </div>
          </div>
        )}

        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 rounded-xl font-bold text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
