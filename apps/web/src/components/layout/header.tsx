'use client';

/**
 * Header Component
 *
 * Main header with user menu, theme toggle, and language switcher.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStore } from '@/stores/theme-store';
import { useDirection } from '@/hooks/use-direction';
import { useOnline } from '@/hooks/use-online';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SyncStatusBadge } from '@/components/pwa/sync-status-badge';
import { cn, getInitials } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { user, currentUser, signOut } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const { isRtl } = useDirection();
  const isOnline = useOnline();
  const router = useRouter();
  const params = useParams();

  const tProfile = useTranslations('settings.profile');
  const tSettings = useTranslations('settings.home');
  const tAuth = useTranslations('auth');

  const currentLocale = params.locale as string;

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const closeMenu = useCallback(() => {
    setIsUserMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on Escape and handle arrow key navigation
  useEffect(() => {
    if (!isUserMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      const items = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[];
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeMenu();
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (currentIndex < items.length - 1) {
            items[currentIndex + 1]?.focus();
          } else {
            items[0]?.focus();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (currentIndex > 0) {
            items[currentIndex - 1]?.focus();
          } else {
            items[items.length - 1]?.focus();
          }
          break;
        case 'Tab':
          closeMenu();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen, closeMenu]);

  const handleRefresh = useCallback(async () => {
    if (!isOnline) return;
    setIsRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
    } catch {
      // best-effort; reload regardless
    } finally {
      window.location.reload();
    }
  }, [isOnline]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // Always navigate to login, even if the server-side sign-out errored.
      router.push(`/${currentLocale}/login`);
    }
  };

  return (
    <header className="h-16 bg-card border-b flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-md hover:bg-muted transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Search (placeholder) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background">
          <SearchIcon className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search"
            className="bg-transparent border-none outline-none text-sm w-48"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Offline / pending-sync indicator */}
        <SyncStatusBadge />

        {/* Refresh / Reload */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || !isOnline}
          className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Refresh"
          title={isOnline ? 'Refresh' : 'Refresh unavailable while offline'}
        >
          <RefreshIcon className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
        </button>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>

        {/* Notifications (placeholder) */}
        <button
          className="p-2 rounded-md hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <BellIcon className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" aria-hidden="true" />
          <span className="sr-only">You have unread notifications</span>
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            ref={menuButtonRef}
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="User menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            aria-controls={isUserMenuOpen ? 'user-menu-dropdown' : undefined}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-medium">
                {currentUser?.full_name ? getInitials(currentUser.full_name) : 'U'}
              </span>
            </div>
            <div className="hidden sm:block text-start">
              <p className="text-sm font-medium leading-none">
                {currentUser?.full_name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentUser?.tenant?.name || 'Organization'}
              </p>
            </div>
            <ChevronDownIcon className="w-4 h-4 text-muted-foreground hidden sm:block" />
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div
              id="user-menu-dropdown"
              role="menu"
              aria-label="User menu"
              className={cn(
                'absolute top-full mt-1 w-56 bg-card border rounded-md shadow-lg py-1 z-50',
                isRtl ? 'left-0' : 'right-0'
              )}
            >
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">{currentUser?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>

              <div className="py-1">
                <button
                  ref={(el) => { menuItemsRef.current[0] = el; }}
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push(`/${currentLocale}/settings/profile`);
                  }}
                  className="w-full px-3 py-2 text-sm text-start hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  {tProfile('title')}
                </button>
                <button
                  ref={(el) => { menuItemsRef.current[1] = el; }}
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push(`/${currentLocale}/settings`);
                  }}
                  className="w-full px-3 py-2 text-sm text-start hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {tSettings('title')}
                </button>
              </div>

              <div className="border-t py-1">
                <button
                  ref={(el) => { menuItemsRef.current[2] = el; }}
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full px-3 py-2 text-sm text-start hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
                >
                  <LogOutIcon className="w-4 h-4" />
                  {tAuth('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Icon components
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
