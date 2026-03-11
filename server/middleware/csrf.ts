import type { Request, Response, NextFunction } from 'express';

export const requireCsrfHeader = (req: Request, res: Response, next: NextFunction) => {
    // Disable CSRF requirements during automated test runs
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    // Only mutating requests need CSRF protection
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        return next();
    }

    // Require custom header for CSRF protection on mutating endpoints
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
        return res.status(403).json({ error: 'Missing active CSRF protection header' });
    }

    next();
};
