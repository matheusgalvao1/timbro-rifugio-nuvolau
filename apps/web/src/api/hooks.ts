import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ReportDetailRow,
  type ReportSummaryRow,
  type TimeEntry,
  type UserPublic,
} from '@nuvolau/shared'
import { api, qs } from './client'

/** Employee's entries for a range (usually one month). */
export function useEntries(from: string, to: string) {
  return useQuery({
    queryKey: ['entries', from, to],
    queryFn: () =>
      api<{ entries: TimeEntry[]; from: string; to: string }>(
        `/api/entries${qs({ from, to })}`,
      ),
  })
}

/** The logged employee's still-running timer, refreshed while it runs. */
export function useRunningTimer() {
  return useQuery({
    queryKey: ['running'],
    queryFn: () => api<{ entry: TimeEntry | null }>('/api/entries/running'),
    refetchInterval: (query) => (query.state.data?.entry ? 30_000 : false),
  })
}

export interface EntryInput {
  workDate: string
  startTime: string
  endTime?: string
}

export function useEntryMutation(entryId: string | null) {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: EntryInput) =>
      entryId
        ? api<{ entry: TimeEntry }>(`/api/entries/${entryId}`, { method: 'PATCH', json: input })
        : api<{ entry: TimeEntry }>('/api/entries', { method: 'POST', json: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteEntry() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (entryId: string) =>
      api<{ ok: boolean }>(`/api/entries/${entryId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useStartTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: { workDate?: string; startTime?: string }) =>
      api<{ entry: TimeEntry }>('/api/entries/start', { method: 'POST', json: input }),
    onSuccess: invalidate,
  })
}

export function useStopTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: { endDate?: string; endTime?: string }) =>
      api<{ ok: boolean }>('/api/entries/stop', { method: 'POST', json: input }),
    onSuccess: invalidate,
  })
}

export function usePauseTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: { workDate?: string; startTime?: string }) =>
      api<{ entry: TimeEntry }>('/api/entries/pause', { method: 'POST', json: input }),
    onSuccess: invalidate,
  })
}

export function useResumeTimer() {
  const invalidate = useInvalidateTime()
  return useMutation({
    mutationFn: (input: { endDate?: string; endTime?: string }) =>
      api<{ entry: TimeEntry }>('/api/entries/resume', { method: 'POST', json: input }),
    onSuccess: invalidate,
  })
}

function useInvalidateTime() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['entries'] }),
      queryClient.invalidateQueries({ queryKey: ['running'] }),
    ])
  }
}

/* ---------- auth ---------- */

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: UserPublic }>('/api/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      api<{ user: UserPublic }>('/api/auth/login', { method: 'POST', json: input }),
    onSuccess: (data) => queryClient.setQueryData(['me'], data),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.clear(),
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { displayName?: string; username?: string }) =>
      api<{ user: UserPublic }>('/api/auth/me', { method: 'PATCH', json: input }),
    onSuccess: (data) => queryClient.setQueryData(['me'], data),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current: string; next: string }) =>
      api<{ ok: boolean }>('/api/auth/password', { method: 'PATCH', json: input }),
  })
}

/* ---------- owner: users ---------- */

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ users: UserPublic[] }>('/api/users'),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { username: string; displayName: string }) =>
      api<{ user: UserPublic; password: string }>('/api/users', { method: 'POST', json: input }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['summary'] }),
    ]),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { userId: string; input: { displayName?: string; username?: string; isActive?: boolean } }) =>
      api<{ user: UserPublic }>(`/api/users/${args.userId}`, { method: 'PATCH', json: args.input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useResetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ password: string }>(`/api/users/${userId}/reset-password`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

/* ---------- owner: reports ---------- */

export interface ReportFilter {
  from: string
  to: string
  users?: string[]
}

export function useReportSummary(filter: ReportFilter) {
  return useQuery({
    queryKey: ['summary', filter.from, filter.to, filter.users?.join(',') ?? ''],
    queryFn: () =>
      api<{ from: string; to: string; summary: ReportSummaryRow[] }>(
        `/api/reports/summary${qs({ from: filter.from, to: filter.to, users: filter.users })}`,
      ),
  })
}

/** On-demand detail rows (drill-down + CSV export). */
export function fetchReportDetail(filter: ReportFilter) {
  return api<{ rows: ReportDetailRow[] }>(`/api/reports/detail${qs({ from: filter.from, to: filter.to, users: filter.users })}`)
}

/** On-demand summary rows (CSV export). */
export function fetchReportSummary(filter: ReportFilter) {
  return api<{ from: string; to: string; summary: ReportSummaryRow[] }>(
    `/api/reports/summary${qs({ from: filter.from, to: filter.to, users: filter.users })}`,
  )
}

export function useReportDetail(filter: ReportFilter, enabled: boolean) {
  return useQuery({
    queryKey: ['detail', filter.from, filter.to, filter.users?.join(',') ?? ''],
    queryFn: () => fetchReportDetail(filter),
    enabled,
  })
}
