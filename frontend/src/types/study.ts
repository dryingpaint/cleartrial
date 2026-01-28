export interface Study {
  nct_id: string;
  brief_title: string;
  official_title?: string;
  overall_status: string;
  study_type: string;
  phase?: string;
  conditions: string[];
  interventions?: { type: string; name: string }[];
  brief_summary?: string;
  eligibility_criteria?: string;
  eligibility_sex?: string;
  eligibility_min_age?: string;
  eligibility_max_age?: string;
  enrollment_count?: number;
  start_date?: string;
  completion_date?: string;
  lead_sponsor?: string;
  lead_sponsor_class?: string;
  locations?: {
    facility?: string;
    city?: string;
    state?: string;
    country?: string;
  }[];
}

export interface SearchFilters {
  query?: string;
  status?: string;
  phase?: string;
  studyType?: string;
  sponsorClass?: string;
  condition?: string;
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  studies: Study[];
  total: number;
  page: number;
  limit: number;
}
