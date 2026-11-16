'use client';

/**
 * Local edition license status and key activation.
 * Disabled (no requests) in the cloud.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { isLocalMode } from '@/lib/runtime-config';

export type LicenseState =
  | 'valid'
  | 'trial'
  | 'trial_expired'
  | 'expired'
  | 'invalid'
  | 'wrong_machine'
  | 'clock_tampered';

export interface LicenseStatus {
  state: LicenseState;
  canWrite: boolean;
  maxUsers: number;
  usersUsed: number;
  client: string | null;
  licenseId: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
  machineId: string | null;
  keyMachineId: string | null;
  testKey: boolean;
}

export const LICENSE_QUERY_KEY = ['license', 'status'] as const;

export function useLicenseStatus() {
  return useQuery({
    queryKey: LICENSE_QUERY_KEY,
    queryFn: async () => (await api.get<{ data: LicenseStatus }>('/license/status')).data,
    enabled: isLocalMode(),
    // Always re-check on page load / focus: a cached "trial" must not hide
    // that the trial has ended (the query cache is persisted to IndexedDB).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 60_000,
  });
}

export function useInstallLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      (await api.post<{ data: LicenseStatus }>('/license', { key })).data,
    onSuccess: (status) => queryClient.setQueryData(LICENSE_QUERY_KEY, status),
  });
}
