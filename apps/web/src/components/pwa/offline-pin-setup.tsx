'use client';

/**
 * Offline PIN Setup
 *
 * Lets the user set/replace the PIN that unlocks offline access on this device.
 * Optional — without a PIN, offline access falls back to the cached session.
 * Must be used online (after login), when the offline identity exists.
 */

import { useEffect, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

export function OfflinePinSetup() {
  const { toast } = useToast();
  const [hasExisting, setHasExisting] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    import('@/lib/offline/auth-local')
      .then(({ hasPin }) => hasPin())
      .then(setHasExisting)
      .catch(() => {});
  }, []);

  async function save() {
    if (pin.length < 4) {
      toast({ title: 'PIN too short', description: 'Use at least 4 digits.', variant: 'destructive' });
      return;
    }
    if (pin !== confirm) {
      toast({ title: 'PINs do not match', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { setPin: persist } = await import('@/lib/offline/auth-local');
      await persist(pin);
      setHasExisting(true);
      setPin('');
      setConfirm('');
      toast({ title: 'Offline PIN saved' });
    } catch (e) {
      toast({
        title: 'Could not save PIN',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" /> Offline access PIN
        </CardTitle>
        <CardDescription>
          {hasExisting
            ? 'A PIN is set. Enter a new one to replace it. It unlocks the app when you open it offline.'
            : 'Set a PIN to unlock the app when you open it offline. Optional but recommended on shared devices.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex max-w-sm flex-col gap-3">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="New PIN (min 4 digits)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button onClick={save} disabled={busy || !pin || !confirm} className="w-fit">
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {hasExisting ? 'Replace PIN' : 'Set PIN'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
