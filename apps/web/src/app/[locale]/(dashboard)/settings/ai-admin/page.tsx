'use client';

/**
 * AI Admin Dashboard Page
 * Admin view for monitoring AI usage across all tenants
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIUsageDashboard } from '@/components/admin/ai-usage-dashboard';
import { Bot, Settings, TrendingUp } from 'lucide-react';

export default function AIAdminPage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('usage');

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-8 w-8" />
          AI Administration
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage AI usage across all tenants
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Usage Statistics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Usage Statistics Tab */}
        <TabsContent value="usage" className="space-y-4">
          <AIUsageDashboard />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>
                Manage global and tenant-specific AI settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configuration management coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
