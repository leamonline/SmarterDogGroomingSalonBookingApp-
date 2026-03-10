import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined);
if (!JWT_SECRET) {
    // Use console directly — logger may not be initialized yet at startup
    console.error('CRITICAL ERROR: JWT_SECRET environment variable is required.');
    process.exit(1);
}

export { JWT_SECRET };

// --- Typed user payload attached by authenticateToken ---
export interface JwtUser {
    id: string;
    email: string;
    role: Role;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest extends express.Request {
    user: JwtUser;
    cookies: Record<string, string | undefined>;
}

// --- Auth Middleware ---
// Reads JWT from: 1) httpOnly cookie (preferred), 2) Authorization header (backward compat)
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cookieToken = (req as AuthenticatedRequest).cookies?.petspa_token;
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const token = cookieToken || headerToken;

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET!, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
        if (err || !decoded || typeof decoded === 'string') return res.sendStatus(403);
        (req as AuthenticatedRequest).user = decoded as JwtUser;
        next();
    });
};

// --- Role-Based Access Control ---
export type Role = 'customer' | 'groomer' | 'receptionist' | 'owner';

export const ROLE_HIERARCHY: Record<Role, number> = {
    'customer': 0,
    'groomer': 1,
    'receptionist': 2,
    'owner': 3,
};

// Allows the given roles AND any role higher in the hierarchy.
export const requireRole = (...allowedRoles: Role[]) => {
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r]));
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const user = (req as AuthenticatedRequest).user;
        if (!user || !user.role) {
            return res.status(403).json({ error: 'Access denied: no role assigned' });
        }
        const userLevel = ROLE_HIERARCHY[user.role as Role] ?? -1;
        if (userLevel < minLevel) {
            return res.status(403).json({ error: `Access denied: requires ${allowedRoles.join(' or ')} role or higher` });
        }
        next();
    };
};

// Shortcut: any staff (not customer)
export const requireStaff = requireRole('groomer', 'receptionist', 'owner');
// Shortcut: admin-level (receptionist or owner)
export const requireAdmin = requireRole('receptionist', 'owner');
// Shortcut: owner only
export const requireOwner = requireRole('owner');

/** Extract the authenticated user from a request. Use in routes behind authenticateToken. */
export const getUser = (req: express.Request): JwtUser => (req as AuthenticatedRequest).user;
