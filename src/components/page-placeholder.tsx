import type { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  message: string;
}

export function PagePlaceholder({
  title,
  subtitle,
  icon: Icon,
  message,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          {title}
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          {subtitle}
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="bg-primary/10 p-6 rounded-3xl">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <p className="text-slate-500 font-bold text-lg">{message}</p>
        <p className="text-slate-400 text-sm max-w-md">
          Este módulo se habilitará en las próximas fases del desarrollo.
        </p>
      </div>
    </div>
  );
}
