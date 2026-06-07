"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Lightbulb,
  Target,
} from "lucide-react";
import type { ManualPrueba } from "@/lib/equipos/convencional/manual";

interface ManualDrawerProps {
  open: boolean;
  onClose: () => void;
  pruebas: ManualPrueba[];
  pruebaCodigo?: string;
}

export function ManualDrawer({ open, onClose, pruebas, pruebaCodigo }: ManualDrawerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Sync initial prueba
  useEffect(() => {
    if (pruebaCodigo && pruebas.length > 0) {
      const idx = pruebas.findIndex((p) => p.codigo === pruebaCodigo);
      if (idx >= 0) setCurrentIdx(idx);
    }
  }, [pruebaCodigo, pruebas]);

  // Scroll to top on prueba change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIdx]);

  // Escape to close
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (!visible || pruebas.length === 0) return null;

  const prueba = pruebas[currentIdx] ?? pruebas[0];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < pruebas.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-250"
        style={{ backgroundColor: animating ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-4 bottom-4 z-50 flex flex-col bg-white rounded-l-2xl transition-all duration-250 ease-out"
        style={{
          width: "min(72vw, 340px)",
          transform: animating ? "translateX(0)" : "translateX(100%)",
          opacity: animating ? 1 : 0,
          boxShadow: animating ? "-4px 0 24px rgba(0,0,0,0.08)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span className="font-black text-slate-900 text-[11px]">Manual</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-2.5 py-2 border-b border-slate-100 overflow-x-auto flex-shrink-0">
          {pruebas.map((p, idx) => (
            <button
              key={p.codigo}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
                idx === currentIdx
                  ? "bg-primary text-white scale-105"
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              }`}
            >
              {p.codigo}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Title */}
          <div>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">
              Prueba {prueba.codigo} — Grupo {prueba.grupo}
            </p>
            <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
              {prueba.nombre}
            </h3>
          </div>

          {/* Objetivo */}
          <Section icon={Target} title="Objetivo">
            <p className="text-[11px] text-slate-600 leading-relaxed">{prueba.objetivo}</p>
          </Section>

          {/* Instrumentación */}
          <Section icon={BookOpen} title="Instrumentación">
            <ul className="space-y-0.5">
              {prueba.instrumentacion.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <span className="text-primary font-black mt-px">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* Pasos */}
          <Section icon={BookOpen} title="Paso a paso">
            <ol className="space-y-1.5">
              {prueba.pasos.map((paso, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[9px] font-black text-white bg-primary rounded-full w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center flex-shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{paso}</p>
                </li>
              ))}
            </ol>
          </Section>

          {/* Criterios */}
          <Section icon={Target} title="Criterios de aceptación">
            <div className="space-y-1.5">
              {prueba.criterios.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100"
                >
                  <span className="text-emerald-500 font-black text-[10px] mt-px">✓</span>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-800 leading-snug">
                      {c.descripcion}
                    </p>
                    <p className="text-[10px] text-emerald-600">{c.limite}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Tips */}
          {prueba.tips.length > 0 && (
            <Section icon={Lightbulb} title="Recomendaciones">
              <div className="space-y-1.5">
                {prueba.tips.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 p-2 bg-primary/5 rounded-lg border border-primary/10"
                  >
                    <Lightbulb className="w-3 h-3 text-primary/60 flex-shrink-0 mt-px" />
                    <p className="text-[10px] text-primary/80 font-medium leading-snug">{tip}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Alertas */}
          {prueba.alertas.length > 0 && (
            <Section icon={AlertCircle} title="Alertas">
              <div className="space-y-1.5">
                {prueba.alertas.map((alerta, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 p-2 bg-amber-50 rounded-lg border border-amber-100"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-px" />
                    <p className="text-[10px] text-amber-700 font-medium leading-snug">{alerta}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setCurrentIdx((i) => i - 1)}
            className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            {hasPrev ? pruebas[currentIdx - 1].codigo : ""}
          </button>
          <span className="text-[9px] font-bold text-slate-300">
            {currentIdx + 1}/{pruebas.length}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setCurrentIdx((i) => i + 1)}
            className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            {hasNext ? pruebas[currentIdx + 1].codigo : ""}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-primary" />
        <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{title}</h4>
      </div>
      {children}
    </div>
  );
}
