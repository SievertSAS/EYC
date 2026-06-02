"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, ImageIcon, Loader2 } from "lucide-react";
import type { SlotImagen, ImagenEmbebida } from "@/lib/db/types";

interface ImageCaptureSlotProps {
  slot: SlotImagen;
  imagenes: ImagenEmbebida[];
  onCapture: (slotKey: string, blob: Blob) => void;
  onDelete: (slotKey: string, index: number) => void;
  disabled?: boolean;
}

export function ImageCaptureSlot({
  slot,
  imagenes,
  onCapture,
  onDelete,
  disabled = false,
}: ImageCaptureSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const slotImages = imagenes.filter((img) => img.slot_key === slot.key);
  const canAdd = slotImages.length < slot.max_imagenes;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      onCapture(slot.key, file);
    } finally {
      setLoading(false);
      // Reset input para permitir seleccionar el mismo archivo
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          {slot.label}
          {slot.obligatorio && <span className="text-red-500 text-[10px]">*</span>}
        </label>
        {slot.max_imagenes > 1 && (
          <span className="text-[10px] text-slate-400 font-bold">
            {slotImages.length}/{slot.max_imagenes}
          </span>
        )}
      </div>

      {/* Previews */}
      {slotImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {slotImages.map((img, idx) => (
            <ImagePreview
              key={`${slot.key}-${idx}`}
              imagen={img}
              onDelete={() => onDelete(slot.key, idx)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Botón captura */}
      {canAdd && !disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-dashed border-2 border-slate-200 hover:border-primary/40 hover:bg-primary/5 h-auto py-3 w-full font-bold text-sm text-slate-500"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            {slotImages.length === 0 ? "Capturar imagen" : "Agregar imagen"}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Preview de imagen ───

function ImagePreview({
  imagen,
  onDelete,
  disabled,
}: {
  imagen: ImagenEmbebida;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);

  // Generar URL del blob
  if (!src && imagen.blob_local) {
    const url = URL.createObjectURL(imagen.blob_local);
    setSrc(url);
  } else if (!src && imagen.url_storage) {
    setSrc(imagen.url_storage);
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-200 w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Evidencia" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-slate-300" />
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
