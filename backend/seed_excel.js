const xlsx = require("xlsx");
const path = require("path");
const { pool, initDb } = require("./db.js");

async function seed() {
  await initDb();
  const filePath = path.join(__dirname, "..", "VACUUM HOSE PART LIST.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let inserted = 0;
  // Clear any partial data first
  await pool.query("TRUNCATE TABLE master_parts RESTART IDENTITY");

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const slNo = String(r[0] || inserted + 1).trim();
    const modelNo = String(r[1] || "SU2B").trim();
    const partNo = String(r[2]).trim();
    const partName = String(r[3] || "VACUUM HOSE").trim();
    const alcCode = String(r[4] || "").trim();
    const remarks = String(r[5] || "").trim();
    const subPartNo = partNo;

    await pool.query(
      `INSERT INTO master_parts (sl_no, model_no, part_name, part_no, sub_part_no, alc_code, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [slNo, modelNo, partName, partNo, subPartNo, alcCode, remarks]
    );
    inserted++;
  }

  const res = await pool.query("SELECT COUNT(*)::int as parts, COUNT(DISTINCT model_no)::int as models FROM master_parts");
  console.log(`Inserted ${inserted} parts. DB Stats:`, res.rows[0]);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
