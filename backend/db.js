require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const xlsx = require("xlsx");

const isMySQL = process.env.DB_TYPE === "mysql" || Boolean(process.env.MYSQL_HOST);

let pool;

if (isMySQL) {
  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch (e) {
    console.error("mysql2 package not found. Run 'npm install mysql2' in backend.");
  }

  const mysqlPool = mysql
    ? mysql.createPool({
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "hsi_qr_db",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        decimalNumbers: true,
      })
    : null;

  pool = {
    async query(sqlText, params = []) {
      if (!mysqlPool) throw new Error("MySQL pool not initialized");

      // Convert Postgres placeholders ($1, $2, ...) to MySQL (?)
      let mysqlSql = sqlText.replace(/\$\d+/g, "?");

      // Convert date casting e.g. scanned_at::date -> DATE(scanned_at)
      mysqlSql = mysqlSql.replace(/([a-zA-Z0-9_]+)::date/gi, "DATE($1)");

      // Strip Postgres cast types (::int, ::text, ::date, etc.)
      mysqlSql = mysqlSql.replace(/::(int|text|date|integer|varchar)/gi, "");

      // Strip RESTART IDENTITY
      mysqlSql = mysqlSql.replace(/RESTART\s+IDENTITY/gi, "");

      // Handle RETURNING in statements
      const isInsert = /^\s*INSERT\s+INTO/i.test(mysqlSql);
      const isUpdate = /^\s*UPDATE\s+/i.test(mysqlSql);
      const hasReturning = /RETURNING\s+([a-zA-Z0-9_, *]+)/i.test(mysqlSql);
      if (hasReturning) {
        mysqlSql = mysqlSql.replace(/RETURNING\s+([a-zA-Z0-9_, *]+)/i, "");
      }

      // Handle multi-table TRUNCATE in MySQL: TRUNCATE TABLE logs, label_logs
      if (/^\s*TRUNCATE\s+TABLE\s+([^;]+)/i.test(mysqlSql)) {
        const match = mysqlSql.match(/^\s*TRUNCATE\s+TABLE\s+([^;]+)/i);
        const tables = match[1].split(",").map((t) => t.trim());
        if (tables.length > 1) {
          for (const tbl of tables) {
            await mysqlPool.query(`TRUNCATE TABLE ${tbl}`);
          }
          return { rows: [], rowCount: 0 };
        }
      }

      const [res] = await mysqlPool.query(mysqlSql, params);

      if (isInsert && hasReturning && res.insertId) {
        const tableNameMatch = mysqlSql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          const [insertedRows] = await mysqlPool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [res.insertId]);
          return { rows: insertedRows, rowCount: 1 };
        }
      }

      if (isUpdate && hasReturning) {
        const tableNameMatch = mysqlSql.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
        if (tableNameMatch && params.length > 0) {
          const tableName = tableNameMatch[1];
          const id = params[0];
          const [updatedRows] = await mysqlPool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
          return { rows: updatedRows, rowCount: updatedRows.length };
        }
      }

      if (Array.isArray(res)) {
        return { rows: res, rowCount: res.length };
      }
      return { rows: [], rowCount: res.affectedRows || 0, insertId: res.insertId };
    },
    on() {},
  };
  console.log(`Connected to MySQL Server (${process.env.MYSQL_HOST || "localhost"}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || "hsi_qr_db"})`);
} else {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env — paste your Neon connection string there.");
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });
  pool.on("error", (err) => {
    console.warn("Neon pool idle connection reset:", err.message);
  });
}

// Locate default master Excel file
function getMasterExcelPath() {
  const possiblePaths = [
    path.join(__dirname, "VACUUM HOSE PART LIST.xlsx"),
    path.join(__dirname, "..", "VACUUM HOSE PART LIST.xlsx"),
    path.join(os.homedir(), "Downloads", "VACUUM HOSE PART LIST.xlsx"),
  ];
  return possiblePaths.find((p) => fs.existsSync(p));
}

