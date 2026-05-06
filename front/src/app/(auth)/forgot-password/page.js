'use client'

import Button from '@/components/Button'
import Input from '@/components/Input'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import { useAuth } from '@/hooks/auth'
import { useState } from 'react'
import AuthSessionStatus from '@/app/(auth)/AuthSessionStatus'

const Page = () => {
    const { forgotPassword, authLoading } = useAuth({
        middleware: 'guest',
        redirectIfAuthenticated: '/dashboard',
    })

    const [email, setEmail] = useState('')
    const [errors, setErrors] = useState([])
    const [status, setStatus] = useState(null)

    const submitForm = event => {
        event.preventDefault()

        forgotPassword({ email, setErrors, setStatus })
    }

    return (
        <>
            {authLoading && (
                <div style={styles.loadingOverlay}>
                    <div style={styles.loadingCard}>
                        <div style={styles.spinner} />
                        <p style={styles.loadingText}>送信中...</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes forgotPasswordSpin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 640px) {
                    .forgot-card {
                        padding: 22px 16px !important;
                        border-radius: 16px !important;
                    }

                    .forgot-title {
                        font-size: 24px !important;
                    }

                    .forgot-subtitle {
                        font-size: 13px !important;
                    }

                    .forgot-actions {
                        justify-content: stretch !important;
                    }

                    .forgot-actions > * {
                        width: 100%;
                    }
                }
            `}</style>

            <div style={styles.page}>
                <div style={styles.card} className="forgot-card">
                    <div style={styles.header}>
                        <p style={styles.eyebrow}>Tool Editor</p>
                        <h1 style={styles.title} className="forgot-title">
                            パスワード再設定
                        </h1>
                        <p style={styles.subtitle} className="forgot-subtitle">
                            登録済みのメールアドレスを入力すると、再設定用リンクを送信する
                        </p>
                    </div>

                    <p>
                        Forgot your password? No problem. Just let us know your
                        email address and we will email you a password reset
                        link that will allow you to choose a new one.
                    </p>

                    <AuthSessionStatus className="mb-4" status={status} />

                    <form onSubmit={submitForm} style={styles.form}>
                        <div style={styles.fieldBlock}>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                value={email}
                                className="block mt-1 w-full"
                                onChange={event => setEmail(event.target.value)}
                                required
                                autoFocus
                                disabled={authLoading}
                            />

                            <InputError messages={errors.email} className="mt-2" />
                        </div>

                        <div style={styles.actions} className="forgot-actions">
                            <Button disabled={authLoading}>
                                {authLoading
                                    ? 'Sending...'
                                    : 'Email Password Reset Link'}
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
    infoBox: {
        marginBottom: '16px',
        padding: '14px 16px',
        borderRadius: '12px',
        background: 'var(--soft-bg)',
        border: '1px solid var(--soft-border)',
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
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '24px',
        flexWrap: 'wrap',
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
        animation: 'forgotPasswordSpin 0.8s linear infinite',
    },
    loadingText: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-sub)',
    },
}