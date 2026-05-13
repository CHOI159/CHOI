import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

interface LocationSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  placeholder?: string;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function SearchInner({ onLocationSelect, placeholder = "搜索目的地..." }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Only defined if APIProvider wraps this, but we will conditionally use it
  const placesLib = hasValidKey ? useMapsLibrary('places') : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const searchLocation = async (val: string) => {
    if (val.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      if (hasValidKey && placesLib) {
        // Use Google Maps Places API (New)
        const response = await placesLib.Place.searchByText({
          textQuery: val,
          fields: ['displayName', 'location', 'formattedAddress'],
          maxResultCount: 8,
        });
        
        const mappedResults = (response.places || []).map(p => ({
          lat: p.location?.lat(),
          lng: p.location?.lng(),
          display_name: p.displayName,
          address_details: p.formattedAddress
        }));
        setResults(mappedResults);
        setIsOpen(true);
      } else {
        // Fallback to OSM Nominatim
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&addressdetails=1&email=test@example.com`
        );
        const data = await response.json();
        const mappedResults = data.map((res: any) => ({
          lat: parseFloat(res.lat),
          lng: parseFloat(res.lon),
          display_name: res.display_name,
          address_details: res.address?.city || res.address?.town || '未知地点'
        }));
        setResults(mappedResults);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchLocation(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, placesLib]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={hasValidKey ? placeholder : placeholder + " (配置地图API以获取更多搜索结果)"}
          className="w-full bg-[#1a1a1a] border border-[#333] text-white text-[12px] px-10 py-3 rounded-xl focus:outline-none focus:border-[#f43f5e] transition-all placeholder:text-[#555]"
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] group-focus-within:text-[#f43f5e] transition-colors" />
        {query && (
          <button 
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden shadow-2xl z-[1000] backdrop-blur-xl bg-opacity-95">
          {loading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#f43f5e] animate-spin" />
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto w-full">
              {results.map((res, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const location = {
                      lat: res.lat,
                      lng: res.lng,
                      address: res.display_name
                    };
                    onLocationSelect(location);
                    setQuery(res.display_name);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-3 hover:bg-[#222] border-b border-[#333] last:border-0 transition-colors flex gap-3 items-start"
                >
                  <MapPin className="w-4 h-4 text-[#f43f5e] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white text-[11px] font-bold leading-snug line-clamp-1">{res.display_name}</div>
                    <div className="text-[#666] text-[9px] mt-0.5 uppercase tracking-wider">{res.address_details}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LocationSearch(props: LocationSearchProps) {
  if (hasValidKey) {
    return (
      <APIProvider apiKey={API_KEY} version="weekly">
        <SearchInner {...props} />
      </APIProvider>
    );
  }
  return <SearchInner {...props} />;
}
