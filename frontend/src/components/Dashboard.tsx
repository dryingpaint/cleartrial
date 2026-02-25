"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Activity, Users, TrendingUp, Beaker, X } from "lucide-react";

interface Stats {
  total: number;
  recruiting: number;
  topCondition?: string;
  byStatus: { name: string; value: number }[];
  byPhase: { name: string; value: number }[];
  topConditions: { name: string; value: number }[];
  bySponsor: { name: string; value: number }[];
  byYear: { year: number; count: number }[];
  filters?: Filters;
  error?: string;
}

interface Filters {
  phase?: string | null;
  status?: string | null;
  year?: string | null;
  condition?: string | null;
  sponsor?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  Recruiting: "#22c55e",
  Active: "#3b82f6",
  Completed: "#6b7280",
  Terminated: "#ef4444",
  Suspended: "#f59e0b",
  Withdrawn: "#f97316",
  "Not Yet Recruiting": "#a855f7",
  "By Invitation": "#06b6d4",
  Unknown: "#9ca3af",
};

const PHASE_COLORS: Record<string, string> = {
  "Early Phase 1": "#c7d2fe",
  "Phase 1": "#a5b4fc",
  "Phase 1/2": "#818cf8",
  "Phase 2": "#6366f1",
  "Phase 2/3": "#4f46e5",
  "Phase 3": "#4338ca",
  "Phase 4": "#3730a3",
  "Not Applicable": "#cbd5e1",
  "Other": "#94a3b8",
};

