import React from 'react';
import { sanitizarCbu, validarCbu } from './cbu';

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
};

/**
 * Campo CBU con validación 22 dígitos numéricos. Vacío permitido (opcional).
 *
 * Sanitiza el onChange (elimina caracteres no numéricos y trunca a 22) para
 * que sea imposible cargar otra cosa. Además muestra error inline si el user
 * pega un CBU corto/largo desde el portapapeles.
 */
export const CbuInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  disabled,
  required,
  placeholder = '22 dígitos',
}) => {
  const validacion = validarCbu(value);
  return (
    <label className="input-control">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(sanitizarCbu(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        pattern="\d{22}"
        maxLength={22}
        title="Ingresá el CBU completo (22 dígitos numéricos)."
        style={!validacion.ok ? { borderColor: '#dc2626' } : undefined}
      />
      {!validacion.ok && (
        <small style={{ color: '#dc2626', fontSize: '0.75rem' }}>{validacion.error}</small>
      )}
    </label>
  );
};
