import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { DbProvider } from "@/components/db-provider";
import { RoleProvider } from "@/components/role-provider";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DbProvider>
      <RoleProvider>
        <TooltipProvider>
          <SidebarProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-xl focus:text-sm focus:font-bold focus:shadow-lg"
            >
              Ir al contenido principal
            </a>
            <AppSidebar />
            <SidebarInset>
              {/* Header móvil con trigger del sidebar */}
              <header className="flex items-center gap-3 p-4 md:hidden border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <SidebarTrigger className="text-slate-600" />
                <Image
                  src="/logo-sievert.png"
                  alt="Sievert"
                  width={120}
                  height={40}
                  className="h-7 w-auto object-contain"
                />
              </header>

              {/* Contenido principal */}
              <main
                id="main-content"
                className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 gradient-bg min-h-screen"
              >
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </RoleProvider>
    </DbProvider>
  );
}
