import { randomInt } from 'node:crypto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../shared/errors.js';
import type { UrlRecord, UrlsRepository, UrlWithStats } from './urls.repository.js';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7;
const MAX_ATTEMPTS = 5;
const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;
// Rutas que el servidor usa en la raíz: un alias igual taparía o sería tapado por ellas.
const RESERVED_ALIASES = new Set(['api', 'app', 'auth', 'health']);

export function generateCode(length = CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function parseHttpUrl(input: unknown): string {
  if (typeof input !== 'string') throw new BadRequestError('url debe ser un string');
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new BadRequestError('url no es válida');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError('url debe usar http o https');
  }
  return parsed.href;
}

/** Alias opcional: `undefined`/`null` significa "genera un código". */
export function parseAlias(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'string') throw new BadRequestError('alias debe ser un string');
  if (!ALIAS_RE.test(input)) {
    throw new BadRequestError('alias debe tener entre 3 y 32 caracteres: letras, números, "-" o "_"');
  }
  if (RESERVED_ALIASES.has(input.toLowerCase())) throw new BadRequestError('alias reservado');
  return input;
}

export function createUrlsService(repo: UrlsRepository) {
  return {
    shorten(input: unknown, userId: number, aliasInput?: unknown): UrlRecord {
      const longUrl = parseHttpUrl(input);
      const alias = parseAlias(aliasInput);
      if (alias) {
        if (!repo.insert(alias, longUrl, userId)) throw new ConflictError('El alias ya está en uso');
        return repo.findByCode(alias)!;
      }
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const code = generateCode();
        if (repo.insert(code, longUrl, userId)) return repo.findByCode(code)!;
      }
      throw new Error('No se pudo generar un código único');
    },
    /** Resuelve el código y registra el click. Un fallo al registrar nunca rompe el redirect. */
    resolve(code: string, userAgent?: string): UrlRecord | undefined {
      const record = repo.findByCode(code);
      if (record) {
        try {
          repo.recordClick(record.id, userAgent?.slice(0, 512) ?? null);
        } catch (err) {
          console.error('No se pudo registrar el click', err);
        }
      }
      return record;
    },
    listByUser: (userId: number): UrlWithStats[] => repo.listByUser(userId),
    remove(code: string, userId: number): void {
      const record = repo.findByCode(code);
      if (!record) throw new NotFoundError('Código no encontrado');
      if (record.userId !== userId) throw new ForbiddenError('Esta URL pertenece a otro usuario');
      // La comprobación de propiedad se repite en el DELETE para evitar carreras.
      repo.deleteOwned(code, userId);
    },
  };
}

export type UrlsService = ReturnType<typeof createUrlsService>;
