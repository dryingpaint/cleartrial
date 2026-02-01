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

    // Status breakdown
    const statusResult = await sql`
      SELECT overall_status as name, COUNT(*)::int as value 
      FROM studies 
      WHERE overall_status IS NOT NULL
      GROUP BY overall_status 
      ORDER BY value DESC
      LIMIT 10
    `;

    // Phase breakdown (simplified)
    const phaseResult = await sql`
      SELECT 
        COALESCE(phase, 'N/A') as name,
        COUNT(*)::int as value
      FROM studies
      GROUP BY phase
      ORDER BY value DESC
      LIMIT 10
    `;

    // Top conditions (with null check)
    const conditionsResult = await sql`
      SELECT condition as name, COUNT(*)::int as value
      FROM studies, jsonb_array_elements_text(conditions) as condition
      WHERE conditions IS NOT NULL AND jsonb_typeof(conditions) = 'array'
      GROUP BY condition
      ORDER BY value DESC
      LIMIT 10
    `;

    // Sponsor class breakdown
    const sponsorResult = await sql`
      SELECT 
        COALESCE(lead_sponsor_class, 'Unknown') as name,
        COUNT(*)::int as value
      FROM studies
      GROUP BY lead_sponsor_class
      ORDER BY value DESC
      LIMIT 5
    `;

    // Studies by year (using start_date)
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

    return NextResponse.json({
      total,
      recruiting: recruitingResult[0]?.count || 0,
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
