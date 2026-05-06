'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import Button from '@/components/Button'
import Input from '@/components/Input'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import { useAuth } from '@/hooks/auth'
import AuthSessionStatus from '@/app/(auth)/AuthSessionStatus'

function LoginContent() {
    const searchParams = useSearchParams()

    const { login, authLoading } = useAuth({
        middleware: 'guest',
        redirectIfAuthenticated: '/admin',
    })

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [shouldRemember, setShouldRemember] = useState(false)
    const [errors, setErrors] = useState([])
    const [status, setStatus] = useState(null)

    useEffect(() => {
        const reset = searchParams.get('reset')

        if (reset && errors.length === 0) {
            setStatus(atob(reset))
        } else {
            setStatus(null)
        }
    }, [searchParams, errors])

    const submitForm = async event => {
        event.preventDefault()

        await login({
            email,
            password,
            remember: shouldRemember,
            setErrors,
            setStatus,
        })
    }

    return (
        <>
            {authLoading && (
                <div style={styles.loadingOverlay}>
                    <div style={styles.loadingCard}>
                        <div style={styles.spinner} />
                        <p style={styles.loadingText}>ログイン中...</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes loginSpin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 640px) {
                    .login-card {
                        padding: 22px 16px !important;
                        border-radius: 16px !important;
                    }

                    .login-title {
                        font-size: 24px !important;
                    }

                    .login-subtitle {
                        font-size: 13px !important;
                    }

                    .login-actions {
                        flex-direction: column-reverse !important;
                        align-items: stretch !important;
                    }

                    .login-forgot-link {
                        text-align: center;
                    }
                }
            `}</style>

            <div style={styles.page}>
                <div style={styles.card} className="login-card">
                    <div style={styles.header}>
                        <p style={styles.eyebrow}>Tool Editor</p>
                        <h1 style={styles.title} className="login-title">
                            ログイン
                        </h1>
                        <p style={styles.subtitle} className="login-subtitle">
                            メールアドレスとパスワードを入力してログイン
                        </p>
                    </div>

                    <AuthSessionStatus className="mb-4" status={status} />

                    <form onSubmit={submitForm} style={styles.form}>
                        <div style={styles.fieldBlock}>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                className="block mt-1 w-full"
                                onChange={event => setEmail(event.target.value)}
                                required
                                autoFocus
                                disabled={authLoading}
                            />
                            <InputError messages={errors.email} className="mt-2" />
                        </div>

                        <div style={styles.fieldBlock}>
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                className="block mt-1 w-full"
                                onChange={event => setPassword(event.target.value)}
                                required
                                autoComplete="current-password"
                                disabled={authLoading}
                            />
                            <InputError
                                messages={errors.password}
                                className="mt-2"
                            />
                        </div>

                        <div style={styles.rememberBlock}>
                            <label htmlFor="remember_me" style={styles.rememberLabel}>
                                <input
                                    id="remember_me"
                                    type="checkbox"
                                    name="remember"
                                    style={styles.checkbox}
                                    onChange={event =>
                                        setShouldRemember(event.target.checked)
                                    }
                                    disabled={authLoading}
                                />
                                <span style={styles.rememberText}>Remember me</span>
                            </label>
                        </div>

                        <div style={styles.actions} className="login-actions">
                            <Link
                                href="/forgot-password"
                                style={styles.forgotLink}
                                className="login-forgot-link">
                                Forgot your password?
                            </Link>

                            <Button className="ml-3" disabled={authLoading}>
                                {authLoading ? 'Loading...' : 'Login'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default function Login() {
    return (
        <Suspense fallback={<div style={styles.suspenseFallback}>Loading...</div>}>
            <LoginContent />
        </Suspense>
    )
}

const styles = {
    page: {
        width: '100%',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background:
            'linear-gradient(180deg, var(--page-bg) 0%, var(--soft-bg) 100%)',
        boxSizing: 'border-box',
    },
    card: {
        width: '100%',
        maxWidth: '520px',
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '20px',
        padding: '32px 28px',
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
        boxSizing: 'border-box',
    },
    header: {
        marginBottom: '20px',
    },
    eyebrow: {
        margin: '0 0 8px',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
    },
    title: {
        margin: '0 0 10px',
        fontSize: '30px',
        lineHeight: 1.15,
        fontWeight: 900,
        color: 'var(--text-title)',
        letterSpacing: '-0.02em',
    },
    subtitle: {
        margin: 0,
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'var(--text-sub)',
    },
    form: {
        width: '100%',
        minWidth: 0,
    },
    fieldBlock: {
        marginTop: '16px',
    },
    rememberBlock: {
        display: 'block',
        marginTop: '18px',
    },
    rememberLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
    },
    checkbox: {
        width: '16px',
        height: '16px',
        accentColor: 'var(--primary-bg)',
        cursor: 'pointer',
    },
    rememberText: {
        fontSize: '14px',
        color: 'var(--text-sub)',
        lineHeight: 1.5,
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '24px',
        flexWrap: 'wrap',
    },
    forgotLink: {
        fontSize: '14px',
        color: 'var(--text-sub)',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        transition: 'opacity 0.2s ease',
    },
    loadingOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--page-bg) 72%, transparent)',
        backdropFilter: 'blur(4px)',
        padding: '20px',
    },
    loadingCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        padding: '24px 32px',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid var(--soft-border)',
        borderTop: '4px solid var(--primary-bg)',
        borderRadius: '50%',
        animation: 'loginSpin 0.8s linear infinite',
    },
    loadingText: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-sub)',
    },
    suspenseFallback: {
        color: 'var(--text-sub)',
        fontSize: '14px',
    },
}