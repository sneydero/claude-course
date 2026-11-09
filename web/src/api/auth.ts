import { postJson } from './client';
import type { AuthResult } from './types';

export const login = (email: string, password: string) =>
  postJson<AuthResult>('/auth/login', { email, password });

export const register = (email: string, password: string, name: string) =>
  postJson<AuthResult>('/auth/register', { email, password, name });
