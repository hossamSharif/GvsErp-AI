'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Loader2, Save, KeyRound } from 'lucide-react';

import { useAuth } from '@/providers/auth-provider';
import { useUpdateUser, useChangeOwnPassword } from '@/hooks/use-users';
import { useDirection } from '@/hooks/use-direction';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

function createInfoSchema(messages: { required: string; tooLong: string }) {
  return z.object({
    full_name: z
      .string()
      .trim()
      .min(1, messages.required)
      .max(255, messages.tooLong),
  });
}

function createPasswordSchema(messages: {
  tooShort: string;
  tooLong: string;
  needsUpper: string;
  needsLower: string;
  needsNumber: string;
  mismatch: string;
  sameAsCurrent: string;
}) {
  return z
    .object({
      current_password: z.string().min(1),
      new_password: z
        .string()
        .min(8, messages.tooShort)
        .max(72, messages.tooLong)
        .regex(/[A-Z]/, messages.needsUpper)
        .regex(/[a-z]/, messages.needsLower)
        .regex(/[0-9]/, messages.needsNumber),
      confirm_password: z.string(),
    })
    .refine((d) => d.new_password === d.confirm_password, {
      message: messages.mismatch,
      path: ['confirm_password'],
    })
    .refine((d) => d.new_password !== d.current_password, {
      message: messages.sameAsCurrent,
      path: ['new_password'],
    });
}

type InfoFormData = z.infer<ReturnType<typeof createInfoSchema>>;
type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { isRtl } = useDirection();
  const { currentUser, refreshSession, signIn } = useAuth();

  const t = useTranslations('settings.profile');
  const tValidation = useTranslations('settings.profile.validation');
  const tErrors = useTranslations('settings.profile.errors');

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  // ------------------------------------------------------------------
  // Personal info form
  // ------------------------------------------------------------------
  const infoSchema = createInfoSchema({
    required: tValidation('fullNameRequired'),
    tooLong: tValidation('fullNameTooLong'),
  });

  const infoForm = useForm<InfoFormData>({
    resolver: zodResolver(infoSchema),
    values: {
      full_name: currentUser?.full_name ?? '',
    },
  });

  const updateUser = useUpdateUser({
    onSuccess: async () => {
      toast({
        title: t('info.savedTitle'),
        description: t('info.savedDescription'),
      });
      await refreshSession();
    },
    onError: (error) => {
      toast({
        title: tErrors('generic'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmitInfo = useCallback(
    (data: InfoFormData) => {
      if (!currentUser?.id) return;
      updateUser.mutate({
        id: currentUser.id,
        input: { full_name: data.full_name.trim() },
      });
    },
    [currentUser?.id, updateUser]
  );

  // ------------------------------------------------------------------
  // Password form
  // ------------------------------------------------------------------
  const passwordSchema = createPasswordSchema({
    tooShort: tValidation('passwordTooShort'),
    tooLong: tValidation('passwordTooLong'),
    needsUpper: tValidation('passwordNeedsUppercase'),
    needsLower: tValidation('passwordNeedsLowercase'),
    needsNumber: tValidation('passwordNeedsNumber'),
    mismatch: tValidation('passwordsMismatch'),
    sameAsCurrent: tValidation('sameAsCurrent'),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const changePassword = useChangeOwnPassword({
    onSuccess: async (_data, variables) => {
      // Changing the password revokes the current session's refresh token
      // server-side. Without re-establishing a session the next token refresh
      // fails, the user appears logged out (avatar shows "User"), and sign-out
      // errors. Silently re-authenticate with the new password to mint fresh,
      // valid tokens and keep the user signed in.
      try {
        if (currentUser?.email) {
          await signIn(currentUser.email, variables.new_password);
        }
      } catch {
        // Re-auth failed for some reason — send them to login to get a clean
        // session rather than leaving them with a broken one.
        router.push(`/${locale}/login`);
        return;
      }
      toast({
        title: t('password.updatedTitle'),
        description: t('password.updatedDescription'),
      });
      passwordForm.reset({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    },
    onError: (error) => {
      const msg = error.message || '';
      const isInvalidCurrent =
        msg.toLowerCase().includes('current password') ||
        msg.includes('INVALID_CURRENT_PASSWORD');
      toast({
        title: tErrors('generic'),
        description: isInvalidCurrent ? tErrors('currentIncorrect') : msg,
        variant: 'destructive',
      });
      if (isInvalidCurrent) {
        passwordForm.setError('current_password', {
          type: 'server',
          message: tErrors('currentIncorrect'),
        });
      }
    },
  });

  const onSubmitPassword = useCallback(
    (data: PasswordFormData) => {
      changePassword.mutate(data);
    },
    [changePassword]
  );

  if (!currentUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backAriaLabel')}
          onClick={() => router.push(`/${locale}/settings`)}
        >
          <BackIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Personal information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('info.title')}</CardTitle>
          <CardDescription>{t('info.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...infoForm}>
            <form
              onSubmit={infoForm.handleSubmit(onSubmitInfo)}
              className="space-y-4"
            >
              <FormField
                control={infoForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('info.fullName')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('info.fullNamePlaceholder')}
                        maxLength={255}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>{t('info.email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    value={currentUser.email}
                    disabled
                    readOnly
                  />
                </FormControl>
                <FormDescription>{t('info.emailHelp')}</FormDescription>
              </FormItem>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={updateUser.isPending}>
                  {updateUser.isPending ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t('info.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="me-2 h-4 w-4" />
                      {t('info.save')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>{t('password.title')}</CardTitle>
          <CardDescription>{t('password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.current')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.new')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t('password.requirements')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.confirm')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t('password.updating')}
                    </>
                  ) : (
                    <>
                      <KeyRound className="me-2 h-4 w-4" />
                      {t('password.update')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
