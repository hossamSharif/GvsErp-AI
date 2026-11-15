'use client';

/**
 * Admin dialog to set a staff member's password directly.
 * Local edition only (no email server for reset links).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useSetUserPassword } from '@/hooks/use-users';

interface SetUserPasswordDialogProps {
  user: { id: string; full_name?: string | null; email: string } | null;
  onOpenChange: (open: boolean) => void;
}

const MIN_LENGTH = 8;

export function SetUserPasswordDialog({ user, onOpenChange }: SetUserPasswordDialogProps) {
  const t = useTranslations('local');
  const tAuth = useTranslations('auth');
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const close = () => {
    setPassword('');
    setConfirm('');
    setError('');
    onOpenChange(false);
  };

  const mutation = useSetUserPassword({
    onSuccess: () => {
      toast({ title: t('passwordSet') });
      close();
    },
    onError: (err) => setError(err.message || t('passwordSetFailed')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) return setError(tAuth('passwordTooShort'));
    if (password !== confirm) return setError(tAuth('passwordsMismatch'));
    setError('');
    if (user) mutation.mutate({ id: user.id, password });
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('setPasswordTitle')}</DialogTitle>
            <DialogDescription>
              {t('setPasswordDescription', { name: user?.full_name || user?.email || '' })}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-user-password">{tAuth('newPassword')}</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-user-password">{tAuth('confirmNewPassword')}</Label>
            <Input
              id="confirm-user-password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('setPasswordSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
