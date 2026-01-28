import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Text search
    if (q) {
      conditions.push(`(
        brief_title ILIKE $${paramIndex} OR 
        official_title ILIKE $${paramIndex} OR 
        lead_sponsor ILIKE $${paramIndex} OR 
        conditions::text ILIKE $${paramIndex} OR
        nct_id ILIKE $${paramIndex}
      )`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filters
    if (status) {
      conditions.push(`overall_status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (phase) {
      conditions.push(`phase = $${paramIndex}`);
      params.push(phase);
      paramIndex++;
    }
    if (studyType) {
      conditions.push(`study_type = $${paramIndex}`);
      params.push(studyType);
      paramIndex++;
    }
    if (sponsorClass) {
      conditions.push(`lead_sponsor_class = $${paramIndex}`);
      params.push(sponsorClass);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM studies ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch studies
    const studiesResult = await pool.query(
      `SELECT 
        nct_id, brief_title, official_title, overall_status, study_type, phase,
        conditions, interventions, brief_summary, eligibility_criteria,
        eligibility_sex, eligibility_min_age, eligibility_max_age,
        enrollment_count, start_date, completion_date, lead_sponsor,
        lead_sponsor_class, locations
      FROM studies 
      ${whereClause}
      ORDER BY last_update_date DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const studies = studiesResult.rows.map((row) => ({
      ...row,
      start_date: row.start_date?.toISOString?.()?.split("T")[0] || row.start_date,
      completion_date: row.completion_date?.toISOString?.()?.split("T")[0] || row.completion_date,
    }));

    return NextResponse.json({
      studies,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Database error", studies: [], total: 0 },
      { status: 500 }
    );
  }
}
