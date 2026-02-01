import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Get total count
    const totalResult = await sql`SELECT COUNT(*)::int as count FROM studies`;
    const total = totalResult[0]?.count || 0;

    // Recruiting count
    const recruitingResult = await sql`
      SELECT COUNT(*)::int as count FROM studies WHERE overall_status = 'RECRUITING'
    `;

    // Status breakdown (cleaned up names)
    const statusResult = await sql`
      SELECT 
        CASE overall_status
          WHEN 'RECRUITING' THEN 'Recruiting'
          WHEN 'COMPLETED' THEN 'Completed'
          WHEN 'ACTIVE_NOT_RECRUITING' THEN 'Active'
          WHEN 'NOT_YET_RECRUITING' THEN 'Not Yet Recruiting'
          WHEN 'TERMINATED' THEN 'Terminated'
          WHEN 'WITHDRAWN' THEN 'Withdrawn'
          WHEN 'SUSPENDED' THEN 'Suspended'
          WHEN 'ENROLLING_BY_INVITATION' THEN 'By Invitation'
          WHEN 'UNKNOWN' THEN 'Unknown'
          ELSE COALESCE(overall_status, 'Unknown')
        END as name,
        COUNT(*)::int as value 
      FROM studies 
      WHERE overall_status IS NOT NULL
      GROUP BY overall_status 
      ORDER BY value DESC
      LIMIT 8
    `;

    // Phase breakdown (properly categorized)
    const phaseResult = await sql`
      SELECT name, SUM(value)::int as value FROM (
        SELECT 
          CASE 
            WHEN phase = 'PHASE1' THEN 'Phase 1'
            WHEN phase = 'PHASE2' THEN 'Phase 2'
            WHEN phase = 'PHASE3' THEN 'Phase 3'
            WHEN phase = 'PHASE4' THEN 'Phase 4'
            WHEN phase = 'EARLY_PHASE1' THEN 'Early Phase 1'
            WHEN phase LIKE '%PHASE1%' AND phase LIKE '%PHASE2%' THEN 'Phase 1/2'
            WHEN phase LIKE '%PHASE2%' AND phase LIKE '%PHASE3%' THEN 'Phase 2/3'
            WHEN phase IS NULL OR phase = 'NA' THEN 'Not Applicable'
            ELSE 'Other'
          END as name,
          COUNT(*)::int as value
        FROM studies
        GROUP BY phase
      ) sub
      GROUP BY name
      ORDER BY 
        CASE name
          WHEN 'Early Phase 1' THEN 1
          WHEN 'Phase 1' THEN 2
          WHEN 'Phase 1/2' THEN 3
          WHEN 'Phase 2' THEN 4
          WHEN 'Phase 2/3' THEN 5
          WHEN 'Phase 3' THEN 6
          WHEN 'Phase 4' THEN 7
          WHEN 'Not Applicable' THEN 8
          ELSE 9
        END
    `;

    // Top conditions (exclude healthy volunteers and generic terms)
    const conditionsResult = await sql`
      SELECT condition as name, COUNT(*)::int as value
      FROM studies, jsonb_array_elements_text(conditions) as condition
      WHERE conditions IS NOT NULL 
        AND jsonb_typeof(conditions) = 'array'
        AND LOWER(condition) NOT IN (
          'healthy', 
          'healthy volunteers', 
          'healthy volunteer',
          'healthy adults',
          'healthy participants',
          'normal',
          'disease',
          'diseases'
        )
        AND LENGTH(condition) > 3
      GROUP BY condition
      ORDER BY value DESC
      LIMIT 10
    `;

    // Sponsor class breakdown (cleaned names)
    const sponsorResult = await sql`
      SELECT 
        CASE lead_sponsor_class
          WHEN 'INDUSTRY' THEN 'Industry'
          WHEN 'NIH' THEN 'NIH'
          WHEN 'FED' THEN 'Federal'
          WHEN 'OTHER' THEN 'Academic/Other'
          WHEN 'NETWORK' THEN 'Network'
          ELSE 'Other'
        END as name,
        COUNT(*)::int as value
      FROM studies
      GROUP BY lead_sponsor_class
      ORDER BY value DESC
      LIMIT 5
    `;

    // Studies by year
    const yearResult = await sql`
      SELECT 
        EXTRACT(YEAR FROM start_date)::int as year,
        COUNT(*)::int as count
      FROM studies
      WHERE start_date IS NOT NULL 
        AND EXTRACT(YEAR FROM start_date) >= 2010
        AND EXTRACT(YEAR FROM start_date) <= 2026
      GROUP BY 1
      ORDER BY 1
    `;

    // Get actual top condition (excluding healthy)
    const topCondition = conditionsResult[0]?.name || "N/A";

    return NextResponse.json({
      total,
      recruiting: recruitingResult[0]?.count || 0,
      topCondition,
      byStatus: statusResult || [],
      byPhase: phaseResult || [],
      topConditions: conditionsResult || [],
      bySponsor: sponsorResult || [],
      byYear: yearResult || [],
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch stats",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
