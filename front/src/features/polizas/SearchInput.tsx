import React, { useEffect, useRef, useState } from 'react';

/**
 * BUGFIX 02 Issue 4 — buscador universal con debounce.
 *
 * Uso típico:
 *   const [search, setSearch] = useState('');
 *   ...
 *   <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
 *
 * El padre debe usar el `value` para construir la URL del fetch (ej.
 * `/api/polizas/{id}/asegurados?search=...`). El componente sólo dispara
 * `onChange` con debounce para evitar peticiones por cada tecla.
 */
type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  ariaLabel?: string;
};

export const SearchInput: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  className,
  ariaLabel,
}) => {
  // Estado local para reflejar la tecla mientras se escribe; el padre solo
  // recibe el valor "estable" después del debounce.
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<number | null>(null);

  // Sincroniza si el padre resetea el valor (ej. cambio de filtros).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onChange(draft);
    }, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, debounceMs]);

  return (
    <div className={`search-input ${className ?? ''}`.trim()}>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
      {draft !== '' && (
        <button
          type="button"
          className="search-input__clear"
          onClick={() => {
            setDraft('');
            onChange('');
          }}
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  );
};