async function initDb() {
  if (isMySQL) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_parts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sl_no VARCHAR(100),
        model_no VARCHAR(150) NOT NULL,
        part_name VARCHAR(255) NOT NULL DEFAULT '',
        part_no VARCHAR(150) NOT NULL,
        sub_part_no VARCHAR(150) NOT NULL,
        alc_code VARCHAR(100) DEFAULT '',
        remarks TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_name VARCHAR(255) NOT NULL,
        folder_path VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT,
        status VARCHAR(20) NOT NULL,
        model_no VARCHAR(150),
        part_no VARCHAR(150),
        sub_part_no VARCHAR(150),
        alc_code VARCHAR(100),
        operator VARCHAR(100) DEFAULT 'operator',
        shift VARCHAR(50) DEFAULT 'Shift 1',
        trace_number VARCHAR(100),
        pressure VARCHAR(50) DEFAULT '0.850',
        pack_qty VARCHAR(50) DEFAULT '1 / 1',
        remark TEXT,
        printed TINYINT(1) NOT NULL DEFAULT 0,
        sl_no VARCHAR(100),
        composite_code VARCHAR(255),
        scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        printed_at DATETIME NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS label_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sl_no VARCHAR(100),
        model_no VARCHAR(150),
        part_no VARCHAR(150),
        sub_part_no VARCHAR(150),
        part_name VARCHAR(255),
        alc_code VARCHAR(100),
        composite_code VARCHAR(255),
        batch_code VARCHAR(100),
        qr_file VARCHAR(255),
        printed_by VARCHAR(100) DEFAULT 'operator',
        printed TINYINT(1) DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL DEFAULT 'Pass@123',
        full_name VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
        line_assigned VARCHAR(100) DEFAULT 'Line 2',
        shift_assigned VARCHAR(100) DEFAULT 'Shift 1',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL
      )
    `);
    try {
      const { rows: uRows } = await pool.query("SELECT COUNT(*) as count FROM system_users");
      const count = Number(uRows[0]?.count || 0);
      if (count === 0) {
        await pool.query(`
          INSERT IGNORE INTO system_users (username, password, full_name, role, line_assigned, shift_assigned, status)
          VALUES 
            ('admin', 'Admin@123', 'System Administrator', 'ADMIN', 'All Lines', 'All Shifts', 'ACTIVE'),
            ('operator', 'Operator@123', 'Line 2 Operator', 'OPERATOR', 'Line 2', 'Shift 1', 'ACTIVE'),
            ('supervisor', 'Super@123', 'Line Supervisor', 'SUPERVISOR', 'Line 2', 'Shift 2', 'ACTIVE'),
            ('quality', 'Quality@123', 'Quality Assurance Inspector', 'QUALITY_INSPECTOR', 'Line 1', 'Shift 1', 'ACTIVE')
        `);
      }
    } catch (e) {}
    try {
      await seedDefaultMasterData();
    } catch (e) {
      console.warn("Could not seed default master data for MySQL:", e.message);
    }
    return;
  }

  // 1. Master Parts Table (Uploaded by Master Admin)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_parts (
      id SERIAL PRIMARY KEY,
      sl_no TEXT,
      model_no TEXT NOT NULL,
      part_name TEXT NOT NULL DEFAULT '',
      part_no TEXT NOT NULL,
      sub_part_no TEXT NOT NULL,
      alc_code TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 2. Inspection Logs (OK / NG images found during scan)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      folder_name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      status TEXT NOT NULL,          -- 'OK' or 'NG'
      model_no TEXT,
      part_no TEXT,
      sub_part_no TEXT,
      printed BOOLEAN NOT NULL DEFAULT FALSE,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      printed_at TIMESTAMPTZ
    )
  `);

  // Ensure extra columns exist on logs if table already existed
  try {
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS file_path TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS model_no TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS part_no TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS sub_part_no TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS alc_code TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS operator TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS shift TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS trace_number TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS pressure TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS sl_no TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS composite_code TEXT`);
    await pool.query(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS remark TEXT`);
  } catch (e) {}

  // 3. 100x30 Label Generation & Print Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS label_logs (
      id SERIAL PRIMARY KEY,
      sl_no TEXT,
      model_no TEXT,
      part_no TEXT,
      sub_part_no TEXT,
      part_name TEXT,
      alc_code TEXT,
      composite_code TEXT,
      batch_code TEXT,
      qr_file TEXT,
      printed_by TEXT DEFAULT 'operator',
      printed BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Legacy logs table compatibility
  await pool.query(`
    CREATE TABLE IF NOT EXISTS part_qr_logs (
      id SERIAL PRIMARY KEY,
      batch_name TEXT NOT NULL DEFAULT 'MASTER PART LIST',
      sl_no TEXT,
      model TEXT,
      part_no TEXT NOT NULL,
      part_name TEXT,
      alc_code TEXT,
      remarks TEXT,
      qr_code_file TEXT,
      printed BOOLEAN NOT NULL DEFAULT FALSE,
      printed_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      printed_at TIMESTAMPTZ
    )
  `);

  // 4. System Users & Role Permissions Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'Pass@123',
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'OPERATOR',
      line_assigned TEXT DEFAULT 'Line 2',
      shift_assigned TEXT DEFAULT 'Shift 1',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login TIMESTAMPTZ
    )
  `);

  // Seed default system users if table is empty
  try {
    const { rows: uRows } = await pool.query("SELECT COUNT(*)::int as count FROM system_users");
    if (uRows[0].count === 0) {
      await pool.query(`
        INSERT INTO system_users (username, password, full_name, role, line_assigned, shift_assigned, status)
        VALUES 
          ('admin', 'Admin@123', 'System Administrator', 'ADMIN', 'All Lines', 'All Shifts', 'ACTIVE'),
          ('operator', 'Operator@123', 'Line 2 Operator', 'OPERATOR', 'Line 2', 'Shift 1', 'ACTIVE'),
          ('supervisor', 'Super@123', 'Line Supervisor', 'SUPERVISOR', 'Line 2', 'Shift 2', 'ACTIVE'),
          ('quality', 'Quality@123', 'Quality Assurance Inspector', 'QUALITY_INSPECTOR', 'Line 1', 'Shift 1', 'ACTIVE')
      `);
      console.log("Seeded default system users (admin, operator, supervisor, quality).");
    }
  } catch (err) {
    console.warn("Could not seed system_users:", err.message);
  }
}

async function seedDefaultMasterData() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*)::int as count FROM master_parts");
    if (rows[0].count === 0) {
      const masterPath = getMasterExcelPath();
      if (masterPath && fs.existsSync(masterPath)) {
        const wb = xlsx.readFile(masterPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i] || [];
          const rowStr = row.map((c) => String(c || "").toUpperCase()).join(" ");
          if (row.length >= 3 && rowStr.includes("PART") && rowStr.includes("MODEL")) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx !== -1) {
          const header = (rawData[headerIdx] || []).map((c) => String(c || "").trim().toUpperCase());
          const slIdx = header.findIndex((h) => h.includes("SL"));
          const modelIdx = header.findIndex((h) => h.includes("MODEL"));
          const partNoIdx = header.findIndex((h) => h.includes("PART NO") || h.includes("PART NUMBER"));
          const partNameIdx = header.findIndex((h) => h.includes("PART NAME"));
          const alcIdx = header.findIndex((h) => h.includes("ALC"));
          const remarksIdx = header.findIndex((h) => h.includes("REMARK"));

          for (let i = headerIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || !row.length) continue;
            const partNo = partNoIdx !== -1 && row[partNoIdx] ? String(row[partNoIdx]).trim() : "";
            if (!partNo || partNo.toUpperCase().startsWith("TOTAL")) continue;

            const slNo = slIdx !== -1 && row[slIdx] ? String(row[slIdx]).trim() : String(i - headerIdx);
            const modelNo = modelIdx !== -1 && row[modelIdx] ? String(row[modelIdx]).trim() : "GENERAL";
            const partName = partNameIdx !== -1 && row[partNameIdx] ? String(row[partNameIdx]).trim() : (partNo || "PART");
            const alcCode = alcIdx !== -1 && row[alcIdx] ? String(row[alcIdx]).trim() : "";
            const remarks = remarksIdx !== -1 && row[remarksIdx] ? String(row[remarksIdx]).trim() : "";
            const subPartNo = partNo;

            await pool.query(
              `INSERT INTO master_parts (sl_no, model_no, part_name, part_no, sub_part_no, alc_code, remarks)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [slNo, modelNo, partName, partNo, subPartNo, alcCode, remarks]
            );
          }
          console.log("Seeded default master data from VACUUM HOSE PART LIST.xlsx");
        }
      }
    }
  } catch (err) {
    console.warn("Notice during master data seeding:", err.message);
  }
}

