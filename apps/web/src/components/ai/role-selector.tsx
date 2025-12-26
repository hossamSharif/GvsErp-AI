'use client';

/**
 * Role Selector Component
 * Allows users to select AI consultant role
 */

import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  TrendingUp,
  Scale,
  HeadphonesIcon,
  Calculator
} from 'lucide-react';
import type { ConsultantRole } from '@erp-saas/shared';

const ROLES: Array<{
  value: ConsultantRole;
  icon: typeof Briefcase;
  color: string;
}> = [
  { value: 'general', icon: Briefcase, color: 'text-gray-600' },
  { value: 'marketing', icon: TrendingUp, color: 'text-blue-600' },
  { value: 'legal', icon: Scale, color: 'text-purple-600' },
  { value: 'customer_service', icon: HeadphonesIcon, color: 'text-green-600' },
  { value: 'financial_analyst', icon: Calculator, color: 'text-amber-600' },
];

interface RoleSelectorProps {
  value: ConsultantRole;
  onChange: (role: ConsultantRole) => void;
  disabled?: boolean;
}

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  const t = useTranslations('ai.roles');

  const currentRole = ROLES.find((r) => r.value === value);
  const Icon = currentRole?.icon || Briefcase;

  return (
    <div className="p-3 border-b">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t('label')}
        </label>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${currentRole?.color}`} />
                <span>{t(value)}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => {
              const RoleIcon = role.icon;
              return (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex items-center gap-2">
                    <RoleIcon className={`h-4 w-4 ${role.color}`} />
                    <div>
                      <div className="font-medium">{t(role.value)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(`${role.value}_desc`)}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Role Description */}
        <p className="text-xs text-muted-foreground">
          {t(`${value}_help`)}
        </p>
      </div>
    </div>
  );
}
