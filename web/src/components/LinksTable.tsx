import { useState } from 'react';
import type { UrlItem } from '../api/types';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible: el enlace sigue visible para copiarlo a mano */
    }
  }
  return (
    <button type="button" className="secondary small" onClick={copy}>
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export function LinksTable({ urls, highlightCode }: { urls: UrlItem[]; highlightCode?: string | null }) {
  if (urls.length === 0) {
    return <p className="empty">Aún no tienes enlaces. Crea el primero con el formulario de arriba.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Enlace corto</th>
            <th>Destino</th>
            <th className="num">Clicks</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {urls.map((u) => (
            <tr key={u.id} className={u.code === highlightCode ? 'highlight' : undefined}>
              <td>
                <div className="short-cell">
                  <a href={u.shortUrl} target="_blank" rel="noreferrer">
                    {u.shortUrl.replace(/^https?:\/\//, '')}
                  </a>
                  <CopyButton text={u.shortUrl} />
                </div>
              </td>
              <td className="dest" title={u.longUrl}>
                {u.longUrl}
              </td>
              <td className="num">{u.clicks}</td>
              <td>{dateFmt.format(new Date(u.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
