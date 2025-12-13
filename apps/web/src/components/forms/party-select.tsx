'use client';

/**
 * Party Select Component
 *
 * Searchable dropdown for selecting customers/suppliers with balance preview.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, User, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

// =============================================================================
// TYPES
// =============================================================================

interface Party {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  balance: number;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface PartySelectProps {
  /** Currently selected party ID */
  value: string | null;
  /** Callback when party is selected */
  onChange: (partyId: string | null) => void;
  /** Filter by party type */
  partyType?: 'customer' | 'supplier';
  /** List of available parties */
  parties: Party[];
  /** Loading state */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Optional class name */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PartySelect({
  value,
  onChange,
  partyType,
  parties,
  isLoading = false,
  placeholder = 'Select party...',
  disabled = false,
  error,
  className,
}: PartySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filter parties by type and search query
  const filteredParties = useMemo(() => {
    let result = parties;

    // Filter by type if specified
    if (partyType) {
      result = result.filter((p) => p.type === partyType);
    }

    // Filter by search query
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.email?.toLowerCase().includes(search) ||
          p.phone?.includes(search)
      );
    }

    return result;
  }, [parties, partyType, debouncedSearch]);

  // Find selected party
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === value);
  }, [parties, value]);

  const handleSelect = useCallback(
    (partyId: string) => {
      onChange(partyId === value ? null : partyId);
      setOpen(false);
      setSearchQuery('');
    },
    [onChange, value]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  // Format balance display
  const formatBalance = (balance: number) => {
    const formatted = Math.abs(balance).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (balance > 0) return `Owes: ${formatted}`;
    if (balance < 0) return `Credit: ${formatted}`;
    return 'Balance: 0.00';
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between h-auto min-h-10 py-2',
              !selectedParty && 'text-muted-foreground',
              error && 'border-destructive'
            )}
          >
            {selectedParty ? (
              <div className="flex items-center gap-2 text-left flex-1 min-w-0">
                {selectedParty.type === 'customer' ? (
                  <User className="h-4 w-4 shrink-0" />
                ) : (
                  <Building className="h-4 w-4 shrink-0" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{selectedParty.name}</span>
                  <span
                    className={cn(
                      'text-xs',
                      selectedParty.balance > 0
                        ? 'text-amber-600'
                        : selectedParty.balance < 0
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatBalance(selectedParty.balance)}
                  </span>
                </div>
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <span className="sr-only">Clear</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <span>{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredParties.length === 0 ? (
                <CommandEmpty>No parties found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredParties.map((party) => (
                    <CommandItem
                      key={party.id}
                      value={party.id}
                      onSelect={() => handleSelect(party.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {party.type === 'customer' ? (
                          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{party.name}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs capitalize shrink-0',
                                party.type === 'customer'
                                  ? 'border-blue-500 text-blue-500'
                                  : 'border-purple-500 text-purple-500'
                              )}
                            >
                              {party.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {party.email && <span className="truncate">{party.email}</span>}
                            {party.phone && <span>{party.phone}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              party.balance > 0
                                ? 'text-amber-600'
                                : party.balance < 0
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {formatBalance(party.balance)}
                          </span>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          'ml-2 h-4 w-4 shrink-0',
                          value === party.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default PartySelect;