// Log inspection event with full real-time operational traceability
async function insertLog({
  folderName,
  folderPath,
  fileName,
  filePath,
  status,
  modelNo,
  partNo,
  subPartNo,
  alcCode,
  operator,
  shift,
  traceNumber,
  pressure,
  packQty,
  remark,
  printed,
  slNo,
}) {
  const isOk = status === "OK" || status === "PASS";
  const defPressure = pressure !== undefined && pressure !== null && pressure !== "" ? String(pressure) : (isOk ? "0.850" : "0.000");
  const defOperator = operator || "operator";
  const defShift = shift || "Shift 1";
  const defPackQty = packQty || (isOk ? "1 / 1" : "0 / 1");
  const defRemark = remark || (isOk ? "Verified OK" : "Defect / NG Detected");

  const res = await pool.query(
    `INSERT INTO logs (
      folder_name, folder_path, file_name, file_path, status,
      model_no, part_no, sub_part_no, alc_code,
      operator, shift, trace_number, pressure, pack_qty, remark,
      printed, printed_at, sl_no
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CASE WHEN $16 THEN NOW() ELSE NULL END, $17)
    RETURNING *`,
    [
      folderName,
      folderPath,
      fileName,
      filePath || null,
      isOk ? "OK" : "NG",
      modelNo || null,
      partNo || null,
      subPartNo || null,
      alcCode || null,
      defOperator,
      defShift,
      traceNumber || null,
      defPressure,
      defPackQty,
      defRemark,
      !!printed,
      slNo || null,
    ]
  );
  return res.rows[0];
}

