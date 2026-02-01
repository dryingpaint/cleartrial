"use client";

import { useEffect, useState } from "react";
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
import { Activity, Users, TrendingUp, Beaker } from "lucide-react";

interface Stats {
  total: number;
  recruiting: number;
  topCondition?: string;
  byStatus: { name: string; value: number }[];
  byPhase: { name: string; value: number }[];
  topConditions: { name: string; value: number }[];
  bySponsor: { name: string; value: number }[];
  byYear: { year: number; count: number }[];
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  RECRUITING: "#22c55e",
  "ACTIVE_NOT_RECRUITING": "#3b82f6",
  COMPLETED: "#6b7280",
  TERMINATED: "#ef4444",
  SUSPENDED: "#f59e0b",
  WITHDRAWN: "#f97316",
  "NOT_YET_RECRUITING": "#a855f7",
  UNKNOWN: "#9ca3af",
};

const PHASE_COLORS = ["#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3"];
const SPONSOR_COLORS = ["#f472b6", "#fb923c", "#34d399", "#60a5fa"];

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

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load stats:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
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

  const topCondition = stats.topCondition || stats.topConditions[0]?.name || "N/A";

  return (
    <div className="space-y-6 mb-8">
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
          value={stats.byYear.find((y) => y.year === new Date().getFullYear())?.count || 0}
          icon={TrendingUp}
          color="bg-orange-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phase Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Studies by Phase</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.byPhase.filter((p) => p.name !== "N/A" && p.name !== "Other")}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), 'Studies']}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.byStatus.slice(0, 6)}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${(name || "").replace(/_/g, " ").slice(0, 10)}${(name || "").length > 10 ? "..." : ""} ${((percent || 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {stats.byStatus.slice(0, 6).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name] || STATUS_COLORS.UNKNOWN}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), 'Studies']}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Therapeutic Areas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.topConditions.slice(0, 8)} layout="vertical">
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
                formatter={(value) => [(value as number).toLocaleString(), 'Studies']}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend over time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Studies Started Per Year</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.byYear.filter((y) => y.year >= 2010)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [(value as number).toLocaleString(), 'Studies']}
                contentStyle={{ borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", strokeWidth: 0, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sponsor breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sponsor Types</h3>
        <div className="flex flex-wrap gap-4">
          {stats.bySponsor.map((sponsor, i) => (
            <div
              key={sponsor.name}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: `${SPONSOR_COLORS[i % SPONSOR_COLORS.length]}20` }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SPONSOR_COLORS[i % SPONSOR_COLORS.length] }}
              />
              <span className="text-sm font-medium text-gray-700">{sponsor.name}</span>
              <span className="text-sm text-gray-500">{formatNumber(sponsor.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
