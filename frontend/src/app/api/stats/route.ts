import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterPhase = searchParams.get("phase");
    const filterStatus = searchParams.get("status");
    const filterYear = searchParams.get("year");
    const filterCondition = searchParams.get("condition");
    const filterSponsor = searchParams.get("sponsor");

    // Build WHERE clause dynamically
    const conditions: string[] = [];
    
    if (filterPhase) {
      if (filterPhase === "Phase 1/2") {
        conditions.push(`(phase LIKE '%PHASE1%' AND phase LIKE '%PHASE2%')`);
      } else if (filterPhase === "Phase 2/3") {
        conditions.push(`(phase LIKE '%PHASE2%' AND phase LIKE '%PHASE3%')`);
      } else if (filterPhase === "Not Applicable") {
        conditions.push(`(phase IS NULL OR phase = 'NA')`);
      } else {
        const phaseMap: Record<string, string> = {
          "Early Phase 1": "EARLY_PHASE1",
          "Phase 1": "PHASE1",
          "Phase 2": "PHASE2", 
          "Phase 3": "PHASE3",
          "Phase 4": "PHASE4",
        };
        const dbPhase = phaseMap[filterPhase];
        if (dbPhase) conditions.push(`phase = '${dbPhase}'`);
      }
    }

    if (filterStatus) {
      const statusMap: Record<string, string> = {
        "Recruiting": "RECRUITING",
        "Completed": "COMPLETED",
        "Active": "ACTIVE_NOT_RECRUITING",
        "Not Yet Recruiting": "NOT_YET_RECRUITING",
        "Terminated": "TERMINATED",
        "Withdrawn": "WITHDRAWN",
        "Suspended": "SUSPENDED",
        "By Invitation": "ENROLLING_BY_INVITATION",
        "Unknown": "UNKNOWN",
      };
      const dbStatus = statusMap[filterStatus];
      if (dbStatus) conditions.push(`overall_status = '${dbStatus}'`);
    }

    if (filterYear) {
      conditions.push(`EXTRACT(YEAR FROM start_date) = ${parseInt(filterYear)}`);
    }

    if (filterCondition) {
      conditions.push(`conditions @> '"${filterCondition.replace(/'/g, "''")}"'::jsonb`);
    }

    if (filterSponsor) {
      const sponsorMap: Record<string, string> = {
        "Industry": "INDUSTRY",
        "NIH": "NIH",
        "Federal": "FED",
        "Academic/Other": "OTHER",
        "Network": "NETWORK",
      };
      const dbSponsor = sponsorMap[filterSponsor];
      if (dbSponsor) conditions.push(`lead_sponsor_class = '${dbSponsor}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const totalResult = await sql.unsafe(`SELECT COUNT(*)::int as count FROM studies ${whereClause}`);
    const total = totalResult[0]?.count || 0;

    // Recruiting count
    const recruitingWhere = whereClause 
      ? `${whereClause} AND overall_status = 'RECRUITING'`
      : `WHERE overall_status = 'RECRUITING'`;
    const recruitingResult = await sql.unsafe(`SELECT COUNT(*)::int as count FROM studies ${recruitingWhere}`);

    // Status breakdown
    const statusResult = await sql.unsafe(`
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
      ${whereClause ? whereClause + ' AND overall_status IS NOT NULL' : 'WHERE overall_status IS NOT NULL'}
      GROUP BY overall_status 
      ORDER BY value DESC
      LIMIT 8
    `);

    // Phase breakdown
    const phaseResult = await sql.unsafe(`
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
        ${whereClause}
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
    `);

    // Top conditions
    const conditionsResult = await sql.unsafe(`
      SELECT condition as name, COUNT(*)::int as value
      FROM studies, jsonb_array_elements_text(conditions) as condition
      ${whereClause ? whereClause + ' AND' : 'WHERE'} conditions IS NOT NULL 
        AND jsonb_typeof(conditions) = 'array'
        AND LOWER(condition) NOT IN (
          'healthy', 'healthy volunteers', 'healthy volunteer',
          'healthy adults', 'healthy participants', 'normal', 'disease', 'diseases'
        )
        AND LENGTH(condition) > 3
      GROUP BY condition
      ORDER BY value DESC
      LIMIT 10
    `);

    // Sponsor breakdown
    const sponsorResult = await sql.unsafe(`
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
      ${whereClause}
      GROUP BY lead_sponsor_class
      ORDER BY value DESC
      LIMIT 5
    `);

    // Studies by year
    const yearWhere = whereClause 
      ? `${whereClause} AND start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) >= 2010 AND EXTRACT(YEAR FROM start_date) <= 2026`
      : `WHERE start_date IS NOT NULL AND EXTRACT(YEAR FROM start_date) >= 2010 AND EXTRACT(YEAR FROM start_date) <= 2026`;
    const yearResult = await sql.unsafe(`
      SELECT 
        EXTRACT(YEAR FROM start_date)::int as year,
        COUNT(*)::int as count
      FROM studies
      ${yearWhere}
      GROUP BY 1
      ORDER BY 1
    `);

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
      filters: { phase: filterPhase, status: filterStatus, year: filterYear, condition: filterCondition, sponsor: filterSponsor },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch stats",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
