import React, { createContext, useContext, useState, useMemo } from 'react';
import { api } from '@/src/lib/api';
import type { UserRole } from '@/src/types';

interface User {
    id: string;
    email: string;
    role: UserRole;
}

interface LoginResponse {
    token: string;
    user: User;
    passwordChangeRequired?: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    passwordChangeRequired: boolean;
    login: (token: string, user: User, passwordChangeRequired?: boolean) => void;
    logout: () => void;
    hasRole: (...roles: UserRole[]) => boolean;
    isStaff: boolean;
    isAdmin: boolean;
    isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialUser = () => {
    const savedUser = localStorage.getItem('petspa_user');
    if (savedUser) {
        try {
            return JSON.parse(savedUser);
        } catch (e) {
            console.error('Failed to parse saved user data', e);
        }
    }
    return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(getInitialUser);
    // Token kept in state for backward compat but httpOnly cookie is the primary auth mechanism
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('petspa_token'));
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

    const login = (newToken: string, newUser: User, needsPasswordChange?: boolean) => {
        setToken(newToken);
        setUser(newUser);
        setPasswordChangeRequired(!!needsPasswordChange);
        // Store user info (non-sensitive) for display; token is now in httpOnly cookie
        localStorage.setItem('petspa_user', JSON.stringify(newUser));
        // Keep token in localStorage for backward compat during migration period
        // TODO: Remove localStorage token storage once fully migrated to cookies
        localStorage.setItem('petspa_token', newToken);
    };

    const logout = async () => {
        try {
            await api.logout(); // Clear server-side cookie
        } catch {
            // Best-effort; clear local state regardless
        }
        setToken(null);
        setUser(null);
        setPasswordChangeRequired(false);
        localStorage.removeItem('petspa_token');
        localStorage.removeItem('petspa_user');
    };

    const hasRole = useMemo(
        () => (...roles: UserRole[]) => {
            if (!user) return false;
            return roles.includes(user.role);
        },
        [user]
    );

    const isStaff = useMemo(() => !!user && ['groomer', 'receptionist', 'owner'].includes(user.role), [user]);
    const isAdmin = useMemo(() => !!user && ['receptionist', 'owner'].includes(user.role), [user]);
    const isOwner = useMemo(() => !!user && user.role === 'owner', [user]);

    return (
        <AuthContext.Provider value={{ user, token, passwordChangeRequired, login, logout, hasRole, isStaff, isAdmin, isOwner }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
