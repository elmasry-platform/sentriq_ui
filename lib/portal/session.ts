"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabase } from "./supabase"

export interface PortalSession {
  accessToken: string
  userId: string
  email: string
}

export function usePortalSession() {
  const [session, setSession] = useState<PortalSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSupabase().auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ? { accessToken: data.session.access_token, userId: data.session.user.id, email: data.session.user.email ?? "" } : null)
      setLoading(false)
    })
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, s) => {
      setSession(s ? { accessToken: s.access_token, userId: s.user.id, email: s.user.email ?? "" } : null)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error("invalid_credentials")
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
  }, [])

  return { session, loading, signIn, signOut }
}
