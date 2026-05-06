import useSWR from 'swr'
import axios from '@/lib/axios'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export const useAuth = ({ middleware, redirectIfAuthenticated } = {}) => {
    const router = useRouter()
    const params = useParams()
    const [authLoading, setAuthLoading] = useState(false)

    const { data: user, error, mutate } = useSWR('/api/user', () =>
        axios
            .get('/api/user')
            .then(res => res.data)
            .catch(error => {
                if (error.response?.status === 401) {
                    return null
                }

                if (error.response?.status !== 409) throw error

                router.push('/verify-email')
            }),
    )

    const csrf = () => axios.get('/sanctum/csrf-cookie')

    const register = async ({ setErrors, ...props }) => {
        setAuthLoading(true)

        try {
            await csrf()
            setErrors([])

            await axios.post('/register', props)
            await mutate()
        } catch (error) {
            if (error.response?.status !== 422) throw error
            setErrors(error.response.data.errors)
        } finally {
            setAuthLoading(false)
        }
    }

    const login = async ({ setErrors, setStatus, ...props }) => {
        setAuthLoading(true)

        try {
            await csrf()
            setErrors([])
            setStatus(null)

            await axios.post('/login', props)
            await mutate()
        } catch (error) {
            if (error.response?.status !== 422) throw error
            setErrors(error.response.data.errors)
        } finally {
            setAuthLoading(false)
        }
    }

    const forgotPassword = async ({ setErrors, setStatus, email }) => {
        setAuthLoading(true)

        try {
            await csrf()
            setErrors([])
            setStatus(null)

            const response = await axios.post('/forgot-password', { email })
            setStatus(response.data.status)
        } catch (error) {
            if (error.response?.status !== 422) throw error
            setErrors(error.response.data.errors)
        } finally {
            setAuthLoading(false)
        }
    }

    const resetPassword = async ({ setErrors, setStatus, ...props }) => {
        setAuthLoading(true)

        try {
            await csrf()
            setErrors([])
            setStatus(null)

            const response = await axios.post('/reset-password', {
                token: params.token,
                ...props,
            })

            router.push('/login?reset=' + btoa(response.data.status))
        } catch (error) {
            if (error.response?.status !== 422) throw error
            setErrors(error.response.data.errors)
        } finally {
            setAuthLoading(false)
        }
    }

    const resendEmailVerification = async ({ setStatus }) => {
        setAuthLoading(true)

        try {
            const response = await axios.post('/email/verification-notification')
            setStatus(response.data.status)
        } finally {
            setAuthLoading(false)
        }
    }

    const logout = async () => {
        setAuthLoading(true)

        try {
            if (!error) {
                await axios.post('/logout')
                await mutate()
            }

            window.location.pathname = '/login'
        } finally {
            setAuthLoading(false)
        }
    }

    useEffect(() => {
        if (middleware === 'guest' && redirectIfAuthenticated && user)
            router.push(redirectIfAuthenticated)

        if (middleware === 'auth' && user && !user.email_verified_at)
            router.push('/verify-email')

        if (
            window.location.pathname === '/verify-email' &&
            user?.email_verified_at
        )
            router.push(redirectIfAuthenticated)

        if (middleware === 'auth' && error) logout()
    }, [user, error])

    return {
        user,
        register,
        login,
        forgotPassword,
        resetPassword,
        resendEmailVerification,
        logout,
        authLoading,
    }
}