async function markPrinted(folderPath, fileNames) {
  for (const name of fileNames) {
    await pool.query(
      `UPDATE logs SET printed = TRUE, printed_at = NOW()
       WHERE id = (
         SELECT id FROM logs
         WHERE folder_path = $1 AND file_name = $2 AND printed = FALSE
         ORDER BY scanned_at DESC LIMIT 1
       )`,
      [folderPath, name]
    );
  }
}

async function getDailyReport(date) {
  const { rows } = await pool.query(
    `
    SELECT
      folder_name,
      folder_path,
      SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END)::int AS ok_count,
      SUM(CASE WHEN status = 'NG' THEN 1 ELSE 0 END)::int AS ng_count,
      SUM(CASE WHEN status = 'OK' AND printed THEN 1 ELSE 0 END)::int AS ok_printed_count
    FROM logs
    WHERE scanned_at::date = $1
    GROUP BY folder_name, folder_path
    ORDER BY folder_path
    `,
    [date]
  );
  return rows;
}

// 100x30 Label log
async function insertLabelLog({ slNo, modelNo, partNo, subPartNo, partName, alcCode, compositeCode, batchCode, qrFile, printedBy }) {
  const res = await pool.query(
    `INSERT INTO label_logs (sl_no, model_no, part_no, sub_part_no, part_name, alc_code, composite_code, batch_code, qr_file, printed_by, printed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
     RETURNING *`,
    [slNo, modelNo, partNo, subPartNo, partName, alcCode, compositeCode, batchCode, qrFile, printedBy || "operator"]
  );
  return res.rows[0];
}

