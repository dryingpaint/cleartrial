"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, X, Loader2 } from "lucide-react";
import { StudyCard } from "@/components/StudyCard";
import { Study, SearchFilters } from "@/types/study";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "RECRUITING", label: "Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, not recruiting" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NOT_YET_RECRUITING", label: "Not yet recruiting" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "SUSPENDED", label: "Suspended" },
];

const PHASES = [
  { value: "", label: "All Phases" },
  { value: "EARLY_PHASE1", label: "Early Phase 1" },
  { value: "PHASE1", label: "Phase 1" },
  { value: "PHASE2", label: "Phase 2" },
  { value: "PHASE3", label: "Phase 3" },
  { value: "PHASE4", label: "Phase 4" },
];

const STUDY_TYPES = [
  { value: "", label: "All Types" },
  { value: "INTERVENTIONAL", label: "Interventional" },
  { value: "OBSERVATIONAL", label: "Observational" },
];

const SPONSOR_CLASSES = [
  { value: "", label: "All Sponsors" },
  { value: "INDUSTRY", label: "Industry" },
  { value: "NIH", label: "NIH" },
  { value: "FED", label: "Federal" },
  { value: "OTHER", label: "Other" },
];

export default function Home() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    status: "",
    phase: "",
    studyType: "",
    sponsorClass: "",
    page: 1,
    limit: 20,
  });

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set("q", filters.query);
      if (filters.status) params.set("status", filters.status);
      if (filters.phase) params.set("phase", filters.phase);
      if (filters.studyType) params.set("study_type", filters.studyType);
      if (filters.sponsorClass) params.set("sponsor_class", filters.sponsorClass);
      params.set("page", String(filters.page || 1));
      params.set("limit", String(filters.limit || 20));

      const res = await fetch(`/api/studies?${params.toString()}`);
      const data = await res.json();
      
      setStudies(data.studies || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const updateFilter = (key: keyof SearchFilters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      query: "",
      status: "",
      phase: "",
      studyType: "",
      sponsorClass: "",
      page: 1,
      limit: 20,
    });
  };

  const hasActiveFilters = filters.status || filters.phase || filters.studyType || filters.sponsorClass;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Clear<span className="text-indigo-600">Trial</span>
            </h1>
            <span className="text-sm text-gray-500">
              {total.toLocaleString()} studies
            </span>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conditions, interventions, sponsors..."
                value={filters.query}
                onChange={(e) => updateFilter("query", e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors",
                showFilters || hasActiveFilters
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Filter className="w-5 h-5" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-indigo-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Filters</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" /> Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter("status", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.phase}
                  onChange={(e) => updateFilter("phase", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PHASES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.studyType}
                  onChange={(e) => updateFilter("studyType", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STUDY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.sponsorClass}
                  onChange={(e) => updateFilter("sponsorClass", e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SPONSOR_CLASSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Results */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : studies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No studies found. Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {studies.map((study) => (
                <StudyCard key={study.nct_id} study={study} />
              ))}
            </div>

            {/* Pagination */}
            {total > (filters.limit || 20) && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => updateFilter("page", Math.max(1, (filters.page || 1) - 1))}
                  disabled={filters.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {filters.page} of {Math.ceil(total / (filters.limit || 20))}
                </span>
                <button
                  onClick={() => updateFilter("page", (filters.page || 1) + 1)}
                  disabled={(filters.page || 1) * (filters.limit || 20) >= total}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
