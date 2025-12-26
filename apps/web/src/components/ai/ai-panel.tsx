'use client';

/**
 * AI Panel Component
 * Main container for AI assistant with conversation management
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  MessageSquare,
  Archive,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useAIPanelStore } from '@/stores/ai-panel-store';
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
} from '@/hooks/use-ai-conversation';
import { UsageIndicator } from './usage-indicator';
import { RoleSelector } from './role-selector';
import { ChatInterface } from './chat-interface';
import { cn } from '@/lib/utils';

export function AIPanel() {
  const t = useTranslations('ai.panel');
  const {
    isOpen,
    isExpanded,
    currentConversationId,
    consultantRole,
    closePanel,
    toggleExpand,
    setCurrentConversation,
    setConsultantRole,
  } = useAIPanelStore();

  const { data: conversationsData } = useConversations({ status: 'active', limit: 10 });
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const conversations = conversationsData?.data || [];

  // Auto-create conversation on first open if none exists
  useEffect(() => {
    if (isOpen && !currentConversationId && conversations.length === 0 && !createConversation.isPending) {
      handleNewConversation();
    }
  }, [isOpen, currentConversationId, conversations.length]);

  // Select first conversation if none selected
  useEffect(() => {
    if (isOpen && !currentConversationId && conversations.length > 0) {
      setCurrentConversation(conversations[0].id);
      setConsultantRole(conversations[0].consultantRole);
    }
  }, [isOpen, currentConversationId, conversations]);

  const handleNewConversation = async () => {
    const result = await createConversation.mutateAsync({
      title: t('newConversation'),
      consultantRole,
    });
    setCurrentConversation(result.id);
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation.mutateAsync(id);
    if (currentConversationId === id) {
      setCurrentConversation(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 bg-background border rounded-lg shadow-2xl flex flex-col z-50 transition-all duration-200',
        isExpanded
          ? 'w-[800px] h-[600px]'
          : 'w-[400px] h-[600px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('title')}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpand}
            className="h-8 w-8"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Usage Indicator */}
      <UsageIndicator />

      {/* Role Selector */}
      <RoleSelector
        value={consultantRole}
        onChange={(role) => {
          setConsultantRole(role);
          // Update current conversation role if exists
          if (currentConversationId) {
            // This would need an update mutation
          }
        }}
        disabled={false}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations Sidebar (only in expanded mode) */}
        {isExpanded && (
          <>
            <div className="w-64 border-r flex flex-col">
              <div className="p-3 border-b">
                <Button
                  onClick={handleNewConversation}
                  disabled={createConversation.isPending}
                  className="w-full"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('new')}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversation(conv.id);
                        setConsultantRole(conv.consultantRole);
                      }}
                      className={cn(
                        'w-full text-left p-3 rounded-lg hover:bg-muted transition-colors group',
                        currentConversationId === conv.id && 'bg-muted'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium truncate">
                              {conv.title}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {conv.messageCount || 0} {t('messages')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </button>
                  ))}

                  {conversations.length === 0 && !createConversation.isPending && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t('noConversations')}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <Separator orientation="vertical" />
          </>
        )}

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
          {currentConversationId ? (
            <ChatInterface conversationId={currentConversationId} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold mb-2">{t('welcome')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('getStarted')}
                  </p>
                  <Button onClick={handleNewConversation} disabled={createConversation.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('startConversation')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
