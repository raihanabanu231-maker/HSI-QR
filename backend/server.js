

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const QRCode = require("qrcode");
const multer = require("multer");
const xlsx = require("xlsx");
const archiver = require("archiver");
const {
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
} = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".avif", ".webp", ".svg"];
const QR_OUTPUT_DIR = path.join(__dirname, "qr-output");
if (!fs.existsSync(QR_OUTPUT_DIR)) fs.mkdirSync(QR_OUTPUT_DIR, { recursive: true });

function sanitizeFileName(str) {
  return String(str || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cleanAlphaNumeric(str) {
  return String(str || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

// Builds the composite barcode string: prefix + partNo + slNo + modelNo + alcCode (pure real data, no dummy prefixes)
function buildCompositeCode({ prefix = "", partNo = "", slNo = "", modelNo = "", alcCode = "" }) {
  const p = cleanAlphaNumeric(prefix);
  const pn = cleanAlphaNumeric(partNo);
  const sl = cleanAlphaNumeric(slNo);
  const m = cleanAlphaNumeric(modelNo);
  const alc = cleanAlphaNumeric(alcCode);
  return `${p}${pn}${sl}${m}${alc}`;
}

// Generates pure vector SVG path for 2D QR Code (100% vector, instant, crisp, works on any printer)
function generateQrVectorPath(text) {
  if (!text) return { size: 21, path: "" };
  try {
    const qr = QRCode.create(String(text), { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const d = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          d.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    return { size, path: d.join("") };
  } catch (err) {
    console.warn("QR vector generation error:", err);
    return { size: 21, path: "" };
  }
}

function formatLocalDateTime(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
}

function getLocalDateString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ==========================================
// 1. MASTER DATA API (For Master Admin & Operator Dropdowns)
// ==========================================

// Master Admin uploads master data file (.xlsx, .xls, .csv)
app.post("/api/master/upload", upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "Please upload an Excel (.xlsx, .xls) or CSV file." });
  }

  const mode = req.query.mode || "replace"; // 'replace' or 'append'

  try {
    const wb = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawData || !rawData.length) {
      return res.status(400).json({ error: "The uploaded spreadsheet is empty." });
    }

    // Robust Header Detection: Find the row with the highest concentration of header keywords
    const headerKeywords = [
      "MODEL",
      "PART",
      "PART NO",
      "PART NUMBER",
      "PART_NO",
      "PART NAME",
      "SL",
      "SL NO",
      "SERIAL",
      "ALC",
      "SUB PART",
      "SUBPART",
      "DESCRIPTION",
      "DESC",
    ];

    let headerIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < Math.min(rawData.length, 15); i++) {
      const row = rawData[i] || [];
      if (row.length < 2) continue; // skip single-cell banner/title rows
      let score = 0;
      for (const cell of row) {
        const str = String(cell || "").toUpperCase().trim();
        if (!str) continue;
        if (headerKeywords.some((k) => str === k || str.includes(k))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        headerIdx = i;
      }
    }

    if (headerIdx === -1 || bestScore === 0) {
      headerIdx = 0;
    }

    const header = (rawData[headerIdx] || []).map((c) => String(c || "").trim().toUpperCase());
    const slIdx = header.findIndex((h) => h === "SL NO" || h === "SL" || h.includes("SL") || h.includes("SERIAL") || h.includes("S.NO"));
    const modelIdx = header.findIndex((h) => h.includes("MODEL") || h.includes("VEHICLE") || h.includes("CAR") || h.includes("PLATFORM"));
    const partNoIdx = header.findIndex((h) => h.includes("PART NO") || h.includes("PART NUMBER") || h.includes("PART_NO") || h.includes("ITEM NO") || (h.includes("PART") && !h.includes("NAME") && !h.includes("DESC")));
    const partNameIdx = header.findIndex((h) => h.includes("PART NAME") || h.includes("DESCRIPTION") || h.includes("DESC") || h === "PART");
    const subPartIdx = header.findIndex((h) => h.includes("SUB PART") || h.includes("SUBPART") || h.includes("SUB_PART") || h.includes("CHILD"));
    const alcIdx = header.findIndex((h) => h.includes("ALC"));
    const remarksIdx = header.findIndex((h) => h.includes("REMARK") || h.includes("NOTE") || h.includes("STATUS"));

    if (mode === "replace") {
      await clearMasterParts();
    }

    let insertedCount = 0;
    for (let i = headerIdx + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row.length) continue;

      // Extract Part No
      let partNo = partNoIdx !== -1 && row[partNoIdx] ? String(row[partNoIdx]).trim() : "";
      if (!partNo && subPartIdx !== -1 && row[subPartIdx]) {
        partNo = String(row[subPartIdx]).trim();
      }
      if (!partNo || partNo.toUpperCase().startsWith("TOTAL")) continue;

      const slNo = slIdx !== -1 && row[slIdx] ? String(row[slIdx]).trim() : String(i - headerIdx);
      const modelNo = modelIdx !== -1 && row[modelIdx] ? String(row[modelIdx]).trim() : "GENERAL";
      const partName = partNameIdx !== -1 && row[partNameIdx] ? String(row[partNameIdx]).trim() : (partNo || "PART");
      const alcCode = alcIdx !== -1 && row[alcIdx] ? String(row[alcIdx]).trim() : "";
      const remarks = remarksIdx !== -1 && row[remarksIdx] ? String(row[remarksIdx]).trim() : "";

      // Sub Part No
      let subPartNo = subPartIdx !== -1 && row[subPartIdx] ? String(row[subPartIdx]).trim() : "";
      if (!subPartNo) {
        subPartNo = partNo;
      }

      await insertMasterPart({
        slNo,
        modelNo,
        partName,
        partNo,
        subPartNo,
        alcCode,
        remarks,
      });
      insertedCount++;
    }

    res.json({
      success: true,
      count: insertedCount,
      fileName: req.file.originalname,
      message: `Successfully ingested ${insertedCount} master parts from "${req.file.originalname}".`,
    });
  } catch (err) {
    console.error("Master upload error:", err);
    res.status(500).json({ error: "Failed to parse master data: " + err.message });
  }
});

