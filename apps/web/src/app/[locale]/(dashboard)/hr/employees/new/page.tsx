'use client';

/**
 * New Employee Page
 *
 * Page for creating a new employee record.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployeeForm } from '@/components/forms/employee-form';
import Link from 'next/link';

// Mock API call - replace with actual API hook
const useCreateEmployee = () => {
  const [isLoading, setIsLoading] = useState(false);

  const createEmployee = async (data: any) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Creating employee:', data);
      return { success: true, data };
    } finally {
      setIsLoading(false);
    }
  };

  return { createEmployee, isLoading };
};

// Mock employee number generation
const useGenerateEmployeeNumber = () => {
  return {
    data: { employee_number: `EMP-${String(Date.now()).slice(-4)}` },
    isLoading: false,
  };
};

export default function NewEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { createEmployee, isLoading } = useCreateEmployee();
  const { data: employeeNumber } = useGenerateEmployeeNumber();

  const handleSubmit = async (data: any) => {
    const result = await createEmployee(data);
    if (result.success) {
      router.push(`/${locale}/hr/employees`);
    }
  };

  const handleCancel = () => {
    router.push(`/${locale}/hr/employees`);
  };

  // Pre-populate with generated employee number
  const initialData = {
    employee_number: employeeNumber?.employee_number || '',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hr/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Employee</h1>
          <p className="text-muted-foreground">
            Add a new employee to your organization
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <EmployeeForm
          employee={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          mode="create"
          departments={['IT', 'HR', 'Sales', 'Finance', 'Operations']}
          positions={['Software Engineer', 'Manager', 'Analyst', 'Developer', 'Designer']}
        />
      </div>
    </div>
  );
}
