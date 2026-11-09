import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BadRequestError, ConflictError, UnauthorizedError } from '../shared/errors.js';
import type { AuthRepository, UserRecord } from './auth.repository.js';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const TOKEN_TTL = '24h';

// Hash de relleno para igualar el tiempo de respuesta cuando el email no existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72; // límite de bcrypt

const toPublic = (u: UserRecord): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.createdAt,
});

export interface AuthOptions {
  jwtSecret: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestError(`${field} es obligatorio`);
  }
  return value;
}

export function createAuthService(repo: AuthRepository, { jwtSecret }: AuthOptions) {
  if (!jwtSecret) throw new Error('jwtSecret es obligatorio');

  const signToken = (userId: number): string =>
    jwt.sign({ sub: String(userId) }, jwtSecret, { algorithm: 'HS256', expiresIn: TOKEN_TTL });

  return {
    async register(email: unknown, password: unknown, name: unknown): Promise<AuthResult> {
      const normalized = normalizeEmail(requireString(email, 'email'));
      if (!EMAIL_RE.test(normalized)) throw new BadRequestError('email no es válido');
      const pwd = requireString(password, 'password');
      if (pwd.length < MIN_PASSWORD_LENGTH) {
        throw new BadRequestError(`password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      }
      if (Buffer.byteLength(pwd) > MAX_PASSWORD_BYTES) {
        throw new BadRequestError(`password no puede superar ${MAX_PASSWORD_BYTES} bytes`);
      }
      const userName = requireString(name, 'nombre').trim();

      const passwordHash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
      const user = repo.insert(normalized, passwordHash, userName);
      if (!user) throw new ConflictError('El email ya está registrado');
      return { user: toPublic(user), token: signToken(user.id) };
    },

    async login(email: unknown, password: unknown): Promise<AuthResult> {
      const normalized = normalizeEmail(requireString(email, 'email'));
      const pwd = requireString(password, 'password');

      const user = repo.findByEmail(normalized);
      const valid = await bcrypt.compare(pwd, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !valid) throw new UnauthorizedError();
      return { user: toPublic(user), token: signToken(user.id) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
