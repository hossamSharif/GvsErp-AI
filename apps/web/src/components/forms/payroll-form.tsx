'use client';

/**
 * Payroll Run Form Component
 *
 * Form for creating and editing payroll runs with autosave functionality.
 * Includes employee selection, salary calculations, and deductions.
 */

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save, DollarSign, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const payrollItemSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().optional(),
  gross_salary: z.number().min(0, 'Gross salary must be positive'),
  deductions: z.number().min(0, 'Deductions must be positive').default(0),
  currency: z.string().default('USD'),
  days_worked: z.number().min(0).max(31).optional(),
  notes: z.string().optional(),
});

const payrollRunSchema = z.object({
  period_start: z.string().min(1, 'Start date is required'),
  period_end: z.string().min(1, 'End date is required'),
  items: z.array(payrollItemSchema).min(1, 'At least one employee is required'),
  status: z.enum(['draft', 'processing', 'completed']).default('draft'),
});

type PayrollRunFormData = z.infer<typeof payrollRunSchema>;

interface PayrollFormProps {
  initialData?: Partial<PayrollRunFormData>;
  onSubmit: (data: PayrollRunFormData) => Promise<void>;
  isLoading?: boolean;
}

// Mock employees data - replace with actual API hook
const useEmployees = () => {
  return {
    data: [
      {
        id: '1',
        employee_number: 'EMP-0001',
        full_name: 'John Doe',
        salary: 5000,
        salary_currency: 'USD',
      },
      {
        id: '2',
        employee_number: 'EMP-0002',
        full_name: 'Jane Smith',
        salary: 6000,
        salary_currency: 'USD',
      },
    ],
    isLoading: false,
  };
};

export function PayrollForm({ initialData, onSubmit, isLoading = false }: PayrollFormProps) {
  const { toast } = useToast();
  const { data: employees } = useEmployees();
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PayrollRunFormData>({
    resolver: zodResolver(payrollRunSchema),
    defaultValues: initialData || {
      period_start: '',
      period_end: '',
      items: [],
      status: 'draft',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const watchedPeriod = watch(['period_start', 'period_end']);

  // Calculate totals
  const calculateTotals = () => {
    const totalGross = watchedItems?.reduce((sum, item) => sum + (item.gross_salary || 0), 0) || 0;
    const totalDeductions = watchedItems?.reduce((sum, item) => sum + (item.deductions || 0), 0) || 0;
    const totalNet = totalGross - totalDeductions;

    return { totalGross, totalDeductions, totalNet };
  };

  const { totalGross, totalDeductions, totalNet } = calculateTotals();

  // Auto-save functionality
  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchedItems && watchedItems.length > 0) {
        handleAutoSave();
      }
    }, 2000); // Autosave after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [watchedItems, watchedPeriod]);

  const handleAutoSave = async () => {
    setAutoSaveStatus('saving');
    try {
      // TODO: Implement actual autosave API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setAutoSaveStatus('saved');
      setLastSaved(new Date());
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Autosave failed:', error);
      setAutoSaveStatus('idle');
    }
  };

  const handleAddEmployee = () => {
    if (!employees || employees.length === 0) return;

    const employee = employees[0];
    append({
      employee_id: '',
      employee_name: '',
      gross_salary: 0,
      deductions: 0,
      currency: 'USD',
      days_worked: undefined,
      notes: '',
    });
  };

  const handleEmployeeSelect = (index: number, employeeId: string) => {
    const employee = employees?.find((e) => e.id === employeeId);
    if (employee) {
      setValue(`items.${index}.employee_id`, employee.id);
      setValue(`items.${index}.employee_name`, employee.full_name);
      setValue(`items.${index}.gross_salary`, employee.salary || 0);
      setValue(`items.${index}.currency`, employee.salary_currency || 'USD');
    }
  };

  const handleFormSubmit = async (data: PayrollRunFormData) => {
    try {
      await onSubmit(data);
      toast({
        title: 'Success',
        description: 'Payroll run saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save payroll run',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Autosave Status */}
      <div className="flex justify-between items-center">
        <div>
          {autoSaveStatus === 'saving' && (
            <Badge variant="secondary">Saving...</Badge>
          )}
          {autoSaveStatus === 'saved' && (
            <Badge variant="default">Saved</Badge>
          )}
          {lastSaved && (
            <span className="text-sm text-muted-foreground ml-2">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Period</CardTitle>
          <CardDescription>Select the pay period for this payroll run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period Start</Label>
              <Input
                id="period_start"
                type="date"
                {...register('period_start')}
              />
              {errors.period_start && (
                <p className="text-sm text-destructive">{errors.period_start.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period End</Label>
              <Input
                id="period_end"
                type="date"
                {...register('period_end')}
              />
              {errors.period_end && (
                <p className="text-sm text-destructive">{errors.period_end.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Payroll Items */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Payroll Items</CardTitle>
              <CardDescription>
                Add employees and configure their salary details
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEmployee}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employees added. Click "Add Employee" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Days Worked</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const grossSalary = watchedItems?.[index]?.gross_salary || 0;
                  const deductions = watchedItems?.[index]?.deductions || 0;
                  const netSalary = grossSalary - deductions;

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="min-w-[200px]">
                        <Select
                          value={watchedItems?.[index]?.employee_id || ''}
                          onValueChange={(value) => handleEmployeeSelect(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees?.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.full_name} ({emp.employee_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="22"
                          className="w-20"
                          {...register(`items.${index}.days_worked` as const, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="w-32"
                          {...register(`items.${index}.gross_salary` as const, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="w-32"
                          {...register(`items.${index}.deductions` as const, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">
                          {watchedItems?.[index]?.currency || 'USD'} {netSalary.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Notes..."
                          className="w-40"
                          {...register(`items.${index}.notes` as const)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {errors.items && (
            <p className="text-sm text-destructive mt-2">{errors.items.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Totals Summary */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Payroll Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Gross</p>
                <p className="text-2xl font-bold">USD {totalGross.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Deductions</p>
                <p className="text-2xl font-bold text-destructive">
                  USD {totalDeductions.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Net</p>
                <p className="text-2xl font-bold text-green-600">
                  USD {totalNet.toFixed(2)}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {fields.length} employee{fields.length !== 1 ? 's' : ''} included
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save Payroll Run'}
        </Button>
      </div>
    </form>
  );
}
