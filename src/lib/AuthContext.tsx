import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserRole } from '@/src/types';

interface User {
    id: string;
    email: string;
    role: UserRole;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
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
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('petspa_token'));

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('petspa_token', newToken);
        localStorage.setItem('petspa_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('petspa_token');
        localStorage.removeItem('petspa_user');
    };

    const hasRole = (...roles: UserRole[]) => {
        if (!user) return false;
        return roles.includes(user.role);
    };

    const isStaff = hasRole('groomer', 'receptionist', 'owner');
    const isAdmin = hasRole('receptionist', 'owner');
    const isOwner = hasRole('owner');

    return (
        <AuthContext.Provider value={{ user, token, login, logout, hasRole, isStaff, isAdmin, isOwner }}>
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
