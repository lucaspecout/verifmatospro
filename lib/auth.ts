import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

export type UserRole = 'ADMIN' | 'CHEF' | 'MATERIEL';

const COOKIE_NAME = 'verifmatospro_session';
const TOKEN_TTL = 60 * 60 * 8;

const authSecret = process.env.AUTH_SECRET ?? 'dev-secret-change-me';

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signToken = (payload: { userId: string; role: UserRole }) =>
  jwt.sign(payload, authSecret, { expiresIn: TOKEN_TTL });

export const setAuthCookie = (token: string) => {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL,
    path: '/'
  });
};

export const clearAuthCookie = () => {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  });
};

export const getSession = async () => {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, authSecret) as { userId: string; role: UserRole };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return null;
    return { user, role: decoded.role };
  } catch {
    return null;
  }
};

export const requireRole = (role: UserRole | UserRole[]) => {
  const roles = Array.isArray(role) ? role : [role];
  return async () => {
    const session = await getSession();
    if (!session || !roles.includes(session.role)) {
      throw new Error('UNAUTHORIZED');
    }
    return session;
  };
};
