import { env } from '../env.js';

export type PasswordResetUrlConfig = {
    appUrl?: string;
    corsOrigin?: string;
    nodeEnv?: 'development' | 'test' | 'production';
};

export const resolvePasswordResetBaseUrl = ({
    appUrl = env.APP_URL,
    corsOrigin = env.CORS_ORIGIN,
    nodeEnv = env.NODE_ENV,
}: PasswordResetUrlConfig = {}) => {
    const configuredBaseUrl = (appUrl || corsOrigin || '').trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/+$/, '');
    }

    if (nodeEnv === 'production') {
        throw new Error('APP_URL or CORS_ORIGIN must be configured for password reset emails');
    }

    return 'http://localhost:3000';
};

export const buildResetUrl = (token: string, config?: PasswordResetUrlConfig) => {
    const baseUrl = resolvePasswordResetBaseUrl(config);
    return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
};
