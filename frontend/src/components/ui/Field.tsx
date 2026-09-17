"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type Base = {
  id: string;
  label: string;
  help?: string | null;
  error?: string | null;
};

type InputProps = Base & Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { multiline?: false };
type TextareaProps = Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { multiline: true };

/** Input del form (§2.9): etichetta visibile sopra, aiuto in nota, errore sotto preceduto da "Errore:". */
export function Field(props: InputProps | TextareaProps) {
  const { id, label, help, error } = props;
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {help ? (
        <span className="field-help t-nota" id={`${id}-help`}>
          {help}
        </span>
      ) : null}
      {props.multiline ? (
        <textarea
          {...(() => {
            const { id: _i, label: _l, help: _h, error: _e, multiline: _m, ...rest } = props;
            void _i; void _l; void _h; void _e; void _m;
            return rest;
          })()}
          id={id}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          {...(() => {
            const { id: _i, label: _l, help: _h, error: _e, multiline: _m, ...rest } = props as InputProps;
            void _i; void _l; void _h; void _e; void _m;
            return rest;
          })()}
          id={id}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
      {error ? (
        <span className="field-error t-corpo" id={`${id}-err`}>
          Errore: {error}
        </span>
      ) : null}
    </div>
  );
}

export function Checkbox({ id, label, children, ...rest }: { id: string; label: ReactNode; children?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">) {
  return (
    <label className="checkbox" htmlFor={id}>
      <input type="checkbox" id={id} {...rest} />
      <span>
        {label}
        {children}
      </span>
    </label>
  );
}