const SPONSOR_COLORS = ["#f472b6", "#fb923c", "#34d399", "#60a5fa", "#a78bfa"];

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function FilterBadge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
      {label}
      <button onClick={onClear} className="hover:bg-indigo-200 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.phase) params.set("phase", filters.phase);
      if (filters.status) params.set("status", filters.status);
      if (filters.year) params.set("year", filters.year);
      if (filters.condition) params.set("condition", filters.condition);
      if (filters.sponsor) params.set("sponsor", filters.sponsor);

      const res = await fetch(`/api/stats?${params.toString()}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const setFilter = (key: keyof Filters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [key]: null }));
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasFilters = Object.values(filters).some(Boolean);

  if (loading && !stats) {
    return (
      <div className="animate-pulse space-y-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 rounded-xl" />
          <div className="h-80 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats || stats.error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <p className="text-yellow-800">Unable to load analytics. Search still works below.</p>
      </div>
    );
  }

  const topCondition = stats.topCondition || (Array.isArray(stats.topConditions) && stats.topConditions[0]?.name) || "N/A";

  return (
    <div className="space-y-6 mb-8">
      {/* Active Filters */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600 font-medium">Filtering by:</span>
          {filters.phase && (
            <FilterBadge label={`Phase: ${filters.phase}`} onClear={() => clearFilter("phase")} />
          )}
          {filters.status && (
            <FilterBadge label={`Status: ${filters.status}`} onClear={() => clearFilter("status")} />
          )}
          {filters.year && (
            <FilterBadge label={`Year: ${filters.year}`} onClear={() => clearFilter("year")} />
          )}
          {filters.condition && (
            <FilterBadge label={`Condition: ${filters.condition}`} onClear={() => clearFilter("condition")} />
          )}
          {filters.sponsor && (
            <FilterBadge label={`Sponsor: ${filters.sponsor}`} onClear={() => clearFilter("sponsor")} />
          )}
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Studies"
          value={stats.total}
          icon={Beaker}
          color="bg-indigo-500"
        />
        <StatCard
          title="Actively Recruiting"
          value={stats.recruiting}
          icon={Users}
          color="bg-green-500"
        />
        <StatCard
          title="Top Condition"
          value={topCondition.length > 15 ? topCondition.slice(0, 15) + "..." : topCondition}
          icon={Activity}
          color="bg-pink-500"
        />
        <StatCard
          title="This Year"
          value={Array.isArray(stats.byYear) ? (stats.byYear.find((y) => y.year === new Date().getFullYear())?.count || 0) : 0}
          icon={TrendingUp}
          color="bg-orange-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phase Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Studies by Phase
            {loading && <span className="ml-2 text-sm text-gray-400">(updating...)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={Array.isArray(stats.byPhase) ? stats.byPhase.filter((p) => p.name !== "Not Applicable" && p.name !== "Other") : []}
              onClick={(data: unknown) => {
                const d = data as { activePayload?: { payload?: { name?: string } }[] };
                if (d?.activePayload?.[0]?.payload?.name) {
                  const clickedPhase = d.activePayload[0].payload.name;
                  setFilter("phase", filters.phase === clickedPhase ? null : clickedPhase);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), "Studies"]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {Array.isArray(stats.byPhase) && stats.byPhase.filter((p) => p.name !== "Not Applicable" && p.name !== "Other").map((entry) => (
                  <Cell 
                    key={entry.name} 
                    fill={PHASE_COLORS[entry.name] || "#6366f1"}
                    opacity={filters.phase && filters.phase !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Status Distribution
            {loading && <span className="ml-2 text-sm text-gray-400">(updating...)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={Array.isArray(stats.byStatus) ? stats.byStatus.slice(0, 6) : []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => {
                  if (data?.name) {
                    setFilter("status", filters.status === data.name ? null : data.name);
                  }
                }}
                style={{ cursor: "pointer" }}
                label={({ name, percent }) =>
                  `${(name || "").slice(0, 10)}${(name || "").length > 10 ? "..." : ""} ${((percent || 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {Array.isArray(stats.byStatus) && stats.byStatus.slice(0, 6).map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] || STATUS_COLORS.Unknown}
                    opacity={filters.status && filters.status !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), "Studies"]}
                contentStyle={{ borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Conditions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top Therapeutic Areas
            {loading && <span className="ml-2 text-sm text-gray-400">(updating...)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={Array.isArray(stats.topConditions) ? stats.topConditions.slice(0, 8) : []}
              layout="vertical"
              onClick={(data: unknown) => {
                const d = data as { activePayload?: { payload?: { name?: string } }[] };
                if (d?.activePayload?.[0]?.payload?.name) {
                  const clickedCondition = d.activePayload[0].payload.name;
                  setFilter("condition", filters.condition === clickedCondition ? null : clickedCondition);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v.length > 18 ? v.slice(0, 18) + "..." : v)}
              />
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), "Studies"]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {Array.isArray(stats.topConditions) && stats.topConditions.slice(0, 8).map((entry) => (
                  <Cell 
                    key={entry.name} 
                    fill="#ec4899"
                    opacity={filters.condition && filters.condition !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend over time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Studies Started Per Year
            {loading && <span className="ml-2 text-sm text-gray-400">(updating...)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={Array.isArray(stats.byYear) ? stats.byYear.filter((y) => y.year >= 2010) : []}
              onClick={(data: unknown) => {
                const d = data as { activePayload?: { payload?: { year?: number } }[] };
                if (d?.activePayload?.[0]?.payload?.year) {
                  const clickedYear = String(d.activePayload[0].payload.year);
                  setFilter("year", filters.year === clickedYear ? null : clickedYear);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), "Studies"]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {Array.isArray(stats.byYear) && stats.byYear.filter((y) => y.year >= 2010).map((entry) => (
                  <Cell 
                    key={entry.year} 
                    fill="#f97316"
                    opacity={filters.year && filters.year !== String(entry.year) ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sponsor breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sponsor Types
          {loading && <span className="ml-2 text-sm text-gray-400">(updating...)</span>}
        </h3>
        <div className="flex flex-wrap gap-3">
          {Array.isArray(stats.bySponsor) && stats.bySponsor.map((sponsor, i) => (
            <button
              key={sponsor.name}
              onClick={() => setFilter("sponsor", filters.sponsor === sponsor.name ? null : sponsor.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                filters.sponsor === sponsor.name 
                  ? "ring-2 ring-offset-2 ring-indigo-500" 
                  : filters.sponsor 
                    ? "opacity-40" 
                    : ""
              }`}
              style={{ backgroundColor: `${SPONSOR_COLORS[i % SPONSOR_COLORS.length]}20` }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SPONSOR_COLORS[i % SPONSOR_COLORS.length] }}
              />
              <span className="text-sm font-medium text-gray-700">{sponsor.name}</span>
              <span className="text-sm text-gray-500">{formatNumber(sponsor.value)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
