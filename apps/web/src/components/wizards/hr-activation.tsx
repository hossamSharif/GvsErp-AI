'use client';

/**
 * HR Module Activation Wizard
 *
 * Multi-step wizard to activate the HR module and configure default settings.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle, Users, Calendar, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HRActivationWizardProps {
  open: boolean;
  onClose: () => void;
}

export function HRActivationWizard({ open, onClose }: HRActivationWizardProps) {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isActivating, setIsActivating] = useState(false);

  // Configuration options
  const [enableAttendance, setEnableAttendance] = useState(true);
  const [enablePayroll, setEnablePayroll] = useState(true);
  const [enableLeaveManagement, setEnableLeaveManagement] = useState(true);
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState('8');
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState('5');

  const handleActivate = async () => {
    setIsActivating(true);

    try {
      // In a real implementation, this would call an API endpoint
      // to activate the HR module in tenant settings

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: 'Success',
        description: 'HR module activated successfully',
      });

      setStep(3); // Success step
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate HR module',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handleClose = () => {
    if (step === 3) {
      router.push(`/${locale}/hr/employees`);
    }
    onClose();
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activate HR Module</DialogTitle>
          <DialogDescription>
            Set up human resources management for your business
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Welcome to HR Module</CardTitle>
                <CardDescription>
                  Enable professional HR features including:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 list-disc list-inside">
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Employee management and records</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Attendance and leave tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Payroll processing with auto-posting to accounting</span>
                  </li>
                  <li>Performance and employee reports</li>
                  <li>Department and position management</li>
                </ul>
              </CardContent>
            </Card>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Once activated, the HR module will appear in your navigation menu
                and you can start adding employees and managing your workforce.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configure HR Settings</CardTitle>
                <CardDescription>
                  Customize the HR module for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Features to Enable</h4>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attendance"
                      checked={enableAttendance}
                      onCheckedChange={(checked) => setEnableAttendance(checked as boolean)}
                    />
                    <Label htmlFor="attendance" className="cursor-pointer">
                      Attendance Tracking (check-in/check-out)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="leave"
                      checked={enableLeaveManagement}
                      onCheckedChange={(checked) => setEnableLeaveManagement(checked as boolean)}
                    />
                    <Label htmlFor="leave" className="cursor-pointer">
                      Leave Management
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="payroll"
                      checked={enablePayroll}
                      onCheckedChange={(checked) => setEnablePayroll(checked as boolean)}
                    />
                    <Label htmlFor="payroll" className="cursor-pointer">
                      Payroll Processing
                    </Label>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium">Working Hours Configuration</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hoursPerDay">Hours per Day</Label>
                      <Input
                        id="hoursPerDay"
                        type="number"
                        min="1"
                        max="24"
                        value={workingHoursPerDay}
                        onChange={(e) => setWorkingHoursPerDay(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="daysPerWeek">Working Days per Week</Label>
                      <Input
                        id="daysPerWeek"
                        type="number"
                        min="1"
                        max="7"
                        value={workingDaysPerWeek}
                        onChange={(e) => setWorkingDaysPerWeek(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleActivate} disabled={isActivating}>
                {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate HR Module
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h3 className="text-xl font-semibold">HR Module Activated!</h3>
              <p className="text-center text-muted-foreground max-w-md">
                Your HR module has been successfully activated. You can now start managing
                employees, tracking attendance, and processing payroll.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Add your first employee</li>
                  <li>Set up departments and positions</li>
                  <li>Configure attendance settings</li>
                  <li>Start tracking employee attendance</li>
                  <li>Process your first payroll</li>
                </ol>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button onClick={handleClose}>
                Go to Employees
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
