import { useState, type FormEvent } from 'react';
import { createUrl } from '../api/urls';
import { ApiError } from '../api/client';
import type { CreatedUrl } from '../api/types';

const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function ShortenForm({ onCreated }: { onCreated: (created: CreatedUrl) => void }) {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanUrl = url.trim();
    const cleanAlias = alias.trim();
    if (!cleanUrl) {
      setError('Introduce la URL que quieres acortar.');
      return;
    }
    if (cleanAlias && !ALIAS_RE.test(cleanAlias)) {
      setError('El alias debe tener entre 3 y 32 caracteres: letras, números, "-" o "_".');
      return;
    }
    setLoading(true);
    try {
      const created = await createUrl(cleanUrl, cleanAlias || undefined);
      setUrl('');
      setAlias('');
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="shorten-form" onSubmit={onSubmit} noValidate>
      <label className="grow">
        URL a acortar
        <input
          type="url"
          inputMode="url"
          placeholder="https://ejemplo.com/una/url/muy/larga"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label>
        Alias <span className="muted">(opcional)</span>
        <input type="text" placeholder="mi-enlace" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Creando…' : 'Acortar'}
      </button>
      {error && (
        <p role="alert" className="error full">
          {error}
        </p>
      )}
    </form>
  );
}