async function getLabelLogs(limit = 100) {
  const { rows } = await pool.query(
    `SELECT * FROM label_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

// Master parts queries
async function getDistinctModels() {
  const { rows } = await pool.query(
    `SELECT DISTINCT model_no, COUNT(id)::int as parts_count
     FROM master_parts
     WHERE model_no IS NOT NULL AND TRIM(model_no) != ''
     GROUP BY model_no
     ORDER BY model_no ASC`
  );
  return rows;
}

async function getPartsByModel(modelNo) {
  const { rows } = await pool.query(
    `SELECT DISTINCT part_no, part_name
     FROM master_parts
     WHERE model_no = $1
     ORDER BY part_no ASC`,
    [modelNo]
  );
  return rows;
}

async function getSubParts(modelNo, partNo) {
  const { rows } = await pool.query(
    `SELECT *
     FROM master_parts
     WHERE model_no = $1 AND (part_no = $2 OR sub_part_no = $2)
     ORDER BY NULLIF(regexp_replace(sl_no, '[^0-9]', '', 'g'), '')::numeric NULLS LAST, sl_no ASC, id ASC`,
    [modelNo, partNo]
  );
  return rows;
}

async function getAllMasterParts() {
  const { rows } = await pool.query(
    `SELECT * FROM master_parts ORDER BY model_no ASC, NULLIF(regexp_replace(sl_no, '[^0-9]', '', 'g'), '')::numeric NULLS LAST, sl_no ASC, id ASC`
  );
  return rows;
}

async function insertMasterPart({ slNo, modelNo, partName, partNo, subPartNo, alcCode, remarks }) {
  const res = await pool.query(
    `INSERT INTO master_parts (sl_no, model_no, part_name, part_no, sub_part_no, alc_code, remarks)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [slNo || null, modelNo, partName, partNo, subPartNo, alcCode || "", remarks || ""]
  );
  return res.rows[0];
}

async function clearMasterParts() {
  await pool.query(`TRUNCATE TABLE master_parts RESTART IDENTITY`);
}

async function clearAllLogs() {
  await pool.query(`TRUNCATE TABLE logs, label_logs RESTART IDENTITY`);
}

