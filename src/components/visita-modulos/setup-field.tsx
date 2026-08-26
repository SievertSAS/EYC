"use client";

import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SetupFieldProps {
  label: string;
  defaultValue: string | number;
  type?: "text" | "number" | "date";
  step?: string;
  placeholder?: string;
  className?: string;
  onSave: (value: string) => void;
}

/**
 * Campo "setup" (uno por visita — distancia, técnica, etc.) con guardado
 * on-blur y check de confirmación (1500ms), replicando el patrón visual de
 * `EditableField` en info-modulo.tsx para los módulos Grupo A-E. A
 * diferencia de `EditableField` (controlado, debounce por tecla), este es
 * no controlado (`defaultValue` + `onBlur`) para calzar con el patrón que
 * ya usan estos módulos — el guardado real puede tener su propio debounce
 * externo (ver `updateSetup` en cada módulo).
 */
export function SetupField({
  label,
  defaultValue,
  type = "number",
  step,
  placeholder,
  className = "rounded-xl h-9 text-sm font-medium",
  onSave,
}: SetupFieldProps) {
  const [saved, setSaved] = useState(false);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      onSave(e.target.value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [onSave]
  );

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {label}
        {saved && <Check className="w-3 h-3 text-emerald-500" />}
      </label>
      <Input
        type={type}
        step={step}
        className={className}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={handleBlur}
      />
    </div>
  );
}
