"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";

// ============================================================
//  <ImagenConTitulo> — fila reutilizable de "título + imagen"
//
//  Usada por las identificaciones del equipo (#61) y por los avisos
//  de protección como lista dinámica (#66). Es controlada: el padre
//  pasa `nombre` y `src` (URL ya resuelta) y recibe los cambios.
//  Soporta captura por click, selección de archivo y drag & drop.
// ============================================================

export function ImagenConTitulo({
  nombre,
  src,
  placeholder = "Título de la imagen",
  onNombreChange,
  onCapture,
  onRemoveImagen,
  onDelete,
}: {
  nombre: string;
  src: string | null;
  placeholder?: string;
  onNombreChange: (value: string) => void;
  onCapture: (file: File) => void;
  onRemoveImagen?: () => void;
  onDelete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(file?: File | null) {
    if (file && file.type.startsWith("image/")) onCapture(file);
  }

  return (
    <div className="rounded-xl border border-slate-100 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-200 h-9 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={placeholder}
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
        />
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Eliminar ${nombre || "identificación"}`}
            className="text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {src ? (
        <div className="relative rounded-lg overflow-hidden border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={nombre || "Identificación"} className="w-full h-40 object-cover" />
          {onRemoveImagen && (
            <button
              type="button"
              onClick={onRemoveImagen}
              aria-label="Quitar imagen"
              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors ${
            dragOver
              ? "border-primary text-primary bg-primary/5"
              : "border-slate-300 text-slate-400 hover:border-primary hover:text-primary"
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs font-bold">Tomar foto, elegir o arrastrar</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
