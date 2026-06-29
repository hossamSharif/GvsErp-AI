'use client';

/**
 * Offline Unlock
 *
 * Shown when the app opens offline and an offline PIN is set. Verifies the PIN
 * locally (PBKDF2) and unlocks access to the cached data without needing the
 * network. Decoupled from the Supabase token, which can't refresh offline.
 */

import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { verifyPin } from '@/lib/offline/auth-local';

export function OfflineUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verifyPin(pin);
      if (res.ok) {
        onUnlocked();
        return;
      }
      if (res.lockedUntil) {
        setError('Too many attempts. Try again in a few minutes.');
      } else if (res.remainingAttempts != null) {
        setError(`Incorrect PIN — ${res.remainingAttempts} attempt(s) left.`);
      } else {
        setError('Incorrect PIN.');
      }
    } finally {
      setBusy(false);
      setPin('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Unlock offline access</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re offline. Enter your PIN to use the app with your saved data.
          </p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-center text-lg tracking-widest"
          placeholder="••••"
          aria-label="Offline PIN"
        />

        {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy || !pin}
          className="mt-4 w-full rounded-md bg-primary py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
