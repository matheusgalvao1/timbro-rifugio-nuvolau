import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useMe } from '../api/hooks'
import { Shell } from './Shell'
import { CenteredSpinner } from './ui'

/**
 * Auth + role gate. Signed-in users always land somewhere useful: the right
 * role area, or /login otherwise. Wraps children in the app shell.
 */
export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode
  role?: 'owner' | 'employee'
}) {
  const me = useMe()
  if (me.isPending) return <CenteredSpinner />
  const user = me.data?.user
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'owner' ? '/owner' : '/app'} replace />
  }
  return <Shell user={user}>{children}</Shell>
}
