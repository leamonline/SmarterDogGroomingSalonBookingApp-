import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined);
if (!JWT_SECRET) {
    console.error('CRITICAL ERROR: JWT_SECRET environment variable is required.');
    process.exit(1);
}

export { JWT_SECRET };

// --- Auth Middleware ---
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET!, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        (req as any).user = user;
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
        const user = (req as any).user;
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
