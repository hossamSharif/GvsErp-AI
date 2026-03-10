'use client';

/**
 * Employee Form Component
 *
 * Form for creating and editing employees with:
 * - Basic info (name, employee number, hire date)
 * - Department and position
 * - Salary information
 * - Status management
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2 } from 'lucide-react';
import type { Employee } from '@erp/shared';

// =============================================================================
// FORM SCHEMA
// =============================================================================

const employeeFormSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  department: z.string().max(100).nullable().optional().or(z.literal('')),
  position: z.string().max(100).nullable().optional().or(z.literal('')),
  hire_date: z.string().nullable().optional().or(z.literal('')),
  salary: z.string().nullable().optional().or(z.literal('')),
  salary_currency: z.string().default('USD'),
  is_active: z.boolean().default(true),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormSubmitData {
  employee_number: string;
  full_name: string;
  department?: string;
  position?: string;
  hire_date?: string;
  salary?: number;
  salary_currency: string;
  is_active: boolean;
}

// =============================================================================
// PROPS
// =============================================================================

interface EmployeeFormProps {
  /** Existing employee data for editing */
  employee?: Employee;
  /** Submit handler — receives transformed data with salary as number */
  onSubmit: (data: EmployeeFormSubmitData) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Mode: create or edit */
  mode?: 'create' | 'edit';
  /** Available departments */
  departments?: string[];
  /** Available positions */
  positions?: string[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EmployeeForm({
  employee,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
  departments = [],
  positions = [],
}: EmployeeFormProps) {
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employee_number: employee?.employee_number || '',
      full_name: employee?.full_name || '',
      department: employee?.department || '',
      position: employee?.position || '',
      hire_date: employee?.hire_date || '',
      salary: employee?.salary?.toString() || '',
      salary_currency: employee?.salary_currency || 'USD',
      is_active: employee?.is_active ?? true,
    },
  });

  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      form.reset({
        employee_number: employee.employee_number,
        full_name: employee.full_name,
        department: employee.department || '',
        position: employee.position || '',
        hire_date: employee.hire_date || '',
        salary: employee.salary?.toString() || '',
        salary_currency: employee.salary_currency || 'USD',
        is_active: employee.is_active ?? true,
      });
    }
  }, [employee, form]);

  const handleSubmit = async (data: EmployeeFormData) => {
    // Transform data for API
    const transformedData = {
      employee_number: data.employee_number,
      full_name: data.full_name,
      department: data.department || undefined,
      position: data.position || undefined,
      hire_date: data.hire_date || undefined,
      salary: data.salary ? parseFloat(data.salary) : undefined,
      salary_currency: data.salary_currency,
      is_active: data.is_active,
    };

    await onSubmit(transformedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the employee's basic details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employee_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Number *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="EMP-0001"
                        disabled={mode === 'edit'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      {departments.length > 0 ? (
                        <Select
                          value={field.value || ''}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input {...field} value={field.value ?? ''} placeholder="IT Department" />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      {positions.length > 0 ? (
                        <Select
                          value={field.value || ''}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            {positions.map((pos) => (
                              <SelectItem key={pos} value={pos}>
                                {pos}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input {...field} value={field.value ?? ''} placeholder="Software Engineer" />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="hire_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hire Date</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Salary Information */}
        <Card>
          <CardHeader>
            <CardTitle>Salary Information</CardTitle>
            <CardDescription>
              Configure employee compensation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Salary</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="number"
                          step="0.01"
                          placeholder="5000.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="salary_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EGP">EGP</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Manage employee status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      {field.value
                        ? 'Employee is active and can be assigned to work'
                        : 'Employee is inactive and will not appear in active lists'}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? 'Create Employee' : 'Update Employee'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
