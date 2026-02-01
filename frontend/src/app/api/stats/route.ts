import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Get total count
    const totalResult = await sql`SELECT COUNT(*)::int as count FROM studies`;
    const total = totalResult[0]?.count || 0;

    // Status breakdown
    const statusResult = await sql`
      SELECT overall_status as name, COUNT(*)::int as value 
      FROM studies 
      WHERE overall_status IS NOT NULL
      GROUP BY overall_status 
      ORDER BY value DESC
    `;

    // Phase breakdown
    const phaseResult = await sql`
      SELECT 
        CASE 
          WHEN phase LIKE '%PHASE1%' AND phase NOT LIKE '%PHASE2%' THEN 'Phase 1'
          WHEN phase LIKE '%PHASE2%' AND phase NOT LIKE '%PHASE3%' THEN 'Phase 2'
          WHEN phase LIKE '%PHASE3%' AND phase NOT LIKE '%PHASE4%' THEN 'Phase 3'
          WHEN phase LIKE '%PHASE4%' THEN 'Phase 4'
          WHEN phase = 'EARLY_PHASE1' THEN 'Early Phase 1'
          WHEN phase = 'NA' OR phase IS NULL THEN 'N/A'
          ELSE 'Other'
        END as name,
        COUNT(*)::int as value
      FROM studies
      GROUP BY 1
      ORDER BY 
        CASE 
          WHEN name = 'Early Phase 1' THEN 1
          WHEN name = 'Phase 1' THEN 2
          WHEN name = 'Phase 2' THEN 3
          WHEN name = 'Phase 3' THEN 4
          WHEN name = 'Phase 4' THEN 5
          ELSE 6
        END
    `;

    // Top conditions (flatten JSON array and count)
    const conditionsResult = await sql`
      SELECT condition as name, COUNT(*)::int as value
      FROM studies, jsonb_array_elements_text(conditions) as condition
      GROUP BY condition
      ORDER BY value DESC
      LIMIT 10
    `;

    // Sponsor class breakdown
    const sponsorResult = await sql`
      SELECT 
        CASE 
          WHEN lead_sponsor_class = 'INDUSTRY' THEN 'Industry'
          WHEN lead_sponsor_class = 'NIH' THEN 'NIH'
          WHEN lead_sponsor_class = 'FED' THEN 'Federal'
          WHEN lead_sponsor_class = 'OTHER' THEN 'Academic/Other'
          ELSE 'Unknown'
        END as name,
        COUNT(*)::int as value
      FROM studies
      GROUP BY 1
      ORDER BY value DESC
    `;

    // Studies by year (using start_date)
    const yearResult = await sql`
      SELECT 
        EXTRACT(YEAR FROM start_date)::int as year,
        COUNT(*)::int as count
      FROM studies
      WHERE start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) >= 2000
      GROUP BY 1
      ORDER BY 1
    `;

    // Recruiting count
    const recruitingResult = await sql`
      SELECT COUNT(*)::int as count FROM studies WHERE overall_status = 'RECRUITING'
    `;

    return NextResponse.json({
      total,
      recruiting: recruitingResult[0]?.count || 0,
      byStatus: statusResult,
      byPhase: phaseResult,
      topConditions: conditionsResult,
      bySponsor: sponsorResult,
      byYear: yearResult,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
