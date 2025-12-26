'use client';

/**
 * AI Report Display Component
 * Displays generated reports with export capabilities
 */

import React from 'react';
import { Download, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ReportData {
  type: 'sales' | 'inventory' | 'financial' | 'customer' | 'general';
  formattedReport: string;
  rawData?: any;
  generatedAt: string;
}

export interface ReportDisplayProps {
  report: ReportData;
  onExportPDF?: () => void;
  onExportCSV?: () => void;
}

export const ReportDisplay: React.FC<ReportDisplayProps> = ({
  report,
  onExportPDF,
  onExportCSV,
}) => {
  const t = useTranslations('ai.reports');

  /**
   * Export report as CSV
   */
  const handleExportCSV = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }

    // Default CSV export from markdown tables
    try {
      const csvContent = convertMarkdownToCSV(report.formattedReport);
      downloadFile(csvContent, `report-${Date.now()}.csv`, 'text/csv');
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  /**
   * Export report as PDF
   */
  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
      return;
    }

    // For now, open print dialog which can save as PDF
    window.print();
  };

  /**
   * Export report as text
   */
  const handleExportText = () => {
    const textContent = report.formattedReport;
    downloadFile(textContent, `report-${Date.now()}.txt`, 'text/plain');
  };

  return (
    <Card className="w-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {getReportTitle(report.type)}
            </h3>
            <p className="text-sm text-muted-foreground">
              Generated: {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportText}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Text
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Table2 className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="formatted" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b px-6">
          <TabsTrigger value="formatted">Formatted View</TabsTrigger>
          {report.rawData && <TabsTrigger value="data">Raw Data</TabsTrigger>}
        </TabsList>

        <TabsContent value="formatted" className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report.formattedReport}
            </ReactMarkdown>
          </div>
        </TabsContent>

        {report.rawData && (
          <TabsContent value="data" className="p-6">
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(report.rawData, null, 2)}
            </pre>
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
};

/**
 * Get report title based on type
 */
function getReportTitle(type: ReportData['type']): string {
  const titles = {
    sales: 'Sales Report',
    inventory: 'Inventory Report',
    financial: 'Financial Report',
    customer: 'Customer Report',
    general: 'Business Report',
  };
  return titles[type] || 'Report';
}

/**
 * Convert markdown content to CSV
 * Extracts tables from markdown and converts to CSV format
 */
function convertMarkdownToCSV(markdown: string): string {
  const lines = markdown.split('\n');
  const csvRows: string[] = [];

  let inTable = false;
  let isHeaderSeparator = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this is a markdown table row
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip the header separator row (e.g., |---|---|)
      if (line.includes('---')) {
        isHeaderSeparator = true;
        continue;
      }

      // Parse table row
      const cells = line
        .split('|')
        .slice(1, -1) // Remove first and last empty cells
        .map((cell) => cell.trim())
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma
          if (cell.includes(',') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        });

      csvRows.push(cells.join(','));
      inTable = true;
    } else if (inTable) {
      // Add empty line between tables
      if (csvRows.length > 0) {
        csvRows.push('');
      }
      inTable = false;
    }
  }

  return csvRows.join('\n');
}

/**
 * Download file helper
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
