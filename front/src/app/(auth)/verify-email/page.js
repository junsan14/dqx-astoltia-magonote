'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/auth'

const Page = () => {
    const { logout } = useAuth({
        middleware: 'auth',
        redirectIfAuthenticated: '/dashboard',
    })

    const [status] = useState(null)

    return (
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <div className="w-full max-w-xl">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900">
                    
                    {/* header */}
                    <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-cyan-500/10 px-6 py-6 dark:border-white/10">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            メール認証待ち
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            登録ありがとう。現在このページは、メール認証が完了していない状態です。
                        </p>
                    </div>

                    {/* content */}
                    <div className="space-y-6 px-6 py-6">

                        {/* notice */}
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                                利用について
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                                現状、編集機能は一部のユーザーのみに制限しております。<br />
                                利用希望や質問があれば、Xから連絡してください。
                            </p>
                        </div>

                        {/* success */}
                        {status === 'verification-link-sent' && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                認証メールを再送した
                            </div>
                        )}

                        {/* actions */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <a
                                href="https://x.com/miki0801388249"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                            >
                                Xで連絡する
                            </a>
                        {/*
                            <button
                                type="button"
                                onClick={() => resendEmailVerification({ setStatus })}
                                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
                            >
                                認証メールを再送
                            </button>
                        */}
                        </div>

                        {/* logout */}
                        <div className="border-t border-slate-200 pt-5 dark:border-white/10">
                            <button
                                type="button"
                                onClick={logout}
                                className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                            >
                                ログアウト
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default Page