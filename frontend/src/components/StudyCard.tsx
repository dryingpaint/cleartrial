"use client";

import { Study } from "@/types/study";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, MapPin, Building2, Calendar, Users } from "lucide-react";
import { useState } from "react";

const statusColors: Record<string, string> = {
  RECRUITING: "bg-green-100 text-green-800",
  "ACTIVE_NOT_RECRUITING": "bg-blue-100 text-blue-800",
  COMPLETED: "bg-gray-100 text-gray-800",
  TERMINATED: "bg-red-100 text-red-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  WITHDRAWN: "bg-orange-100 text-orange-800",
  "NOT_YET_RECRUITING": "bg-purple-100 text-purple-800",
};

const phaseLabels: Record<string, string> = {
  EARLY_PHASE1: "Early Phase 1",
  PHASE1: "Phase 1",
  PHASE2: "Phase 2",
  PHASE3: "Phase 3",
  PHASE4: "Phase 4",
  NA: "N/A",
};

export function StudyCard({ study }: { study: Study }) {
  const [expanded, setExpanded] = useState(false);

  const locationCount = study.locations?.length || 0;
  const primaryLocation = study.locations?.[0];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full",
                  statusColors[study.overall_status] || "bg-gray-100 text-gray-800"
                )}
              >
                {study.overall_status?.replace(/_/g, " ")}
              </span>
              {study.phase && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                  {phaseLabels[study.phase] || study.phase}
                </span>
              )}
              <span className="text-xs text-gray-500">{study.study_type}</span>
            </div>
            <a
              href={`https://clinicaltrials.gov/study/${study.nct_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-gray-900 hover:text-indigo-600 line-clamp-2"
            >
              {study.brief_title}
            </a>
            <p className="text-sm text-gray-500 mt-1">{study.nct_id}</p>
          </div>
        </div>

        {/* Conditions */}
        {study.conditions && study.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {study.conditions.slice(0, 3).map((condition, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
              >
                {condition}
              </span>
            ))}
            {study.conditions.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{study.conditions.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
          {study.lead_sponsor && (
            <div className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{study.lead_sponsor}</span>
            </div>
          )}
          {primaryLocation && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>
                {[primaryLocation.city, primaryLocation.country].filter(Boolean).join(", ")}
                {locationCount > 1 && ` +${locationCount - 1}`}
              </span>
            </div>
          )}
          {study.enrollment_count && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{study.enrollment_count.toLocaleString()} enrolled</span>
            </div>
          )}
          {study.start_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{study.start_date}</span>
            </div>
          )}
        </div>

        {/* Summary (collapsible) */}
        {study.brief_summary && (
          <div className="mt-3">
            <p className={cn("text-sm text-gray-600", !expanded && "line-clamp-2")}>
              {study.brief_summary}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Show more
                </>
              )}
            </button>
          </div>
        )}

        {/* Eligibility preview */}
        {expanded && study.eligibility_criteria && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Eligibility</h4>
            <div className="flex gap-4 text-sm text-gray-600 mb-2">
              {study.eligibility_sex && <span>Sex: {study.eligibility_sex}</span>}
              {study.eligibility_min_age && <span>Min age: {study.eligibility_min_age}</span>}
              {study.eligibility_max_age && <span>Max age: {study.eligibility_max_age}</span>}
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6">
              {study.eligibility_criteria}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
