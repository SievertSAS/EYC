"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { parseDecimal, decimalInputValue } from "@/lib/decimal";

// ============================================================
//  <NumberInput> — entrada numérica con convención es-CO (#68)
//
//  Reemplaza `<input type="number">`, que se comporta distinto según el
//  locale del navegador/tablet. Acá:
//   - se muestra con coma decimal,
//   - se acepta coma O punto al tipear,
//   - `onValueChange` entrega un `number | undefined` ya normalizado
//     (nunca un string a medio parsear).
//  Usa `inputMode="decimal"` → teclado numérico en la tablet.
// ============================================================

type Props = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number | null | undefined;
  onValueChange: (value: number | undefined) => void;
};

export function NumberInput({ value, onValueChange, onBlur, ...rest }: Props) {
  // Mientras el input tiene foco, el usuario manda: no re-formateamos su
  // texto en cada tecla. Al perder foco, se normaliza a la vista es-CO.
  const [text, setText] = React.useState(() => decimalInputValue(value));
  const [focused, setFocused] = React.useState(false);
  const [prevValue, setPrevValue] = React.useState(value);

  // El valor externo cambió (sync / reset) y el input no tiene foco →
  // re-derivar el texto. Ajuste de estado en render, no en efecto.
  if (!focused && prevValue !== value) {
    setPrevValue(value);
    if (parseDecimal(text) !== value) setText(decimalInputValue(value));
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(parseDecimal(e.target.value));
      }}
      onBlur={(e) => {
        setFocused(false);
        setText(decimalInputValue(parseDecimal(e.target.value)));
        onBlur?.(e);
      }}
    />
  );
}
