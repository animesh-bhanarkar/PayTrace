import React, { useState, useEffect } from "react";
import type { SearchResultItem } from "../types";
import { searchGlobal } from "../api/client";
import {
  Search,
  Filter,
  AlertTriangle,
  ArrowRight,
  X,
  RefreshCw,
} from "lucide-react";

interface GlobalSearchProps {
  onSelectIncident: (paymentId: string, meta?: Record<string, unknown>) => void;
  initialQuery?: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onSelectIncident,
  initialQuery = "",
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCIDENT" | "EVENT">("ALL");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const executeSearch = async (searchQuery: string, filter: string) => {
    const clean = searchQuery.trim();
    if (!clean) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const items = await searchGlobal(clean, 30, filter);
      setResults(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search request failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery, typeFilter);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, typeFilter);
  };

  const handleFilterChange = (newFilter: "ALL" | "INCIDENT" | "EVENT") => {
    setTypeFilter(newFilter);
    if (query.trim()) {
      executeSearch(query, newFilter);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  const handleSelectResult = (item: SearchResultItem) => {
    const pid = item.payment_id || item.id;
    onSelectIncident(pid, {
      id: item.id,
      incident_type: item.title,
      severity: item.severity || "MEDIUM",
      order_id: item.order_id,
      resolved: item.details?.resolved,
      created_at: item.timestamp,
    });
  };

  const exampleQueries = [
    "pay_live_001",
    "invalid_transition",
    "duplicate_webhook",
    "evt_001",
    "order_1001",
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Search Input Box Card ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-500" />
            <span>Global Evidence & Incident Search</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Query across payment IDs, order references, incident types, normalized event IDs, and descriptions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by payment_id, order_id, incident type, event_id..."
              className="w-full pl-12 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Filter chips */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium mr-1">
                Filter:
              </span>
              {(["ALL", "INCIDENT", "EVENT"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => handleFilterChange(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    typeFilter === filter
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {filter === "ALL" ? "All Types" : filter === "INCIDENT" ? "Incidents" : "Events"}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Search Database</span>
            </button>
          </div>
        </form>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => executeSearch(query, typeFilter)}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── State 1: Loading Skeleton ─────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-2"
            >
              <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* ── State 2: No Search Yet / Suggested Queries ────────────────────── */}
      {!hasSearched && !loading && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Deterministic Query Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Search by payment reference, anomaly classification, or raw event ID.
            </p>
          </div>

          <div className="pt-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Try suggested queries:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {exampleQueries.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setQuery(ex);
                    executeSearch(ex, typeFilter);
                  }}
                  className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 font-mono text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── State 3: Empty Results ────────────────────────────────────────── */}
      {hasSearched && !loading && results.length === 0 && !error && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No matching records found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No incidents or normalized events matched query <strong className="font-mono text-slate-700 dark:text-slate-300">"{query}"</strong>.
            Try searching for a different payment ID or incident type.
          </p>
        </div>
      )}

      {/* ── State 4: Results List ─────────────────────────────────────────── */}
      {hasSearched && !loading && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-mono">
            <span>
              Found <strong>{results.length}</strong> matching records for "{query}"
            </span>
          </div>

          <div className="space-y-2.5">
            {results.map((item) => (
              <div
                key={`${item.type}_${item.id}`}
                onClick={() => handleSelectResult(item)}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 hover:shadow-md transition flex items-start justify-between gap-4 cursor-pointer group"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        item.type === "INCIDENT"
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {item.type}
                    </span>

                    {item.severity && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase font-mono ${
                          item.severity === "HIGH" || item.severity === "high"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {item.severity}
                      </span>
                    )}

                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                      {item.title}
                    </h4>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {item.payment_id && <span>Payment: {item.payment_id}</span>}
                    {item.order_id && <span>Order: {item.order_id}</span>}
                    {item.timestamp && <span>{new Date(item.timestamp).toLocaleString()}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium shrink-0 pt-1">
                  <span>Inspect</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
