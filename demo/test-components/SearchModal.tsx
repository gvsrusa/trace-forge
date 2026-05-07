// Demo Component 2: SearchModal — Medium (second demo)
// Known issues: missing focus trap, no aria-live, sync filter in render, missing useCallback, no error boundary

import React, { useState, useEffect, useRef } from 'react';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

function SearchModal({ isOpen, onClose, onSelect }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // No focus trap — keyboard users can tab out of the modal
  // No error boundary around the API call

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    setLoading(true);
    // Missing useCallback on this debounced handler
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${query}`);
        const data = await response.json();
        setAllResults(data.results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Synchronous filter in render — should be useMemo
  const filteredResults = allResults.filter(
    (r) =>
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.description.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    // Missing role="dialog" and aria-modal="true"
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', width: '560px', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2>Search</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{ width: '100%', padding: '8px', fontSize: '16px' }}
        />

        {/* No aria-live region — screen readers won't announce result updates */}
        <div style={{ marginTop: '16px', overflowY: 'auto', maxHeight: '400px' }}>
          {loading && <p>Loading...</p>}

          {!loading && filteredResults.length === 0 && query && (
            <p>No results for "{query}"</p>
          )}

          {filteredResults.map((result) => (
            <div
              key={result.id}
              onClick={() => onSelect(result)}
              style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
              <strong>{result.title}</strong>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>{result.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
