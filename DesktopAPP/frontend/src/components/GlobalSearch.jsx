import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import _ from 'lodash';
import api from '../api/axios';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback(
    _.debounce(async (q) => {
      if (q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/search', { params: { q } });
        setResults(data.results || []);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (val.trim().length >= 2) {
      setLoading(true);
      runSearch(val);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  const handleSelect = (link) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="global-search-wrap">
      <div className="global-search-box">
        <span className="global-search-icon">🔍</span>
        <input
          type="text"
          className="global-search-input"
          placeholder="Search customers, products, invoices, IMEI..."
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {loading && <span className="spinner-border spinner-border-sm global-search-spinner" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="global-search-dropdown">
          {loading ? (
            <div className="global-search-empty">Searching...</div>
          ) : results.length === 0 ? (
            <div className="global-search-empty">No results found for "{query}"</div>
          ) : (
            results.map((r, idx) => (
              <button
                key={`${r.type}-${r.title}-${idx}`}
                className="global-search-item"
                onClick={() => handleSelect(r.link)}
              >
                <span className="global-search-item-icon">{r.icon}</span>
                <div className="global-search-item-body">
                  <div className="global-search-item-title">{r.title}</div>
                  <div className="global-search-item-subtitle">{r.subtitle}</div>
                </div>
                <span className="global-search-item-type">{r.type}</span>
              </button>
            ))
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .global-search-wrap { position: relative; flex: 1; max-width: 480px; margin: 0 16px; }
        .global-search-box { display: flex; align-items: center; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; gap: 8px; }
        .global-search-box:focus-within { border-color: #94a3b8; background: #fff; }
        .global-search-icon { font-size: 0.85rem; opacity: 0.6; }
        .global-search-input { flex: 1; background: transparent; border: none; outline: none; color: #1e293b; font-size: 0.82rem; }
        .global-search-input::placeholder { color: #94a3b8; }
        .global-search-spinner { width: 0.85rem; height: 0.85rem; opacity: 0.5; color: #64748b; }
        .global-search-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: #fff; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          max-height: 420px; overflow-y: auto; z-index: 1050; border: 1px solid #e2e8f0;
        }
        .global-search-empty { padding: 16px; text-align: center; color: #94a3b8; font-size: 0.8rem; }
        .global-search-item {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px;
          background: none; border: none; border-bottom: 1px solid #f1f5f9; text-align: left; cursor: pointer;
        }
        .global-search-item:last-child { border-bottom: none; }
        .global-search-item:hover { background: #f8fafc; }
        .global-search-item-icon { font-size: 1.1rem; flex-shrink: 0; }
        .global-search-item-body { flex: 1; min-width: 0; }
        .global-search-item-title { font-weight: 700; font-size: 0.82rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .global-search-item-subtitle { font-size: 0.72rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .global-search-item-type { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; }

        @media (max-width: 767px) {
          .global-search-wrap { display: none; }
        }
      `}} />
    </div>
  );
}