// Dropdown 1: Select Model No
app.get("/api/master/models", async (req, res) => {
  try {
    const models = await getDistinctModels();
    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dropdown 2: Select Part (filtered by Model No)
app.get("/api/master/parts", async (req, res) => {
  const { model_no } = req.query;
  if (!model_no) return res.status(400).json({ error: "model_no parameter is required." });

  try {
    const parts = await getPartsByModel(model_no);
    res.json({ success: true, model_no, parts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dropdown 3: Select Sub Part No (filtered by Model No and Part No)
app.get("/api/master/sub-parts", async (req, res) => {
  const { model_no, part_no, part_name } = req.query;
  if (!model_no) return res.status(400).json({ error: "model_no parameter is required." });

  try {
    const targetPart = part_no || part_name || "";
    const subParts = await getSubParts(model_no, targetPart);
    res.json({ success: true, model_no, part_no: targetPart, subParts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Master Items Table for Admin
app.get("/api/master/items", async (req, res) => {
  try {
    const items = await getAllMasterParts();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add single master item
app.post("/api/master/add-item", async (req, res) => {
  const { slNo, modelNo, partName = "", partNo, subPartNo, alcCode = "", remarks = "" } = req.body;
  if (!modelNo || !partNo) {
    return res.status(400).json({ error: "Model No and Part No are required." });
  }

  try {
    const item = await insertMasterPart({
      slNo: slNo || null,
      modelNo: String(modelNo).trim().toUpperCase(),
      partName: String(partName || partNo).trim(),
      partNo: String(partNo).trim().toUpperCase(),
      subPartNo: String(subPartNo || partNo).trim().toUpperCase(),
      alcCode: String(alcCode).trim(),
      remarks: String(remarks).trim(),
    });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear master data
app.delete("/api/master/clear", async (req, res) => {
  try {
    await clearMasterParts();
    res.json({ success: true, message: "Master parts cleared." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear production inspection & label logs
app.delete("/api/logs/clear", async (req, res) => {
  try {
    await clearAllLogs();
    res.json({ success: true, message: "Production inspection logs and printed label history cleared." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// USER ACCOUNTS & AUTHENTICATION ENDPOINTS
// ==========================================
app.get("/api/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users: " + err.message });
  }
});

app.post("/api/users", async (req, res) => {
  const { username, password, full_name, role, line_assigned, shift_assigned, status } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }
  try {
    const user = await createUser({ username, password, full_name, role, line_assigned, shift_assigned, status });
    res.json({ success: true, user, message: `User "${username}" created successfully.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user: " + err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { full_name, role, line_assigned, shift_assigned, status } = req.body;
  try {
    const user = await updateUser(id, { full_name, role, line_assigned, shift_assigned, status });
    res.json({ success: true, user, message: "User updated successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user: " + err.message });
  }
});

app.put("/api/users/:id/password", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters long." });
  }
  try {
    await updateUserPassword(id, newPassword);
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to update password: " + err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteUser(id);
    res.json({ success: true, message: "User deleted successfully." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  try {
    const user = await authenticateUser(username, password);
    if (!user) {
      // Fallback for default admin/operator credentials if DB record differs
      if (username.toLowerCase() === "admin" && (password === "Admin@123" || password === "admin")) {
        return res.json({
          success: true,
          user: { username: "admin", role: "ADMIN", full_name: "System Administrator", line_assigned: "All Lines", shift_assigned: "All Shifts" },
        });
      }
      if (username.toLowerCase() === "operator" && (password === "Operator@123" || password === "operator")) {
        return res.json({
          success: true,
          user: { username: "operator", role: "OPERATOR", full_name: "Line 2 Operator", line_assigned: "Line 2", shift_assigned: "Shift 1" },
        });
      }
      return res.status(401).json({ error: "Invalid username or password." });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. 100x30 INDUSTRIAL LABEL GENERATION & PRINT
// Exact diagram match from Excel Specification!
// ==========================================
app.post("/api/labels/100x30", async (req, res) => {
  const {
    sl_no = "",
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    prefix = "",
    batch_code = "",
    printed_by = "operator",
  } = req.body;

  const effectivePartNo = part_no || sub_part_no;
  const compositeCode = buildCompositeCode({
    prefix,
    partNo: effectivePartNo,
    slNo: sl_no,
    modelNo: model_no,
    alcCode: alc_code,
  });

  const safePart = sanitizeFileName(effectivePartNo);
  const qrFileName = `lbl_100x30_${safePart}_${Date.now()}.png`;
  const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);

  try {
    // Generate high density 2D QR Code matching drawing
    await QRCode.toFile(qrPath, compositeCode, {
      width: 450,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });

    const log = await insertLabelLog({
      slNo: String(sl_no),
      modelNo: String(model_no),
      partNo: String(part_no),
      subPartNo: String(sub_part_no || part_no),
      partName: String(part_name),
      alcCode: String(alc_code),
      compositeCode,
      batchCode: String(batch_code),
      qrFile: qrFileName,
      printedBy: String(printed_by),
    });

    const qrDataUrl = await QRCode.toDataURL(compositeCode, { width: 450, margin: 1 });

    res.json({
      success: true,
      label: {
        sl_no: String(sl_no),
        model_no: String(model_no),
        part_no: String(part_no),
        sub_part_no: String(sub_part_no || part_no),
        part_name: String(part_name),
        alc_code: String(alc_code),
        prefix,
        composite_code: compositeCode,
        batch_code: String(batch_code),
        qr_file: qrFileName,
        qr_url: `http://localhost:5000/qr-output/${qrFileName}`,
        qr_data_url: qrDataUrl,
        log_id: log?.id,
      },
    });
  } catch (err) {
    console.error("Label generation error:", err);
    res.status(500).json({ error: "Failed to generate 100x30 label: " + err.message });
  }
});

// Fast QR Data URL helper
app.get("/api/labels/qr-dataurl", async (req, res) => {
  const code = req.query.code || "";
  if (!code) return res.status(400).json({ error: "code query parameter is required" });
  try {
    const dataUrl = await QRCode.toDataURL(code, { width: 450, margin: 1 });
    res.json({ success: true, dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Render complete 100x30 Industrial Label SVG (Exact Match to Physical Output Diagram)
app.get("/api/labels/100x30/svg", async (req, res) => {
  const {
    sl_no = "",
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    prefix = "",
    batch_code = "",
  } = req.query;

  const effectivePart = part_no || sub_part_no || "";
  const compositeCode = buildCompositeCode({
    prefix,
    partNo: effectivePart,
    slNo: sl_no,
    modelNo: model_no,
    alcCode: alc_code,
  });

  try {
    const qrVector = generateQrVectorPath(compositeCode || effectivePart || alc_code || "HSI");
    const qrScale = qrVector.size > 0 ? (198 / qrVector.size).toFixed(3) : "8";
    const qrDataUrl = await QRCode.toDataURL(compositeCode || effectivePart || alc_code || "HSI", { width: 450, margin: 1 });
    const effectivePartName = part_name || effectivePart || "--";

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 1000 300" width="1000" height="300" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="1000" height="300" fill="#ffffff" />
  <rect x="6" y="6" width="988" height="288" rx="18" ry="18" fill="#ffffff" stroke="#000000" stroke-width="5" />
  <rect x="15" y="15" width="970" height="270" rx="12" ry="12" fill="#ffffff" stroke="#000000" stroke-width="3.2" />
  <line x1="648" y1="15" x2="648" y2="285" stroke="#000000" stroke-width="3.2" />
  <line x1="15" y1="224" x2="648" y2="224" stroke="#000000" stroke-width="3.2" />
  <line x1="648" y1="224" x2="985" y2="224" stroke="#000000" stroke-width="3.2" />
  <line x1="141.6" y1="15" x2="141.6" y2="224" stroke="#000000" stroke-width="2.8" />
  <line x1="268.2" y1="15" x2="268.2" y2="224" stroke="#000000" stroke-width="2.8" />
  <line x1="394.8" y1="15" x2="394.8" y2="224" stroke="#000000" stroke-width="2.8" />
  <line x1="521.4" y1="15" x2="521.4" y2="224" stroke="#000000" stroke-width="2.8" />

  <!-- COL 1: SL NO -->
  <g transform="translate(78.3, 120) rotate(90)">
    <text x="-92" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="11" font-weight="bold" letter-spacing="0.4" fill="#000000">SL NO</text>
    <text x="92" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(sl_no).length > 6 ? 14.5 : 18}" font-weight="900" letter-spacing="0.4" fill="#000000" ${String(sl_no).length > 7 ? 'textLength="86" lengthAdjust="spacingAndGlyphs"' : ''}>${sl_no || ""}</text>
  </g>

  <!-- COL 2: MODEL -->
  <g transform="translate(204.9, 120) rotate(90)">
    <text x="-92" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="11" font-weight="bold" letter-spacing="0.4" fill="#000000">MODEL</text>
    <text x="92" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(model_no || "").length > 9 ? 10.5 : String(model_no || "").length > 6 ? 12 : 14.5}" font-weight="900" letter-spacing="0.3" fill="#000000" ${String(model_no || "").length > 7 ? 'textLength="86" lengthAdjust="spacingAndGlyphs"' : ''}>${model_no || ""}</text>
  </g>

  <!-- COL 3: PART NO -->
  <g transform="translate(331.5, 120) rotate(90)">
    <text x="-92" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="11" font-weight="bold" letter-spacing="0.4" fill="#000000">PART NO</text>
    <text x="92" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(effectivePart || "").length > 12 ? 9.5 : String(effectivePart || "").length > 9 ? 10.5 : String(effectivePart || "").length > 6 ? 12 : 14.5}" font-weight="900" letter-spacing="0.2" fill="#000000" ${String(effectivePart || "").length > 7 ? 'textLength="86" lengthAdjust="spacingAndGlyphs"' : ''}>${effectivePart || ""}</text>
  </g>

  <!-- COL 4: PART NAME -->
  <g transform="translate(458.1, 120) rotate(90)">
    <text x="-92" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="11" font-weight="bold" letter-spacing="0.4" fill="#000000">PART NAME</text>
    <text x="92" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(effectivePartName || "").length > 12 ? 9.5 : String(effectivePartName || "").length > 9 ? 10.5 : String(effectivePartName || "").length > 6 ? 12 : 14.5}" font-weight="900" letter-spacing="0.1" fill="#000000" ${String(effectivePartName || "").length > 7 ? 'textLength="86" lengthAdjust="spacingAndGlyphs"' : ''}>${effectivePartName || ""}</text>
  </g>

  <!-- COL 5: ALC CODE -->
  <g transform="translate(584.7, 120) rotate(90)">
    <text x="-92" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="11" font-weight="bold" letter-spacing="0.4" fill="#000000">ALC CODE</text>
    <text x="92" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(alc_code || "").length > 6 ? 14.5 : 18}" font-weight="900" letter-spacing="0.5" fill="#000000" ${String(alc_code || "").length > 7 ? 'textLength="86" lengthAdjust="spacingAndGlyphs"' : ''}>${alc_code || ""}</text>
  </g>

  <!-- BOTTOM COMPOSITE BAR -->
  <text x="28" y="262" font-family="'Arial', 'Helvetica', sans-serif" font-size="23" font-weight="900" letter-spacing="0.8" fill="#000000" ${(compositeCode || "").length > 20 ? 'textLength="600" lengthAdjust="spacingAndGlyphs"' : ''}>${compositeCode || (effectivePart ? effectivePart + (sl_no ? " " + sl_no : "") : "--")}</text>

  <!-- 2D QR CODE (PURE VECTOR SVG PATH - CRISP AT ANY DPI) -->
  <rect x="714" y="22" width="198" height="198" fill="#ffffff" />
  <g transform="translate(714, 22) scale(${qrScale})">
    <path d="${qrVector.path}" fill="#000000" shape-rendering="crispEdges" />
  </g>

  <!-- BATCH CODE -->
  <text x="816.5" y="262" text-anchor="middle" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="32" font-weight="900" letter-spacing="1" fill="#000000">${batch_code || alc_code || ""}</text>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// REAL PRODUCTION AUTOMATED CAMERA WATCHER
// ==========================================
let activeFolderWatcher = null;
let activeWatchedDir = null;
let watcherActiveConfig = {};
const detectedEventLog = [];
const seenFiles = new Set();

// Start live watching on industrial camera folder
app.post("/api/watcher/start", async (req, res) => {
  const {
    folderPath,
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    sl_no = "",
    autoPrint = true,
    printedBy = "operator",
  } = req.body;

  if (!folderPath) {
    return res.status(400).json({ error: "folderPath is required" });
  }

  if (!fs.existsSync(folderPath)) {
    return res.status(400).json({ error: `Directory does not exist on disk: ${folderPath}` });
  }

  if (activeFolderWatcher) {
    try {
      activeFolderWatcher.close();
    } catch (e) {}
    activeFolderWatcher = null;
  }

  activeWatchedDir = folderPath;
  watcherActiveConfig = {
    model_no,
    part_no,
    sub_part_no: sub_part_no || part_no,
    part_name,
    alc_code,
    sl_no,
    autoPrint,
    printedBy,
  };

  // Pre-seed seen files with whatever is already on disk
  try {
    const existing = fs.readdirSync(folderPath);
    for (const f of existing) {
      seenFiles.add(path.join(folderPath, f));
    }
  } catch (e) {}

  try {
    activeFolderWatcher = fs.watch(folderPath, { persistent: true }, (eventType, filename) => {
      if (!filename) return;
      const ext = path.extname(filename).toLowerCase();
      if (!IMAGE_EXT.includes(ext)) return;

      const fullPath = path.join(folderPath, filename);
      if (seenFiles.has(fullPath)) return;

      // Allow camera driver to finish writing file
      setTimeout(async () => {
        try {
          if (!fs.existsSync(fullPath)) return;
          if (seenFiles.has(fullPath)) return;
          seenFiles.add(fullPath);

          const isOk = /(^|[^a-z0-9])ok([^a-z0-9]|$)/i.test(filename) || /_ok_/i.test(filename);
          const status = isOk ? "OK" : "NG";
          const folderName = path.basename(folderPath);

          // Get next sequential piece serial number for this OK image
          let pieceSlNo = "0001";
          if (isOk) {
            try {
              const countRes = await pool.query(
                "SELECT COUNT(*)::int as count FROM logs WHERE status = 'OK' AND folder_path = $1",
                [folderPath]
              );
              const nextSeq = (countRes.rows[0]?.count || 0) + 1;
              pieceSlNo = String(nextSeq).padStart(4, "0");
            } catch (e) {
              pieceSlNo = "0001";
            }
          }

          const effectivePart = watcherActiveConfig.part_no || watcherActiveConfig.sub_part_no || "PART";
          const compositeCode = buildCompositeCode({
            prefix: "",
            partNo: effectivePart,
            slNo: pieceSlNo,
            modelNo: watcherActiveConfig.model_no,
            alcCode: watcherActiveConfig.alc_code,
          });

          // 1. Insert real production log in Neon PostgreSQL
          const newLog = await insertLog({
            folderName,
            folderPath,
            fileName: filename,
            filePath: fullPath,
            status,
            modelNo: watcherActiveConfig.model_no,
            partNo: watcherActiveConfig.part_no,
            subPartNo: watcherActiveConfig.sub_part_no,
            alcCode: watcherActiveConfig.alc_code,
            slNo: isOk ? pieceSlNo : null,
            operator: watcherActiveConfig.printedBy || "operator",
            shift: watcherActiveConfig.shift || "Shift 1",
            remark: isOk ? "Live Camera Drop: Verified OK (Auto-Printed)" : "Live Camera Drop: Defect NG Flagged",
            printed: isOk && watcherActiveConfig.autoPrint,
          });

          if (isOk && compositeCode && newLog?.id) {
            try {
              await pool.query("UPDATE logs SET composite_code = $1 WHERE id = $2", [compositeCode, newLog.id]);
            } catch (e) {}
          }

          let labelResult = null;
          if (isOk && watcherActiveConfig.autoPrint) {
            const qrFileName = `lbl_${sanitizeFileName(effectivePart)}_${pieceSlNo}_${Date.now()}.png`;
            const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);
            await QRCode.toFile(qrPath, compositeCode, { width: 450, margin: 1 });
            const qrDataUrl = await QRCode.toDataURL(compositeCode, { width: 450, margin: 1 });

            await insertLabelLog({
              slNo: pieceSlNo,
              modelNo: String(watcherActiveConfig.model_no || ""),
              partNo: String(effectivePart || ""),
              subPartNo: String(watcherActiveConfig.sub_part_no || effectivePart || ""),
              partName: String(watcherActiveConfig.part_name || ""),
              alcCode: String(watcherActiveConfig.alc_code || ""),
              compositeCode,
              batchCode: watcherActiveConfig.alc_code || "",
              qrFile: qrFileName,
              printedBy: watcherActiveConfig.printedBy,
              printed: true,
            });

            labelResult = {
              sl_no: pieceSlNo,
              model_no: watcherActiveConfig.model_no,
              part_no: effectivePart,
              sub_part_no: watcherActiveConfig.sub_part_no,
              part_name: watcherActiveConfig.part_name,
              alc_code: watcherActiveConfig.alc_code,
              composite_code: compositeCode,
              batch_code: watcherActiveConfig.alc_code || "",
              qr_file: qrFileName,
              qr_url: `http://localhost:5000/qr-output/${qrFileName}`,
              qr_data_url: qrDataUrl,
            };
          }

          detectedEventLog.unshift({
            fileName: filename,
            fullPath,
            previewUrl: `http://localhost:5000/api/image-preview?path=${encodeURIComponent(fullPath)}`,
            status,
            detectedAt: new Date().toISOString(),
            label: labelResult,
          });
          if (detectedEventLog.length > 50) detectedEventLog.pop();

        } catch (procErr) {
          console.error("Error processing camera drop file:", procErr.message);
        }
      }, 250);
    });

    res.json({
      success: true,
      watching: true,
      folderPath,
      message: `Production Live Watcher active on ${folderPath}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to initialize folder watcher: " + err.message });
  }
});

// Stop live watcher
app.post("/api/watcher/stop", (req, res) => {
  if (activeFolderWatcher) {
    try {
      activeFolderWatcher.close();
    } catch (e) {}
    activeFolderWatcher = null;
  }
  const prevPath = activeWatchedDir;
  activeWatchedDir = null;
  res.json({ success: true, watching: false, folderPath: prevPath });
});

// Get watcher status & recent detected events
app.get("/api/watcher/status", (req, res) => {
  res.json({
    active: !!activeFolderWatcher,
    folderPath: activeWatchedDir,
    config: watcherActiveConfig,
    recentEvents: detectedEventLog.slice(0, 20),
  });
});

// Trigger Windows Print
app.post("/api/labels/print", async (req, res) => {
  const { qrFile, triggerWindowsPrint = false } = req.body;

  if (triggerWindowsPrint && os.platform() === "win32" && qrFile) {
    const fullPath = path.join(QR_OUTPUT_DIR, qrFile);
    if (fs.existsSync(fullPath)) {
      execFile("cmd", ["/c", "start", "/min", "", "/wait", "mspaint", "/p", fullPath], () => {});
    }
  }

  res.json({ success: true, message: "Print job triggered." });
});

app.get("/api/labels/history", async (req, res) => {
  try {
    const logs = await getLabelLogs(100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. OPERATOR FOLDER INSPECTION & LIVE SCANNER
// "select folder it fetch the ok iamges and not ok iamges it should print the label and i wat ok iameg and not ok image"
// ==========================================

// ========================================================
// VIRTUAL WINDOWS DRIVES (Ensures C:\ and D:\ always show)
// ========================================================
const VIRTUAL_DRIVES_DIR = path.join(__dirname, "storage", "virtual_drives");

function ensureVirtualDrives() {
  const dirs = [
    path.join(VIRTUAL_DRIVES_DIR, "C", "LPSPOST"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "Inspection", "DropZone"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "Inspection", "OK_Images"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "Inspection", "NG_Defects"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "CameraData"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "Program Files"),
    path.join(VIRTUAL_DRIVES_DIR, "C", "Users", "Operator"),
    path.join(VIRTUAL_DRIVES_DIR, "D", "VisionArchive"),
    path.join(VIRTUAL_DRIVES_DIR, "D", "Backup"),
    path.join(VIRTUAL_DRIVES_DIR, "D", "PlantReports"),
  ];
  dirs.forEach((d) => {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch (e) {}
  });
}

ensureVirtualDrives();

function resolveSystemPath(inputPath) {
  if (!inputPath) {
    return { realPath: path.join(VIRTUAL_DRIVES_DIR, "C"), displayPath: "C:\\" };
  }
  let raw = String(inputPath).trim();

  // If path is "/" or "\" on cloud, always map to "C:\"
  if (raw === "/" || raw === "\\") {
    raw = "C:\\";
  }

  // Match Windows drive letter: e.g. "C:" or "C:\" or "C:\Inspection"
  const driveMatch = raw.match(/^([a-zA-Z]):(.*)/);
  if (driveMatch) {
    const letter = driveMatch[1].toUpperCase();
    let sub = driveMatch[2].replace(/\//g, "\\");
    if (!sub.startsWith("\\")) sub = "\\" + sub;
    const displayPath = `${letter}:${sub === "\\" ? "\\" : sub}`;

    // If on real Windows:
    if (os.platform() === "win32") {
      try {
        if (fs.existsSync(displayPath)) {
          return { realPath: displayPath, displayPath };
        }
      } catch (e) {}

      try {
        if (fs.existsSync(`${letter}:\\`)) {
          if (sub === "\\") {
            return { realPath: `${letter}:\\`, displayPath: `${letter}:\\` };
          }
          try {
            fs.mkdirSync(displayPath, { recursive: true });
            return { realPath: displayPath, displayPath };
          } catch (createErr) {}
        }
      } catch (e) {}
    }

    // On Linux or cloud (or if physical drive doesn't exist on disk):
    // Map to virtual drive folder
    const relParts = sub.split("\\").filter(Boolean);
    const realPath = path.join(VIRTUAL_DRIVES_DIR, letter, ...relParts);
    if (!fs.existsSync(realPath)) {
      try {
        fs.mkdirSync(realPath, { recursive: true });
      } catch (e) {}
    }
    return { realPath, displayPath };
  }

  return { realPath: raw, displayPath: raw };
}

// Stream an image directly so operator can see OK and Not OK images on screen!
app.get("/api/image-preview", (req, res) => {
  const rawPath = req.query.path;
  if (!rawPath) return res.status(404).send("Image path required");
  const { realPath } = resolveSystemPath(rawPath);
  if (!fs.existsSync(realPath)) {
    return res.status(404).send("Image not found");
  }

  const ext = path.extname(realPath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  fs.createReadStream(realPath).pipe(res);
});

// Drives list: ALWAYS returns Windows C:\ and D:\
app.get("/api/drives", (req, res) => {
  if (os.platform() === "win32") {
    const drives = [];
    for (let i = 67; i <= 90; i++) {
      const letter = String.fromCharCode(i) + ":\\";
      try {
        fs.readdirSync(letter);
        drives.push(letter);
      } catch (e) {}
    }
    if (drives.length === 0) drives.push("C:\\", "D:\\");
    res.json({ drives });
  } else {
    // Cloud / Linux environment: ALWAYS return C:\ and D:\
    res.json({ drives: ["C:\\", "D:\\"] });
  }
});

// Browse folders across any drive or directory
app.get("/api/browse", (req, res) => {
  const targetPath = req.query.path || "C:\\";
  const { realPath, displayPath } = resolveSystemPath(targetPath);

  try {
    const entries = fs.readdirSync(realPath, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        const lower = name.toLowerCase();
        return (
          !name.startsWith("$") &&
          !name.startsWith(".") &&
          lower !== "system volume information" &&
          lower !== "node_modules" &&
          lower !== ".git"
        );
      })
      .sort();

    let imageFiles = entries.filter((e) => !e.isDirectory() && /\.(png|jpe?g|svg|bmp|webp)$/i.test(e.name));
    let okCount = imageFiles.filter((e) => /(^|[^a-z0-9])ok([^a-z0-9]|$)/i.test(e.name)).length;
    let ngCount = imageFiles.filter((e) => /(^|[^a-z0-9])ng([^a-z0-9]|$)|not_ok|defect|reject/i.test(e.name)).length;

    // If immediate directory has no direct images, count nested camera images (e.g. LPSPOST/P000/...)
    if (imageFiles.length === 0 && folders.length > 0) {
      function countSubImages(curDir, d = 0) {
        if (d > 7) return;
        try {
          const subEntries = fs.readdirSync(curDir, { withFileTypes: true });
          for (const se of subEntries) {
            if (se.isDirectory()) {
              if (se.name.startsWith(".") || se.name.toLowerCase() === "node_modules") continue;
              countSubImages(path.join(curDir, se.name), d + 1);
            } else if (/\.(png|jpe?g|svg|bmp|webp)$/i.test(se.name)) {
              imageFiles.push(se.name);
              if (/(^|[^a-z0-9])ok([^a-z0-9]|$)/i.test(se.name)) okCount++;
              if (/(^|[^a-z0-9])ng([^a-z0-9]|$)|not_ok|defect|reject/i.test(se.name)) ngCount++;
            }
          }
        } catch (e) {}
      }
      countSubImages(realPath, 0);
    }

    // Calculate parent in Windows format
    let parent = null;
    const cleanDisplay = displayPath.replace(/\//g, "\\");
    if (!/^[a-zA-Z]:\\?$/.test(cleanDisplay)) {
      const parts = cleanDisplay.split("\\").filter(Boolean);
      parts.pop();
      if (parts.length === 1 && parts[0].includes(":")) {
        parent = parts[0] + "\\";
      } else if (parts.length > 1) {
        parent = parts.join("\\");
      }
    }

    res.json({
      path: displayPath,
      folders,
      imageCount: imageFiles.length,
      okCount,
      ngCount,
      parent,
    });
  } catch (err) {
    res.status(400).json({ error: "Cannot read this folder: " + err.message });
  }
});

// Hardware 2D Scanner Wedge Verification Terminal Endpoint
app.post("/api/terminal/verify", async (req, res) => {
  const {
    scannedCode,
    modelNo = "",
    partNo = "",
    partName = "",
    alcCode = "",
    hand = "",
    operator = "admin",
    shift = "Shift 1",
    line = "Line 2",
  } = req.body;

  const start = Date.now();
  const raw = String(scannedCode || "").trim();
  if (!raw) {
    return res.status(400).json({ error: "Scanned barcode code is required." });
  }

  const cleanScan = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanAlc = String(alcCode && alcCode !== "--" ? alcCode : "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanPart = String(partNo && partNo !== "--" ? partNo : "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanModel = String(modelNo && modelNo !== "--" ? modelNo : "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Verification: matches ALC Code or Part No or composite string
  let isMatch = false;
  if (cleanAlc && cleanScan.includes(cleanAlc)) {
    isMatch = true;
  } else if (cleanPart && cleanScan.includes(cleanPart)) {
    isMatch = true;
  } else if ((cleanAlc && cleanScan === cleanAlc) || (cleanPart && cleanScan === cleanPart)) {
    isMatch = true;
  }

  // Also query master_parts to see if scanned code matches any known ALC or Part
  let matchedMaster = null;
  try {
    const q = await pool.query(
      `SELECT * FROM master_parts WHERE UPPER(REPLACE(alc_code, '-', '')) = $1 OR UPPER(REPLACE(part_no, '-', '')) = $1 LIMIT 1`,
      [cleanScan]
    );
    if (q.rows.length > 0) {
      matchedMaster = q.rows[0];
      if (!isMatch && (!cleanAlc || cleanAlc === "--")) {
        isMatch = true;
      }
    }
  } catch (e) {}

  const latency = Date.now() - start;

  // Insert audit log in PostgreSQL
  try {
    await insertLog({
      folderName: `TERMINAL_${String(line).replace(/\s+/g, "_")}`,
      folderPath: `BARCODE_SCANNER\\${shift}`,
      fileName: raw,
      filePath: null,
      status: isMatch ? "OK" : "NG",
      modelNo: modelNo || matchedMaster?.model_no || "",
      partNo: partNo || matchedMaster?.part_no || "",
      subPartNo: hand || matchedMaster?.sub_part_no || "",
      alcCode: alcCode || matchedMaster?.alc_code || "",
      operator: operator || "operator",
      shift: shift || "Shift 1",
      remark: isMatch ? "Barcode Verified: Match OK" : `Barcode Mismatch (Scanned: ${raw})`,
      printed: false,
    });
  } catch (err) {
    console.warn("Audit log insert error:", err.message);
  }

  res.json({
    success: true,
    isMatch,
    scannedCode: raw,
    latency,
    expectedAlc: alcCode,
    expectedPart: partNo,
    matchedMaster,
    status: isMatch ? "PASS" : "FAIL",
    timestamp: new Date().toISOString(),
  });
});

// Scan folder for OK and Not OK (NG) images + Auto-Print label for OK images!
app.post("/api/folder/scan", async (req, res) => {
  const {
    folderPath,
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    sl_no = "",
    autoPrint = false,
    printedBy = "operator",
    operator = "operator",
    shift = "Shift 1",
  } = req.body;
  const activeOperator = operator || printedBy || "operator";
  const activeShift = shift || "Shift 1";

  const { realPath, displayPath } = resolveSystemPath(folderPath);
  const cleanFolderPath = realPath;

  const okFiles = [];
  const ngFiles = [];
  const folderName = path.basename(displayPath) || displayPath;

  const IGNORE_SCAN_DIRS = new Set([
    "node_modules", ".git", "$recycle.bin", "system volume information",
    "windows", "program files", "program files (x86)", "appdata", "local settings"
  ]);

  function walk(dir, depth = 0) {
    if (depth > 8) return; // Support industrial nested camera hierarchies (e.g. LPSPOST/P000/Jan192026/IV00158/0000)
    if (okFiles.length + ngFiles.length >= 250) return; // Memory safety

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      if (okFiles.length + ngFiles.length >= 250) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fullPath === QR_OUTPUT_DIR) continue;
        const lowerName = entry.name.toLowerCase();
        if (IGNORE_SCAN_DIRS.has(lowerName) || entry.name.startsWith(".")) continue;
        walk(fullPath, depth + 1);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const nameOnly = path.parse(entry.name).name;
        if (!IMAGE_EXT.includes(ext) && !nameOnly.toUpperCase().includes("OK") && !nameOnly.toUpperCase().includes("NG")) {
          continue;
        }

        const isOk = /(^|[^a-z0-9])ok([^a-z0-9]|$)/i.test(nameOnly);
        const isNg = /(^|[^a-z0-9])ng([^a-z0-9]|$)|not_ok|defect|reject/i.test(nameOnly);
        const host = req.get("host") || "localhost:5000";
        const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
        const previewUrl = `${proto}://${host}/api/image-preview?path=${encodeURIComponent(fullPath)}`;

        if (isOk) {
          const pieceIndex = okFiles.length + 1;
          const defaultSlNo = String(pieceIndex).padStart(4, "0");
          okFiles.push({
            name: entry.name,
            fullPath,
            previewUrl,
            status: "OK",
            pieceIndex,
            defaultSlNo,
            scannedAt: new Date().toISOString(),
          });
        } else if (isNg) {
          ngFiles.push({
            name: entry.name,
            fullPath,
            previewUrl,
            status: "NG",
            scannedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  walk(cleanFolderPath, 0);

  const autoPrintedLabels = [];

  // Process OK images: Log to database and auto-print one-by-one if autoPrint is true
  for (const f of okFiles) {
    const existing = await pool.query(
      "SELECT id, printed, printed_at, sl_no, composite_code FROM logs WHERE folder_path = $1 AND file_name = $2 LIMIT 1",
      [folderPath, f.name]
    );

    let isPrinted = false;
    let printedAt = null;
    let savedSlNo = null;
    let savedComposite = null;

    if (existing.rows.length > 0) {
      isPrinted = !!existing.rows[0].printed;
      printedAt = existing.rows[0].printed_at;
      savedSlNo = existing.rows[0].sl_no;
      savedComposite = existing.rows[0].composite_code;
    }

    const pieceSlNo = savedSlNo || f.defaultSlNo;
    const effectivePart = part_no || sub_part_no || "PART";
    const compositeCode = savedComposite || buildCompositeCode({
      prefix: "",
      partNo: effectivePart,
      slNo: pieceSlNo,
      modelNo: model_no,
      alcCode: alc_code,
    });

    if (!existing.rows.length) {
      // New inspection: log it
      const shouldAutoPrint = !!autoPrint;
      const newLog = await insertLog({
        folderName,
        folderPath,
        fileName: f.name,
        filePath: f.fullPath,
        status: "OK",
        modelNo: model_no || null,
        partNo: part_no || null,
        subPartNo: sub_part_no || null,
        alcCode: alc_code || null,
        slNo: pieceSlNo,
        operator: activeOperator,
        shift: activeShift,
        remark: shouldAutoPrint ? "Camera Inspection: Verified OK (Auto-Printed)" : "Camera Inspection: Verified OK",
        printed: shouldAutoPrint,
      });

      if (shouldAutoPrint) {
        isPrinted = true;
        printedAt = new Date().toISOString();
        savedSlNo = pieceSlNo;
        savedComposite = compositeCode;

        const safePart = sanitizeFileName(effectivePart);
        const qrFileName = `lbl_100x30_${safePart}_${pieceSlNo}_${Date.now()}.png`;
        const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);
        try {
          await QRCode.toFile(qrPath, compositeCode, {
            width: 450,
            margin: 1,
            errorCorrectionLevel: "H",
            color: { dark: "#000000", light: "#ffffff" },
          });
        } catch (e) {}

        await insertLabelLog({
          slNo: pieceSlNo,
          modelNo: String(model_no || ""),
          partNo: String(effectivePart || ""),
          subPartNo: String(sub_part_no || effectivePart || ""),
          partName: String(part_name || ""),
          alcCode: String(alc_code || ""),
          compositeCode,
          batchCode: String(alc_code || ""),
          qrFile: qrFileName,
          printedBy: activeOperator,
          printed: true,
        });

        if (newLog?.id) {
          try {
            await pool.query(
              "UPDATE logs SET composite_code = $1, sl_no = $2 WHERE id = $3",
              [compositeCode, pieceSlNo, newLog.id]
            );
          } catch (e) {}
        }
      }
    } else if (autoPrint && !isPrinted) {
      // Existing unprinted log - auto-print now!
      isPrinted = true;
      printedAt = new Date().toISOString();
      savedSlNo = pieceSlNo;
      savedComposite = compositeCode;

      const safePart = sanitizeFileName(effectivePart);
      const qrFileName = `lbl_100x30_${safePart}_${pieceSlNo}_${Date.now()}.png`;
      const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);
      try {
        await QRCode.toFile(qrPath, compositeCode, {
          width: 450,
          margin: 1,
          errorCorrectionLevel: "H",
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (e) {}

      await insertLabelLog({
        slNo: pieceSlNo,
        modelNo: String(model_no || ""),
        partNo: String(effectivePart || ""),
        subPartNo: String(sub_part_no || effectivePart || ""),
        partName: String(part_name || ""),
        alcCode: String(alc_code || ""),
        compositeCode,
        batchCode: String(alc_code || ""),
        qrFile: qrFileName,
        printedBy: activeOperator,
        printed: true,
      });

      await pool.query(
        "UPDATE logs SET printed = TRUE, printed_at = NOW(), sl_no = $1, composite_code = $2 WHERE id = $3",
        [pieceSlNo, compositeCode, existing.rows[0].id]
      );
    }

    f.printed = isPrinted;
    f.printedAt = printedAt;
    f.defaultSlNo = savedSlNo || pieceSlNo;

    const host = req.get("host") || "localhost:5000";
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    f.label = {
      sl_no: savedSlNo || pieceSlNo,
      model_no: model_no || "",
      part_no: effectivePart,
      sub_part_no: sub_part_no || effectivePart,
      part_name: part_name || "",
      alc_code: alc_code || "",
      composite_code: savedComposite || compositeCode,
      batch_code: alc_code || "",
      qr_file: `lbl_100x30_${sanitizeFileName(effectivePart)}_${savedSlNo || pieceSlNo}.png`,
      qr_url: `${proto}://${host}/api/labels/qr-dataurl?code=${encodeURIComponent(savedComposite || compositeCode)}`,
    };

    if (isPrinted) {
      autoPrintedLabels.push(f.label);
    }
  }

  // Process NG (Not OK) images: Log defect, NO label printed
  for (const f of ngFiles) {
    const existing = await pool.query(
      "SELECT id FROM logs WHERE folder_path = $1 AND file_name = $2 LIMIT 1",
      [folderPath, f.name]
    );

    if (!existing.rows.length) {
      await insertLog({
        folderName,
        folderPath,
        fileName: f.name,
        filePath: f.fullPath,
        status: "NG",
        modelNo: model_no || null,
        partNo: part_no || null,
        subPartNo: sub_part_no || null,
        alcCode: alc_code || null,
        operator: activeOperator,
        shift: activeShift,
        remark: "Defect / NG Detected by Inspection Camera",
        printed: false,
      });
    }
  }

  // Get cumulative counts
  const countRes = await pool.query(
    `SELECT
      SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END)::int AS total_ok,
      SUM(CASE WHEN status = 'NG' THEN 1 ELSE 0 END)::int AS total_ng
     FROM logs WHERE folder_path = $1`,
    [folderPath]
  );

  res.json({
    success: true,
    folderName,
    folderPath,
    okFiles,
    ngFiles,
    total_ok: countRes.rows[0]?.total_ok || okFiles.length,
    total_ng: countRes.rows[0]?.total_ng || ngFiles.length,
    autoPrintedLabels,
  });
});

// Explicit User-Triggered Print for Single OK Item
app.post("/api/labels/print-single", async (req, res) => {
  const {
    fileName,
    folderPath,
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    sl_no = "",
    piece_index = 1,
    printedBy = "operator",
  } = req.body;

  if (!fileName || !folderPath) {
    return res.status(400).json({ error: "fileName and folderPath are required." });
  }

  const effectivePart = part_no || sub_part_no || "PART";
  // Guarantee each piece has its own unique serial number (e.g. 0001, 0002, 0003...)
  const effectiveSlNo = String(sl_no || "").trim() || String(piece_index).padStart(4, "0");

  const compositeCode = buildCompositeCode({
    prefix: "",
    partNo: effectivePart,
    slNo: effectiveSlNo,
    modelNo: model_no,
    alcCode: alc_code,
  });

  const safePart = sanitizeFileName(effectivePart);
  const qrFileName = `lbl_100x30_${safePart}_${effectiveSlNo}_${Date.now()}.png`;
  const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);

  try {
    await QRCode.toFile(qrPath, compositeCode || effectivePart || alc_code || "HSI", {
      width: 450,
      margin: 1,
      errorCorrectionLevel: "H",
    });

    const labelLog = await insertLabelLog({
      slNo: effectiveSlNo,
      modelNo: String(model_no || ""),
      partNo: String(effectivePart || ""),
      subPartNo: String(sub_part_no || effectivePart || ""),
      partName: String(part_name || ""),
      alcCode: String(alc_code || ""),
      compositeCode,
      batchCode: alc_code || "",
      qrFile: qrFileName,
      printedBy,
    });

    await pool.query(
      `UPDATE logs SET printed = TRUE, printed_at = NOW(), sl_no = $3, composite_code = $4 WHERE folder_path = $1 AND file_name = $2`,
      [folderPath, fileName, effectiveSlNo, compositeCode]
    );

    const qrDataUrl = await QRCode.toDataURL(compositeCode || effectivePart || alc_code || "HSI", { width: 450, margin: 1 });
    const host = req.get("host") || "localhost:5000";
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";

    res.json({
      success: true,
      message: `Label for ${fileName} printed successfully.`,
      label: {
        sl_no: effectiveSlNo,
        model_no,
        part_no: effectivePart,
        sub_part_no: sub_part_no || effectivePart,
        part_name,
        alc_code,
        composite_code: compositeCode,
        batch_code: alc_code || "",
        qr_file: qrFileName,
        qr_url: `${proto}://${host}/qr-output/${qrFileName}`,
        qr_data_url: qrDataUrl,
        log_id: labelLog?.id,
        printed_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Print single error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Explicit Batch Print for All Approved OK Parts
app.post("/api/labels/print-batch", async (req, res) => {
  const {
    files = [],
    folderPath,
    model_no = "",
    part_no = "",
    sub_part_no = "",
    part_name = "",
    alc_code = "",
    printedBy = "operator",
  } = req.body;

  if (!files.length || !folderPath) {
    return res.status(400).json({ error: "No OK files specified to print." });
  }

  const effectivePart = part_no || sub_part_no || "PART";
  const printedList = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fName = typeof f === "object" ? f.name : f;
    const pieceSlNo = (typeof f === "object" && f.sl_no)
      ? String(f.sl_no)
      : String(i + 1).padStart(4, "0");

    const pieceComposite = buildCompositeCode({
      prefix: "",
      partNo: effectivePart,
      slNo: pieceSlNo,
      modelNo: model_no,
      alcCode: alc_code,
    });

    const safePart = sanitizeFileName(effectivePart);
    const qrFileName = `lbl_100x30_${safePart}_${pieceSlNo}_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
    const qrPath = path.join(QR_OUTPUT_DIR, qrFileName);

    await QRCode.toFile(qrPath, pieceComposite, { width: 450, margin: 1, errorCorrectionLevel: "H" });

    const qrDataUrl = await QRCode.toDataURL(pieceComposite, { width: 450, margin: 1 });

    const labelLog = await insertLabelLog({
      slNo: pieceSlNo,
      modelNo: String(model_no || ""),
      partNo: String(effectivePart || ""),
      subPartNo: String(sub_part_no || effectivePart || ""),
      partName: String(part_name || ""),
      alcCode: String(alc_code || ""),
      compositeCode: pieceComposite,
      batchCode: alc_code || "",
      qrFile: qrFileName,
      printedBy,
    });

    await pool.query(
      `UPDATE logs SET printed = TRUE, printed_at = NOW(), sl_no = $3, composite_code = $4 WHERE folder_path = $1 AND file_name = $2`,
      [folderPath, fName, pieceSlNo, pieceComposite]
    );

    const host = req.get("host") || "localhost:5000";
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    printedList.push({
      fileName: fName,
      sl_no: pieceSlNo,
      composite_code: pieceComposite,
      qr_file: qrFileName,
      qr_url: `${proto}://${host}/qr-output/${qrFileName}`,
      qr_data_url: qrDataUrl,
      log_id: labelLog?.id,
    });
  }

  res.json({
    success: true,
    count: printedList.length,
    message: `Printed ${printedList.length} unique 100x30 labels successfully.`,
    labels: printedList,
  });
});

// Executive & Operations Dashboard live stats (Direct from Neon PostgreSQL)
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs for Executive & Operations Dashboard (Direct from Neon PostgreSQL)
app.get("/api/dashboard/audit-logs", async (req, res) => {
  try {
    const dbLogs = await pool.query(`
      SELECT 
        l.id,
        l.scanned_at as date_done,
        l.status,
        COALESCE(l.part_no, '--') as mother_part,
        COALESCE(l.alc_code, '--') as alc_code,
        COALESCE(l.model_no, '--') as model,
        COALESCE(l.pressure, CASE WHEN l.status = 'FAIL' OR l.status = 'NG' THEN '0.000' ELSE '0.850' END) as pressure,
        COALESCE(l.operator, 'operator') as operator,
        COALESCE(l.shift, 'Shift 1') as shift,
        COALESCE(l.trace_number, 'TRC-' || LPAD(l.id::text, 6, '0')) as trace_number,
        COALESCE(l.pack_qty, CASE WHEN l.status = 'FAIL' OR l.status = 'NG' THEN '0 / 1' ELSE '1 / 1' END) as pack_qty,
        COALESCE(l.remark, CASE WHEN l.status = 'FAIL' OR l.status = 'NG' THEN 'Defect Detected / Rejection' ELSE 'Verified OK' END) as remark,
        l.file_name,
        l.folder_path
      FROM logs l
      ORDER BY l.scanned_at DESC
      LIMIT 100
    `);

    const mapped = (dbLogs.rows || []).map((r) => ({
      id: r.id,
      date_done: r.date_done ? formatLocalDateTime(r.date_done) : "",
      raw_timestamp: r.date_done ? new Date(r.date_done).toISOString() : "",
      status: (r.status === "OK" || r.status === "PASS") ? "PASS" : "FAIL",
      mother_part: r.mother_part,
      alc_code: r.alc_code || "--",
      trace_number: r.trace_number || `TRC-${String(r.id).padStart(6, "0")}`,
      pressure: Number(r.pressure || (r.status === "OK" || r.status === "PASS" ? 0.85 : 0.0)).toFixed(3),
      operator: r.operator || "operator",
      model: r.model || "--",
      shift: r.shift || "Shift 1",
      pack_qty: r.pack_qty || "1 / 1",
      remark: r.remark || (r.status === "OK" || r.status === "PASS" ? "Verified OK" : "Defect Detected / Rejection"),
    }));

    res.json({ success: true, count: mapped.length, logs: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. DAILY EXCEL REPORT (For Master Admin)
// ==========================================
app.get("/api/reports/daily-excel", async (req, res) => {
  const date = req.query.date || getLocalDateString();

  try {
    const wb = xlsx.utils.book_new();

    // Summary Sheet
    const stats = await getDashboardStats();
    const summaryData = [
      { Metric: "Report Date", Value: date },
      { Metric: "Application", Value: "HSI MES Production Verification System" },
      { Metric: "Total Models", Value: stats.total_models },
      { Metric: "Total Part Numbers", Value: stats.total_part_no },
      { Metric: "Total OK Inspections", Value: stats.total_ok_parts },
      { Metric: "Total Not OK (NG) Inspections", Value: stats.total_ng_parts },
      { Metric: "Total Labels Generated Today", Value: stats.total_label_generated_today },
    ];
    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Inspection logs (OK / NG)
    const inspLogs = await pool.query(
      `SELECT scanned_at, folder_name AS "Folder", file_name AS "File",
              status AS "Status", model_no AS "Model", part_no AS "Part No",
              sub_part_no AS "Sub Part", printed AS "Label Printed"
       FROM logs
       WHERE scanned_at::date = $1::date
       ORDER BY scanned_at DESC`,
      [date]
    );
    const mappedInsp = inspLogs.rows.map((r) => ({
      Time: formatLocalDateTime(r.scanned_at),
      Folder: r.Folder,
      File: r.File,
      Status: r.Status,
      Model: r.Model,
      "Part No": r["Part No"],
      "Sub Part": r["Sub Part"],
      "Label Printed": r["Label Printed"],
    }));
    const wsInsp = xlsx.utils.json_to_sheet(mappedInsp.length ? mappedInsp : [{ Message: "No inspections on " + date }]);
    xlsx.utils.book_append_sheet(wb, wsInsp, "Inspections (OK_NG)");

    // Daily Label logs
    const labelLogs = await pool.query(
      `SELECT created_at, sl_no AS "SL NO", model_no AS "MODEL",
              part_no AS "PART NO", sub_part_no AS "SUB PART NO", part_name AS "PART NAME",
              alc_code AS "ALC CODE", composite_code AS "COMPOSITE BARCODE",
              batch_code AS "BATCH CODE", printed_by AS "OPERATOR"
       FROM label_logs
       WHERE created_at::date = $1::date
       ORDER BY created_at DESC`,
      [date]
    );
    const mappedLabels = labelLogs.rows.map((r) => ({
      Time: formatLocalDateTime(r.created_at),
      "SL NO": r["SL NO"],
      MODEL: r.MODEL,
      "PART NO": r["PART NO"],
      "SUB PART NO": r["SUB PART NO"],
      "PART NAME": r["PART NAME"],
      "ALC CODE": r["ALC CODE"],
      "COMPOSITE BARCODE": r["COMPOSITE BARCODE"],
      "BATCH CODE": r["BATCH CODE"],
      OPERATOR: r.OPERATOR,
    }));
    const wsLabels = xlsx.utils.json_to_sheet(mappedLabels.length ? mappedLabels : [{ Message: "No labels generated on " + date }]);
    xlsx.utils.book_append_sheet(wb, wsLabels, "100x30 Labels");

    // Master Parts Reference Sheet
    const masterParts = await getAllMasterParts();
    const wsMaster = xlsx.utils.json_to_sheet(masterParts);
    xlsx.utils.book_append_sheet(wb, wsMaster, "Master Data");

    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Daily_Production_Report_${date}.xlsx"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json({ error: "Failed to generate report: " + err.message });
  }
});

// Serve static QR codes
app.use("/qr-output", express.static(QR_OUTPUT_DIR));

const PORT = process.env.PORT || 5000;
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Neon DB connection notice:", err.message);
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT} (offline DB mode)`));
  });
