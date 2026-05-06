'use client'

import Button from '@/components/Button'
import Input from '@/components/Input'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import Link from 'next/link'
import { useAuth } from '@/hooks/auth'
import { useState } from 'react'

const Page = () => {
    const { register, authLoading } = useAuth({
        middleware: 'guest',
        redirectIfAuthenticated: '/dashboard',
    })

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirmation, setPasswordConfirmation] = useState('')
    const [errors, setErrors] = useState([])

    const submitForm = async event => {
        event.preventDefault()

        await register({
            name,
            email,
            password,
            password_confirmation: passwordConfirmation,
            setErrors,
        })
    }

    return (
        <>
            {authLoading && (
                <div style={styles.loadingOverlay}>
                    <div style={styles.loadingCard}>
                        <div style={styles.spinner} />
                        <p style={styles.loadingText}>登録中...</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes registerSpin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 640px) {
                    .register-card {
                        padding: 22px 16px !important;
                        border-radius: 16px !important;
                    }

                    .register-title {
                        font-size: 24px !important;
                    }

                    .register-subtitle {
                        font-size: 13px !important;
                    }

                    .register-actions {
                        flex-direction: column-reverse !important;
                        align-items: stretch !important;
                    }

                    .register-login-link {
                        text-align: center;
                    }
                }
            `}</style>

            <div style={styles.page}>
                <div style={styles.card} className="register-card">
                    <div style={styles.header}>
                        <p style={styles.eyebrow}>Tool Editor</p>
                        <h1 style={styles.title} className="register-title">
                            アカウント登録
                        </h1>
                        <p style={styles.subtitle} className="register-subtitle">
                            必要な情報を入力して新しいアカウントを作成
                        </p>
                    </div>

                    <form onSubmit={submitForm} style={styles.form}>
                        <div style={styles.fieldBlock}>
                            <Label htmlFor="name">Name</Label>

                            <Input
                                id="name"
                                type="text"
                                value={name}
                                className="block mt-1 w-full"
                                onChange={event => setName(event.target.value)}
                                required
                                autoFocus
                                disabled={authLoading}
                            />

                            <InputError messages={errors.name} className="mt-2" />
                        </div>

                        <div style={styles.fieldBlock}>
                            <Label htmlFor="email">Email</Label>

                            <Input
                                id="email"
                                type="email"
                                value={email}
                                className="block mt-1 w-full"
                                onChange={event => setEmail(event.target.value)}
                                required
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
                                autoComplete="new-password"
                                disabled={authLoading}
                            />

                            <InputError messages={errors.password} className="mt-2" />
                        </div>

                        <div style={styles.fieldBlock}>
                            <Label htmlFor="passwordConfirmation">
                                Confirm Password
                            </Label>

                            <Input
                                id="passwordConfirmation"
                                type="password"
                                value={passwordConfirmation}
                                className="block mt-1 w-full"
                                onChange={event =>
                                    setPasswordConfirmation(event.target.value)
                                }
                                required
                                disabled={authLoading}
                            />

                            <InputError
                                messages={errors.password_confirmation}
                                className="mt-2"
                            />
                        </div>

                        <div style={styles.actions} className="register-actions">
                            <Link
                                href="/login"
                                style={styles.loginLink}
                                className="register-login-link">
                                Already registered?
                            </Link>

                            <Button className="ml-4" disabled={authLoading}>
                                {authLoading ? 'Loading...' : 'Register'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default Page

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
        maxWidth: '560px',
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
    actions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '24px',
        flexWrap: 'wrap',
    },
    loginLink: {
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
        animation: 'registerSpin 0.8s linear infinite',
    },
    loadingText: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-sub)',
    },
}