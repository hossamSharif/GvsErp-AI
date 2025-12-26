'use client';

/**
 * AI Usage Dashboard Component
 * Displays aggregate usage statistics and charts
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminUsage } from '@/hooks/use-ai-admin';
import { MessageSquare, FileText, CheckSquare, Users, Building2, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function AIUsageDashboard() {
  const t = useTranslations();

  // Default to last 30 days
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateRange, setDateRange] = useState({ startDate, endDate });

  const { data: usage, isLoading, error } = useAdminUsage(
    dateRange.startDate,
    dateRange.endDate
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Usage Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load usage statistics. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Questions',
      value: usage.totalQuestions.toLocaleString(),
      icon: MessageSquare,
      color: 'text-blue-600',
    },
    {
      title: 'Documents Processed',
      value: usage.totalDocuments.toLocaleString(),
      icon: FileText,
      color: 'text-green-600',
    },
    {
      title: 'Tasks Generated',
      value: usage.totalTasks.toLocaleString(),
      icon: CheckSquare,
      color: 'text-purple-600',
    },
    {
      title: 'Total Conversations',
      value: usage.totalConversations.toLocaleString(),
      icon: TrendingUp,
      color: 'text-amber-600',
    },
    {
      title: 'Active Users',
      value: usage.uniqueUsers.toLocaleString(),
      icon: Users,
      color: 'text-cyan-600',
    },
    {
      title: 'Active Tenants',
      value: usage.uniqueTenants.toLocaleString(),
      icon: Building2,
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>
            Showing data from {dateRange.startDate} to {dateRange.endDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date().toISOString().split('T')[0];
                const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0];
                setDateRange({ startDate: start, endDate: end });
              }}
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date().toISOString().split('T')[0];
                const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0];
                setDateRange({ startDate: start, endDate: end });
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date().toISOString().split('T')[0];
                const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0];
                setDateRange({ startDate: start, endDate: end });
              }}
            >
              Last 90 Days
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Averages */}
      <Card>
        <CardHeader>
          <CardTitle>Average Usage Per User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Questions per User</span>
            <span className="font-medium">{usage.averageQuestionsPerUser.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Documents per User</span>
            <span className="font-medium">{usage.averageDocumentsPerUser.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Users */}
      {usage.topUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Users by Activity</CardTitle>
            <CardDescription>Users with the most questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usage.topUsers.slice(0, 5).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{user.userName}</p>
                      <p className="text-xs text-muted-foreground">Tenant: {user.tenantId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{user.questionCount} questions</p>
                    <p className="text-xs text-muted-foreground">
                      {user.documentCount} docs, {user.taskCount} tasks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Tenants */}
      {usage.topTenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Tenants by Activity</CardTitle>
            <CardDescription>Tenants with the most AI usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usage.topTenants.slice(0, 5).map((tenant, index) => (
                <div key={tenant.tenantId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tenant.tenantName}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.userCount} users
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{tenant.questionCount} questions</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.documentCount} docs, {tenant.taskCount} tasks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
