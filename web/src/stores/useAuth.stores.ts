import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type authState = {
  data: {
    accessToken: string
    refreshToken: string
    userId: string
    name?: string
    username?: string
    email?: string
    avatarUrl?: string
    conversationId?: string
    role?: string
    isVip?: boolean
  } | null
}

type authActions = {
  setData: (data: authState['data']) => void
  setConversationId: (conversationId: string) => void
  logout: () => void
}

export const useAuthStore = create(
  persist<authState & authActions>(
    (set) => ({
      data: { isVip: true } as any, // Mock value
      setData: (data) => set(() => ({ data: { ...data, isVip: true } as any })),
      setConversationId: (conversationId) => set((s) => ({ data: s.data ? { ...s.data, conversationId } : s.data })),
      logout: () => set(() => ({ data: null }))
    }),
    {
      name: 'user-storage'
    }
  )
)
