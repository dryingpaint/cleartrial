import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const phase = searchParams.get("phase") || "";
  const studyType = searchParams.get("study_type") || "";
  const sponsorClass = searchParams.get("sponsor_class") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  try {
    // Build WHERE conditions
    const conditions: string[] = [];
    
    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(`(
        brief_title ILIKE '${searchTerm}' OR 
        official_title ILIKE '${searchTerm}' OR 
        lead_sponsor ILIKE '${searchTerm}' OR 
        conditions::text ILIKE '${searchTerm}' OR
        nct_id ILIKE '${searchTerm}'
      )`);
    }
    if (status) {
      conditions.push(`overall_status = '${status}'`);
    }
    if (phase) {
      conditions.push(`phase = '${phase}'`);
    }
    if (studyType) {
      conditions.push(`study_type = '${studyType}'`);
    }
    if (sponsorClass) {
      conditions.push(`lead_sponsor_class = '${sponsorClass}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await sql`SELECT COUNT(*)::int as count FROM studies ${whereClause ? sql.unsafe(whereClause) : sql``}`;
    const total = countResult[0]?.count || 0;

    // Fetch studies
    const studies = await sql`
      SELECT 
        nct_id, brief_title, official_title, overall_status, study_type, phase,
        conditions, interventions, brief_summary, eligibility_criteria,
        eligibility_sex, eligibility_min_age, eligibility_max_age,
        enrollment_count, start_date, completion_date, lead_sponsor,
        lead_sponsor_class, locations
      FROM studies 
      ${whereClause ? sql.unsafe(whereClause) : sql``}
      ORDER BY last_update_date DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      studies,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database error", studies: [], total: 0, page, limit },
      { status: 500 }
    );
  }
}
