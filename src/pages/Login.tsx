import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { FieldError } from '@/src/components/ui/field-error';
import { useAuth } from '@/src/lib/AuthContext';
import { useFormValidation, email as emailRule, required } from '@/src/lib/useFormValidation';
import { Dog } from 'lucide-react';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotMsg, setShowForgotMsg] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const { errors, validate, clearError } = useFormValidation<{ email: string; password: string }>({
        email: emailRule,
        password: required('Password'),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate({ email, password })) return;
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            const data = await response.json();

            if (response.ok) {
                login(data.token, data.user, data.passwordChangeRequired);
                if (data.passwordChangeRequired) {
                    navigate('/settings');
                } else {
                    navigate('/');
                }
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Network error. Is the server running?');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-sky px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Decorative background circles */}
            <div className="absolute top-[-120px] right-[-80px] h-[400px] w-[400px] rounded-full bg-white/10" />
            <div className="absolute bottom-[-100px] left-[-60px] h-[300px] w-[300px] rounded-full bg-white/10" />

            <div className="relative w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl">
                <div className="flex flex-col items-center justify-center">
                    <div className="rounded-2xl bg-accent p-3 shadow-lg">
                        <Dog className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="mt-6 text-center font-heading text-3xl font-bold tracking-tight text-purple">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-500">
                        Sign in to <span className="font-accent text-lg text-brand-600">Smarter Dog</span>
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block" htmlFor="email-address">Email</label>
                            <Input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@smarterdog.co.uk"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                                aria-invalid={!!errors.email}
                            />
                            <FieldError message={errors.email} />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
                                <button
                                    type="button"
                                    className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2"
                                    onClick={() => setShowForgotMsg(true)}
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                                aria-invalid={!!errors.password}
                            />
                            <FieldError message={errors.password} />
                        </div>
                    </div>

                    {showForgotMsg && (
                        <div className="text-sm text-brand-700 font-medium text-center bg-brand-50 px-3 py-2 rounded-xl">
                            Please contact the salon to reset your password.
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-coral font-medium text-center bg-coral-light px-3 py-2 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div>
                        <Button
                            type="submit"
                            className="w-full font-bold shadow-md"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </div>
                </form>

                <p className="text-center font-accent text-sm text-slate-400">
                    Come scruffy. Leave gorgeous.
                </p>
            </div>
        </div>
    );
}