// Dashboard statistics
async function getDashboardStats() {
  const masterStats = await pool.query(`
    SELECT
      COUNT(DISTINCT model_no)::int AS total_models,
      COUNT(DISTINCT part_no)::int AS total_part_no,
      COUNT(DISTINCT part_name)::int AS total_part_name,
      COUNT(id)::int AS total_master_parts
    FROM master_parts
  `);

  const inspectionStats = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END), 0)::int AS total_ok_parts,
      COALESCE(SUM(CASE WHEN status = 'NG' THEN 1 ELSE 0 END), 0)::int AS total_ng_parts,
      COUNT(id)::int AS total_inspections
    FROM logs
  `);

  const todayLabelStats = await pool.query(`
    SELECT COUNT(id)::int AS total_label_generated_today
    FROM label_logs
    WHERE created_at::date = CURRENT_DATE
  `);

  const recentLabels = await pool.query(
    `SELECT * FROM label_logs ORDER BY created_at DESC LIMIT 5`
  );

  const recentInspections = await pool.query(
    `SELECT * FROM logs ORDER BY scanned_at DESC LIMIT 5`
  );

  return {
    success: true,
    total_models: masterStats.rows[0]?.total_models || 0,
    total_part_no: masterStats.rows[0]?.total_part_no || 0,
    total_part_name: masterStats.rows[0]?.total_part_name || 0,
    total_master_parts: masterStats.rows[0]?.total_master_parts || 0,
    total_ok_parts: inspectionStats.rows[0]?.total_ok_parts || 0,
    total_ng_parts: inspectionStats.rows[0]?.total_ng_parts || 0,
    total_label_generated_today: todayLabelStats.rows[0]?.total_label_generated_today || 0,
    recent_labels: recentLabels.rows,
    recent_inspections: recentInspections.rows,
  };
}

// ========================================================
// USER MANAGEMENT & ROLE PERMISSION QUERIES
// ========================================================
async function getAllUsers() {
  const { rows } = await pool.query(`
    SELECT id, username, full_name, role, line_assigned, shift_assigned, status, created_at, last_login
    FROM system_users
    ORDER BY id ASC
  `);
  return rows;
}

async function createUser({ username, password, full_name, role, line_assigned, shift_assigned, status = 'ACTIVE' }) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || 'Pass@123').trim();
  const cleanRole = String(role || 'OPERATOR').trim().toUpperCase();

  const { rows } = await pool.query(
    `INSERT INTO system_users (username, password, full_name, role, line_assigned, shift_assigned, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, username, full_name, role, line_assigned, shift_assigned, status, created_at`,
    [cleanUsername, cleanPass, full_name || '', cleanRole, line_assigned || 'Line 2', shift_assigned || 'Shift 1', status]
  );
  return rows[0];
}

async function updateUser(id, { full_name, role, line_assigned, shift_assigned, status }) {
  const { rows } = await pool.query(
    `UPDATE system_users
     SET full_name = COALESCE($2, full_name),
         role = COALESCE($3, role),
         line_assigned = COALESCE($4, line_assigned),
         shift_assigned = COALESCE($5, shift_assigned),
         status = COALESCE($6, status)
     WHERE id = $1
     RETURNING id, username, full_name, role, line_assigned, shift_assigned, status, created_at, last_login`,
    [id, full_name, role ? role.toUpperCase() : null, line_assigned, shift_assigned, status]
  );
  return rows[0];
}

async function updateUserPassword(id, newPassword) {
  const { rows } = await pool.query(
    `UPDATE system_users
     SET password = $2
     WHERE id = $1
     RETURNING id, username, role`,
    [id, String(newPassword).trim()]
  );
  return rows[0];
}

async function deleteUser(id) {
  // Prevent deleting primary admin
  const check = await pool.query("SELECT username FROM system_users WHERE id = $1", [id]);
  if (check.rows.length > 0 && check.rows[0].username.toLowerCase() === 'admin') {
    throw new Error("The default system 'admin' user cannot be deleted.");
  }
  const res = await pool.query("DELETE FROM system_users WHERE id = $1 RETURNING id, username", [id]);
  return res.rows[0];
}

async function authenticateUser(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT id, username, full_name, role, line_assigned, shift_assigned, status, password
     FROM system_users
     WHERE LOWER(username) = LOWER($1)`,
    [cleanUsername]
  );

  if (rows.length === 0) return null;
  const user = rows[0];
  if (user.status === 'INACTIVE') {
    throw new Error("User account is inactive. Please contact your system administrator.");
  }
  if (user.password !== password) {
    return null;
  }

  // Update last_login
  await pool.query("UPDATE system_users SET last_login = NOW() WHERE id = $1", [user.id]);

  const { password: _, ...userSafe } = user;
  return userSafe;
}

module.exports = {
  pool,
  initDb,
  insertLog,
  markPrinted,
  getDailyReport,
  insertLabelLog,
  getLabelLogs,
  getDistinctModels,
  getPartsByModel,
  getSubParts,
  getAllMasterParts,
  insertMasterPart,
  clearMasterParts,
  clearAllLogs,
  getDashboardStats,
  getAllUsers,
  createUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  authenticateUser,
};
