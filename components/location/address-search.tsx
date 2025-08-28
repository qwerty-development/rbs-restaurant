// components/location/address-search.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Loader2, 
  MapPin, 
  Navigation, 
  X,
  Check
} from 'lucide-react';
import { useLocationRequest } from '@/lib/hooks/useGeolocation';
import { geocodingService, type GeocodingResult } from '@/lib/services/geocoding';
import { formatCoordinates, type Coordinates } from '@/lib/utils/location';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export interface AddressSearchProps {
  value?: string;
  onChange: (address: string, coordinates?: Coordinates) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCurrentLocation?: boolean;
  maxResults?: number;
  userLocation?: Coordinates;
}

interface AddressSearchState {
  query: string;
  results: GeocodingResult[];
  isSearching: boolean;
  showDropdown: boolean;
  selectedIndex: number;
}

export function AddressSearch({
  value = '',
  onChange,
  placeholder = 'Search for an address...',
  className = '',
  disabled = false,
  showCurrentLocation = true,
  maxResults = 8,
  userLocation
}: AddressSearchProps) {
  const [state, setState] = useState<AddressSearchState>({
    query: value,
    results: [],
    isSearching: false,
    showDropdown: false,
    selectedIndex: -1
  });

  const { requestLocation, loading: locationLoading } = useLocationRequest();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search for addresses
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setState(prev => ({ 
        ...prev, 
        results: [], 
        showDropdown: false,
        selectedIndex: -1 
      }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true }));
    
    try {
      const results = await geocodingService.getAddressSuggestions(
        query,
        userLocation,
        maxResults
      );
      
      setState(prev => ({ 
        ...prev, 
        results,
        isSearching: false,
        showDropdown: results.length > 0,
        selectedIndex: -1
      }));
    } catch (error) {
      console.error('Address search failed:', error);
      setState(prev => ({ 
        ...prev, 
        results: [],
        isSearching: false,
        showDropdown: false,
        selectedIndex: -1
      }));
      toast.error('Address search failed');
    }
  }, [userLocation, maxResults]);

  // Handle input changes
  const handleInputChange = useCallback((inputValue: string) => {
    setState(prev => ({ ...prev, query: inputValue }));
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(inputValue);
    }, 300);
  }, [searchAddresses]);

  // Handle result selection
  const handleResultSelect = useCallback((result: GeocodingResult) => {
    setState(prev => ({ 
      ...prev, 
      query: result.address,
      showDropdown: false,
      selectedIndex: -1
    }));
    
    onChange(result.address, result.coordinates);
    inputRef.current?.blur();
  }, [onChange]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const { coordinates } = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      setState(prev => ({ ...prev, isSearching: true }));
      
      const result = await geocodingService.reverseGeocode(coordinates);
      const address = result?.address || `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
      
      setState(prev => ({ 
        ...prev, 
        query: address,
        isSearching: false,
        showDropdown: false
      }));
      
      onChange(address, coordinates);
      toast.success('Current location detected');
      
    } catch (error) {
      console.error('Failed to get current location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to get current location: ${errorMessage}`);
      setState(prev => ({ ...prev, isSearching: false }));
    }
  }, [requestLocation, onChange]);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      query: '',
      results: [],
      showDropdown: false,
      selectedIndex: -1
    }));
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!state.showDropdown || state.results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1)
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, -1)
        }));
        break;
      case 'Enter':
        e.preventDefault();
        if (state.selectedIndex >= 0 && state.selectedIndex < state.results.length) {
          handleResultSelect(state.results[state.selectedIndex]);
        }
        break;
      case 'Escape':
        setState(prev => ({ 
          ...prev, 
          showDropdown: false,
          selectedIndex: -1 
        }));
        inputRef.current?.blur();
        break;
    }
  }, [state.showDropdown, state.results, state.selectedIndex, handleResultSelect]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setState(prev => ({ 
          ...prev, 
          showDropdown: false,
          selectedIndex: -1 
        }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update query when value prop changes
  useEffect(() => {
    if (value !== state.query) {
      setState(prev => ({ ...prev, query: value }));
    }
  }, [value, state.query]);

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={state.query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (state.results.length > 0) {
                setState(prev => ({ ...prev, showDropdown: true }));
              }
            }}
            disabled={disabled}
            className="pl-10 pr-10"
          />
          
          {/* Loading indicator */}
          {state.isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
          
          {/* Clear button */}
          {state.query && !state.isSearching && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              disabled={disabled}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Current location button */}
        {showCurrentLocation && (
          <Button
            variant="outline"
            onClick={getCurrentLocation}
            disabled={disabled || locationLoading}
            className="flex items-center gap-2"
          >
            {locationLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Current
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {state.showDropdown && state.results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {state.results.map((result, index) => (
            <button
              key={`${result.coordinates.lat}-${result.coordinates.lng}-${index}`}
              onClick={() => handleResultSelect(result)}
              disabled={disabled}
              className={cn(
                'w-full text-left p-3 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 disabled:opacity-50 transition-colors',
                index === state.selectedIndex && 'bg-accent text-accent-foreground'
              )}
            >
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{result.displayName}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCoordinates(result.coordinates)}
                  </div>
                  {result.type && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {result.type}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {state.showDropdown && state.results.length === 0 && state.query.length >= 3 && !state.isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 p-3">
          <div className="text-sm text-muted-foreground text-center">
            No addresses found for "{state.query}"
          </div>
        </div>
      )}
    </div>
  );
}
