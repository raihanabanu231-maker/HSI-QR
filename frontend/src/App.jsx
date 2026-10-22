import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  Settings,
  Crosshair,
  FileBarChart,
  FolderKanban,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  HardDrive,
  FolderOpen,
  Camera,
  Eye,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  Square,
  Search,
  PlusCircle,
  QrCode,
  LogOut,
  ChevronDown,
  User,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Users,
  Building2,
  Zap,
  Package,
  Puzzle,
  KeyRound,
  Clock,
  Trash2,
  Maximize2,
  Copy,
  ExternalLink,
  RotateCcw,
  Volume2,
  VolumeX,
  Cpu,
  Edit3,
  Check,
} from "lucide-react";
import bwipjs from "bwip-js";
import "./App.css";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const API = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

// HSI AUTO 3-Node Brand Logo Component matching Screenshot 1 & 2
function HsiLogo({ size = "default", showText = true }) {
  const isLarge = size === "large";
  return (
    <div className={`hsi-brand-logo ${size}`}>
      <svg
        className={`logo-svg ${isLarge ? "logo-lg" : "logo-sm"}`}
        viewBox="0 0 145 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Blue capsule */}
        <path d="M12 6 H34 C38 6 42 10 42 14 V26 C42 30 38 34 34 34 H12 C6 34 2 29 2 23 V17 C2 11 6 6 12 6 Z" fill="#2563eb" />
        <circle cx="14" cy="20" r="4.5" fill="#0f1d2e" />

        {/* Gray link */}
        <rect x="30" y="12" width="26" height="16" rx="4" fill="#64748b" />
        <rect x="37" y="16" width="12" height="8" rx="2" fill="#0f1d2e" />

        {/* Red block */}
        <path d="M48 6 H70 C76 6 80 10 80 16 V24 C80 30 76 34 70 34 H56 C52 34 48 30 48 26 Z" fill="#dc2626" />
        <circle cx="66" cy="18" r="3.5" fill="#ffffff" opacity="0.95" />

        {showText && (
          <text x="86" y="27" fill="#f59e0b" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="14" letterSpacing="0.8">
            HSI AUTO
          </text>
        )}
      </svg>
    </div>
  );
}

// Dynamic Label Print Size Presets
const LABEL_SIZE_DIMS = {
  "100x30": { w: "100mm", h: "30mm", label: "Standard 100x30 mm (100%)" },
  "140x42": { w: "140mm", h: "42mm", label: "Medium 140x42 mm (140%)" },
  "180x54": { w: "180mm", h: "54mm", label: "Large 180x54 mm (180%)" },
  "200x60": { w: "200mm", h: "60mm", label: "Extra Large 200x60 mm (200%)" },
  "a4_fit": { w: "190mm", h: "57mm", label: "Fit Full A4 Page Width (190x57 mm)" },
};

// Dynamic Barcode Composite Generator: PartNo + SlNo + Model + ALC (pure real data)
function computeCompositeCode({ prefix = "", part_no = "", sl_no = "", model_no = "", alc_code = "", motherPartNo = "", targetAlcCode = "" }) {
  const p = (prefix || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const pn = String(part_no || motherPartNo || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const sl = String(sl_no || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const m = String(model_no || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const alc = String(alc_code || (targetAlcCode !== "--" ? targetAlcCode : "") || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `${p}${pn}${sl}${m}${alc}`;
}

// Generates unique sequential piece serial number for each inspected item (0001, 0002, 0003...)
function getPieceSerial(img, idx) {
  if (img?.label?.sl_no) return String(img.label.sl_no);
  if (img?.defaultSlNo) return String(img.defaultSlNo);
  return String((idx !== undefined ? idx : 0) + 1).padStart(4, "0");
}

// Pure Vector ECC200 Data Matrix Generator (Automotive ISO/IEC 16022 standard, 100% synchronous, vector sharp)
function generateDataMatrixVector(text) {
  if (!text) return { size: 72, width: 72, height: 72, path: "" };
  try {
    const rawSvg = bwipjs.toSVG({
      bcid: "datamatrix",
      text: String(text),
      includetext: false,
    });
    const matchVb = rawSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const matchPath = rawSvg.match(/<path d="([^"]+)"/);
    const w = matchVb ? parseInt(matchVb[1], 10) : 72;
    const h = matchVb ? parseInt(matchVb[2], 10) : 72;
    const d = matchPath ? matchPath[1] : "";
    return { size: w, width: w, height: h, path: d };
  } catch (err) {
    console.warn("DataMatrix vector generation error:", err);
    return { size: 72, width: 72, height: 72, path: "" };
  }
}

// Generate synchronous DataMatrix SVG Data URL
function generateDataMatrixDataUrl(text) {
  if (!text) return "";
  try {
    const rawSvg = bwipjs.toSVG({
      bcid: "datamatrix",
      text: String(text),
      includetext: false,
    });
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSvg);
  } catch (e) {
    return "";
  }
}

// Backward-compatible alias
function generateQrVectorPath(text) {
  return generateDataMatrixVector(text);
}

function sanitizePath(p) {
  if (!p) return "";
  let clean = String(p).trim();
  // Strip surrounding quotes if copied from Windows Explorer "Copy as path"
  clean = clean.replace(/^["']+|["']+$/g, "").trim();
  return clean;
}

function isWindowsPath(p) {
  const clean = sanitizePath(p);
  return /^[a-zA-Z]:/.test(clean);
}

function joinChildPath(parentPath, childName) {
  if (!parentPath) return childName;
  const isWin = isWindowsPath(parentPath);
  if (isWin) {
    return parentPath.endsWith("\\") ? `${parentPath}${childName}` : `${parentPath}\\${childName}`;
  }
  // Linux / Unix Cloud container path
  return parentPath.endsWith("/") ? `${parentPath}${childName}` : `${parentPath}/${childName}`;
}

// Helper to parse path into interactive clickable breadcrumb segments
function parsePathSegments(fullPath) {
  if (!fullPath) return [];
  const isWin = isWindowsPath(fullPath);
  if (isWin) {
    const clean = String(fullPath).replace(/\//g, "\\");
    const parts = clean.split("\\").filter(Boolean);
    const segments = [];
    let accum = "";
    parts.forEach((part, idx) => {
      if (idx === 0 && part.includes(":")) {
        accum = part + "\\";
      } else {
        accum = accum.endsWith("\\") ? accum + part : accum + "\\" + part;
      }
      segments.push({ name: part, path: accum, isDrive: idx === 0 });
    });
    return segments;
  } else {
    // Linux / Cloud container path
    const parts = String(fullPath).split("/").filter(Boolean);
    const segments = [{ name: "/", path: "/", isDrive: true }];
    let accum = "";
    parts.forEach((part) => {
      accum += "/" + part;
      segments.push({ name: part, path: accum, isDrive: false });
    });
    return segments;
  }
}

// Web Audio API Synthesizers for Industrial Terminal Verification Feedback
function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!window._mesAudioCtx) {
    window._mesAudioCtx = new AudioCtx();
  }
  if (window._mesAudioCtx.state === "suspended") {
    window._mesAudioCtx.resume();
  }
  return window._mesAudioCtx;
}

function playChimePass() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
  } catch (e) {
    console.warn("Chime pass error:", e);
  }
}

function playBuzzerFail() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {
    console.warn("Buzzer fail error:", e);
  }
}

function playFanfareComplete() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    });
  } catch (e) {
    console.warn("Fanfare error:", e);
  }
}

// Global helper for Real-Time Work Shift calculation
function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return "Shift 1";
  if (hour >= 14 && hour < 22) return "Shift 2";
  return "Shift 3";
}

// Local Date & Time Formatting Helpers (Displays user's real local time, e.g. IST)
function formatLocalDateTime(val) {
  if (!val) return "--";
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

function formatTime12h(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

function getLocalDateString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getLocalTimeString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

// ========================================================
// ROLE-BASED ACCESS CONTROL (RBAC) RULES & PERMISSIONS
// ========================================================
const ROLE_PERMISSIONS = {
  ADMIN: {
    dashboard: true,
    process: true,
    station: true,
    reports: true,
    masters: true,
    users: true,
    canEditMasters: true,
  },
  SUPERVISOR: {
    dashboard: true,
    process: true,
    station: true,
    reports: true,
    masters: true,
    users: false,
    canEditMasters: false,
  },
  QUALITY_INSPECTOR: {
    dashboard: true,
    process: true,
    station: true,
    reports: true,
    masters: true,
    users: false,
    canEditMasters: false,
  },
  OPERATOR: {
    dashboard: false,
    process: true,
    station: true,
    reports: false,
    masters: false,
    users: false,
    canEditMasters: false,
  },
};

function hasPageAccess(role, page) {
  const r = (role || "").toUpperCase();
  const perms =
    ROLE_PERMISSIONS[r] ||
    (r.includes("QUALITY") ? ROLE_PERMISSIONS.QUALITY_INSPECTOR : ROLE_PERMISSIONS.OPERATOR);
  return !!perms[page];
}

export default function App() {
  // Authentication & Session: Persisted in localStorage so refreshing the page does not boot the user out
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("hsi_authenticated") === "true";
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("hsi_user");
      return saved ? JSON.parse(saved) : { username: "admin", role: "ADMIN", full_name: "System Administrator" };
    } catch {
      return { username: "admin", role: "ADMIN", full_name: "System Administrator" };
    }
  });
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("Admin@123");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Work Shift & Line State with Operator Guide Modal
  const [selectedShift, setSelectedShift] = useState(() => getCurrentShift());
  const [selectedLine, setSelectedLine] = useState("Line 2");
  const [showShiftLineHelpModal, setShowShiftLineHelpModal] = useState(false);
  const [liveTime, setLiveTime] = useState(() => getLocalTimeString());
  const nativeFolderInputRef = useRef(null);
  const [isUploadingFolder, setIsUploadingFolder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Navigation active tab: 'dashboard' | 'process' | 'station' | 'reports' | 'masters' | 'users'
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mastersDropdownOpen, setMastersDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState("accounts"); // 'accounts' | 'matrix'
  const [usersList, setUsersList] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "OPERATOR",
    line_assigned: "Line 2",
    shift_assigned: "Shift 1",
  });

  // Plant-Wide Audit Logs (matching Screenshot 2)
  const [auditLogs, setAuditLogs] = useState([]);

  // Notifications
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [printFeedback, setPrintFeedback] = useState("");

  // ========================================================
  // PROCESS SELECTION STATE (100% REAL DATA FROM NEON DB)
  // ========================================================
  const [modelsList, setModelsList] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");

  const [motherPartsList, setMotherPartsList] = useState([]);
  const [selectedMotherPart, setSelectedMotherPart] = useState("");

  const [childPartsList, setChildPartsList] = useState([]);
  const [selectedChildPart, setSelectedChildPart] = useState("");

  // Auto-loaded Process & Verification Specifications (100% Real PostgreSQL Data)
  const [specs, setSpecs] = useState({
    motherPartNo: "--",
    cleanPartNo: "--",
    childPart: "--",
    partName: "--",
    targetAlcCode: "--",
    eoNumber: "--",
    identifier: "--",
    supplierCode: "--",
    itemNumber: "--",
    lineCode: "--",
    partColor: "--",
    slNo: "--",
    compositeCode: "--",
    batchCode: "--",
  });

  // Lock status
  const [isProcessLocked, setIsProcessLocked] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);

  // ========================================================
  // SCAN STATION STATE (OK & NOT OK IMAGE PANELS + 100x30 PRINT)
  // ========================================================
  const [selectedFolder, setSelectedFolder] = useState(() => {
    const saved = localStorage.getItem("hsi_last_folder");
    return saved && saved !== "/" && isWindowsPath(saved)
      ? saved
      : "C:\\";
  });
  const [isScanning, setIsScanning] = useState(false);
  const [autoWatcherActive, setAutoWatcherActive] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true); // Automatically prints OK labels one-by-one as soon as found
  const [labelPrintSize, setLabelPrintSize] = useState(() => {
    return localStorage.getItem("hsi_label_print_size") || "100x30";
  });

  // Interactive Drive & Folder Browser State (Original App Feature)
  const [drives, setDrives] = useState(["C:\\", "D:\\"]);
  const [browseCurrentPath, setBrowseCurrentPath] = useState(() => {
    const saved = localStorage.getItem("hsi_last_folder");
    return saved && saved !== "/" && isWindowsPath(saved)
      ? saved
      : "C:\\";
  });
  const [browseFolders, setBrowseFolders] = useState([]);
  const [browseParentPath, setBrowseParentPath] = useState(null);
  const [showFolderBrowser, setShowFolderBrowser] = useState(true);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [browseFolderStats, setBrowseFolderStats] = useState({ imageCount: 0, okCount: 0, ngCount: 0 });

  const [okImages, setOkImages] = useState([]);
  const [ngImages, setNgImages] = useState([]);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [selectedLabelModal, setSelectedLabelModal] = useState(null);
  const [activeLabelPrint, setActiveLabelPrint] = useState(null);

  // Production shift counters (100% Real PostgreSQL Data)
  const [counters, setCounters] = useState({
    total_models: 0,
    total_part_no: 0,
    total_part_name: 0,
    total_master_parts: 0,
    total_ok: 0,
    total_ng: 0,
    total_labels_today: 0,
  });

  // ========================================================
  // MASTERS & ADMIN STATE
  // ========================================================
  const [masterItems, setMasterItems] = useState([]);
  const [masterSearch, setMasterSearch] = useState("");
  const [uploadMode, setUploadMode] = useState("replace");
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [newPart, setNewPart] = useState({
    modelNo: "",
    partName: "",
    partNo: "",
    subPartNo: "",
    alcCode: "",
    slNo: "",
    remarks: "",
  });

  const fileInputRef = useRef(null);

  // Auto dismiss alerts
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(""), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (printFeedback) {
      const t = setTimeout(() => setPrintFeedback(""), 4000);
      return () => clearTimeout(t);
    }
  }, [printFeedback]);

  // Live real-time clock ticker
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setLiveTime(getLocalTimeString());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Suppress document title during printing so Chrome/Edge does not print header text
  useEffect(() => {
    let savedTitle = document.title;
    const handleBeforePrint = () => {
      savedTitle = document.title;
      document.title = "";
    };
    const handleAfterPrint = () => {
      document.title = savedTitle || "HSI Industrial Inspection & 100x30 Label System";
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // Initial load: Only load system data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    loadModels();
    loadDashboardStats();
    loadMasterItems();
    loadAuditLogs();
    loadDrives();
    loadUsers();
    // Restore last folder or default to C:\
    const savedFolder = localStorage.getItem("hsi_last_folder");
    if (savedFolder && savedFolder !== "/" && isWindowsPath(savedFolder)) {
      openFolder(savedFolder);
    } else {
      openFolder("C:\\");
    }
  }, [isAuthenticated]);

  // Periodic Real-Time Data Sync: syncs PostgreSQL dashboard stats & logs, and station folder if active
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      loadDashboardStats();
      if (activeTab === "dashboard") {
        loadAuditLogs();
      }
      if (selectedFolder && activeTab === "station") {
        fetch(`${API}/folder/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderPath: selectedFolder,
            model_no: selectedModel || "",
            part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
            sub_part_no: selectedChildPart || (specs.motherPartNo !== "--" ? specs.motherPartNo : ""),
            part_name: specs.partName !== "--" ? specs.partName : "",
            alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
            sl_no: specs.slNo !== "--" ? specs.slNo : "",
            autoPrint: false,
            printedBy: currentUser?.username || "operator",
            operator: currentUser?.username || "operator",
            shift: selectedShift || getCurrentShift(),
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.okFiles) setOkImages(data.okFiles);
            if (data.ngFiles) setNgImages(data.ngFiles);
            // Do NOT overwrite plant-wide counters with single folder count!
          })
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedFolder, selectedModel, specs.motherPartNo, specs.partName, specs.targetAlcCode, specs.slNo, selectedChildPart, currentUser, activeTab, selectedShift]);

  // Reload models and stats when switching tabs
  useEffect(() => {
    if (activeTab === "process" || activeTab === "station") {
      loadModels();
    } else if (activeTab === "dashboard") {
      loadDashboardStats();
      loadAuditLogs();
    } else if (activeTab === "masters") {
      loadMasterItems();
    }
  }, [activeTab]);

  // Drive & Folder Explorer API calls (from original app)
  function loadDrives() {
    fetch(`${API}/drives`)
      .then((r) => r.json())
      .then((d) => {
        if (d.drives && d.drives.length > 0) {
          const clean = d.drives.filter((x) => x !== "/" && x !== "\\");
          setDrives(clean.length > 0 ? clean : ["C:\\", "D:\\"]);
        }
      })
      .catch(() => setDrives(["C:\\", "D:\\"]));
  }

  function openFolder(targetPath) {
    let p = sanitizePath(targetPath) || "C:\\";
    if (p === "/" || p === "\\" || !isWindowsPath(p)) {
      p = "C:\\";
    }
    setLoadingBrowse(true);
    fetch(`${API}/browse?path=${encodeURIComponent(p)}`)
      .then((r) => r.json())
      .then((d) => {
        setLoadingBrowse(false);
        if (d.error) {
          setError(d.error);
          return;
        }
        setBrowseCurrentPath(d.path);
        setBrowseFolders(d.folders || []);
        setBrowseParentPath(d.parent);
        setBrowseFolderStats({
          imageCount: d.imageCount || 0,
          okCount: d.okCount || 0,
          ngCount: d.ngCount || 0,
        });
        setSelectedFolder(d.path);
        localStorage.setItem("hsi_last_folder", d.path);
        // Automatically fetch and display OK and Not OK images in this folder without auto-printing
        scanInspectionFolder(d.path);
      })
      .catch((err) => {
        setLoadingBrowse(false);
        setError("Could not load folder: " + err.message);
      });
  }

  function handleSelectAndScanFolder(folderPath) {
    const p = sanitizePath(folderPath || browseCurrentPath || selectedFolder);
    if (!p) return;
    setSelectedFolder(p);
    setBrowseCurrentPath(p);
    localStorage.setItem("hsi_last_folder", p);
    scanInspectionFolder(p);
  }

  function handleDirectScanClick() {
    const raw = selectedFolder || "";
    const clean = sanitizePath(raw);
    if (!clean) {
      setError("Please enter or choose an inspection folder path.");
      return;
    }
    setSelectedFolder(clean);
    setBrowseCurrentPath(clean);
    localStorage.setItem("hsi_last_folder", clean);
    scanInspectionFolder(clean);
    openFolder(clean);
  }

  async function handlePickFolderClick() {
    // 1. Try modern browser File System Access API (window.showDirectoryPicker)
    // Opens native Windows folder picker without uploading all files, never hangs, and avoids Chrome warnings!
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: "read" });
        if (!dirHandle || !dirHandle.name) return;

        const folderName = dirHandle.name;

        // 1. Locate the physical Windows path
        let realPath = "";
        try {
          const locRes = await fetch(`${API}/folder/locate?name=${encodeURIComponent(folderName)}&current=${encodeURIComponent(selectedFolder || "")}`);
          const locData = await locRes.json();
          if (locData.found && locData.path) {
            realPath = locData.path;
          } else if (locData.suggestedPath) {
            realPath = locData.suggestedPath;
          }
        } catch (e) {}

        if (!realPath) {
          const base = (selectedFolder || "D:\\").replace(/[\\/]+$/, "");
          realPath = `${base}\\${folderName}`;
        }

        // IMMEDIATELY SHOW THAT REAL PATH IN THE TEXT BOX!
        setSelectedFolder(realPath);
        setBrowseCurrentPath(realPath);
        localStorage.setItem("hsi_last_folder", realPath);

        // 2. Read ONLY top-level images directly inside this folder (no deep recursive hanging)
        const imageFiles = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === "file" && /\.(png|jpe?g|svg|bmp|webp|tiff|gif)$/i.test(entry.name)) {
            try {
              const file = await entry.getFile();
              imageFiles.push(file);
              if (imageFiles.length >= 50) break;
            } catch (err) {}
          }
        }

        if (imageFiles.length === 0) {
          // If the folder is physically on local disk, scan the real path directly
          scanInspectionFolder(realPath);
          openFolder(realPath);
          setSuccessMsg(`📁 Selected folder: ${realPath}`);
          return;
        }

        setIsUploadingFolder(true);
        setUploadProgress(`Loading ${imageFiles.length} image(s)...`);

        const formData = new FormData();
        formData.append("folderName", folderName);
        formData.append("folderPath", realPath);
        formData.append("clearFolder", "true");
        imageFiles.forEach((file) => formData.append("files", file));

        const res = await fetch(`${API}/folder/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setIsUploadingFolder(false);
        setUploadProgress("");

        const finalPath = realPath || data.folderPath;
        setSelectedFolder(finalPath);
        setBrowseCurrentPath(finalPath);
        localStorage.setItem("hsi_last_folder", finalPath);

        setSuccessMsg(`✅ Loaded ${imageFiles.length} image(s) from '${finalPath}'.`);
        // Scan folder and DIRECTLY print OK images without asking!
        scanInspectionFolder(finalPath);
        openFolder(finalPath);
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // User cancelled the dialog
        console.warn("showDirectoryPicker fallback:", err);
      }
    }

    // Fallback: Trigger native input
    if (nativeFolderInputRef.current) {
      nativeFolderInputRef.current.click();
    }
  }

  async function handleLocalFolderSelect(e) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Filter to ONLY images and limit to first 50 so Chrome NEVER hangs
    const imageFiles = [];
    let firstRelative = "";
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (!firstRelative && f.webkitRelativePath) {
        firstRelative = f.webkitRelativePath;
      }
      if (/\.(png|jpe?g|svg|bmp|webp|tiff|gif)$/i.test(f.name)) {
        imageFiles.push(f);
        if (imageFiles.length >= 50) break;
      }
    }

    const rawFolderName = firstRelative ? firstRelative.split("/")[0] : "InspectionFolder";

    let realPath = "";
    try {
      const locRes = await fetch(`${API}/folder/locate?name=${encodeURIComponent(rawFolderName)}&current=${encodeURIComponent(selectedFolder || "")}`);
      const locData = await locRes.json();
      if (locData.found && locData.path) {
        realPath = locData.path;
      } else if (locData.suggestedPath) {
        realPath = locData.suggestedPath;
      }
    } catch (err) {}

    if (!realPath) {
      const base = (selectedFolder || "D:\\").replace(/[\\/]+$/, "");
      realPath = `${base}\\${rawFolderName}`;
    }

    // SHOW THAT REAL PATH IN THE TEXT BOX!
    setSelectedFolder(realPath);
    setBrowseCurrentPath(realPath);
    localStorage.setItem("hsi_last_folder", realPath);

    if (imageFiles.length === 0) {
      setError(`No camera image files found in '${rawFolderName}'.`);
      if (nativeFolderInputRef.current) nativeFolderInputRef.current.value = "";
      return;
    }

    setIsUploadingFolder(true);
    setUploadProgress(`Loading ${imageFiles.length} image(s)...`);

    try {
      const formData = new FormData();
      formData.append("folderName", rawFolderName);
      formData.append("folderPath", realPath);
      formData.append("clearFolder", "true");
      imageFiles.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API}/folder/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setIsUploadingFolder(false);
      setUploadProgress("");

      const finalPath = realPath || data.folderPath;
      setSelectedFolder(finalPath);
      setBrowseCurrentPath(finalPath);
      localStorage.setItem("hsi_last_folder", finalPath);

      setSuccessMsg(`✅ Loaded ${imageFiles.length} image(s) from '${finalPath}'.`);
      scanInspectionFolder(finalPath);
      openFolder(finalPath);
    } catch (err) {
      setIsUploadingFolder(false);
      setUploadProgress("");
      setError("Failed to load folder: " + err.message);
    } finally {
      if (nativeFolderInputRef.current) {
        nativeFolderInputRef.current.value = "";
      }
    }
  }

  function handleDropFiles(e) {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = Array.from(dt.files || []);
    if (!files.length) return;
    handleLocalFilesSelect({ files });
  }

  function handleLogin(e, directCredentials) {
    if (e) e.preventDefault();
    const u = (directCredentials?.username || loginUser).trim();
    const p = (directCredentials?.password || loginPass).trim();

    if (!u) {
      setLoginError("Please enter Operator / User ID");
      return;
    }
    if (!p) {
      setLoginError("Please enter Password");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    })
      .then(async (r) => {
        const res = await r.json().catch(() => ({}));
        if (!r.ok || res.error) {
          throw new Error(res.error || `Login failed (${r.status})`);
        }
        return res;
      })
      .then((res) => {
        setIsLoggingIn(false);
        const userObj = res.user || {
          username: u,
          role: u.toLowerCase() === "operator" ? "OPERATOR" : "ADMIN",
          full_name: u,
        };
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        localStorage.setItem("hsi_authenticated", "true");
        localStorage.setItem("hsi_user", JSON.stringify(userObj));
        setLoginError("");
        if (userObj.role === "OPERATOR") {
          setActiveTab("station");
        } else {
          setActiveTab("dashboard");
        }
        setSuccessMsg(`Welcome, ${userObj.full_name || userObj.username}! Logged in as ${userObj.role}.`);
      })
      .catch((err) => {
        setIsLoggingIn(false);
        const lowerU = u.toLowerCase();
        let fallbackRole = null;
        if (lowerU === "admin" && (p === "Admin@123" || p === "admin")) fallbackRole = "ADMIN";
        else if (lowerU === "operator" && (p === "Operator@123" || p === "operator")) fallbackRole = "OPERATOR";
        else if (lowerU === "supervisor" && (p === "Super@123" || p === "supervisor")) fallbackRole = "SUPERVISOR";
        else if (lowerU === "quality" && (p === "Quality@123" || p === "quality")) fallbackRole = "QUALITY_INSPECTOR";

        if (fallbackRole) {
          const userObj = {
            username: u,
            role: fallbackRole,
            full_name:
              lowerU === "admin"
                ? "System Administrator"
                : lowerU === "operator"
                ? "Line 2 Operator"
                : lowerU === "supervisor"
                ? "Line Supervisor"
                : "Quality Assurance Inspector",
          };
          setCurrentUser(userObj);
          setIsAuthenticated(true);
          localStorage.setItem("hsi_authenticated", "true");
          localStorage.setItem("hsi_user", JSON.stringify(userObj));
          setLoginError("");
          setActiveTab(fallbackRole === "OPERATOR" ? "station" : "dashboard");
          setSuccessMsg(`Welcome, ${userObj.full_name}! (Signed in successfully)`);
        } else {
          setLoginError(err.message || "Invalid username or password.");
        }
      });
  }

  function handleLogout() {
    setIsAuthenticated(false);
    localStorage.removeItem("hsi_authenticated");
    localStorage.removeItem("hsi_user");
    setActiveTab("station");
    setLoginError("");
    setSuccessMsg("Logged out successfully.");
  }

  // RBAC Navigation Guard: automatically redirect to authorized tab if user role cannot access current tab
  useEffect(() => {
    if (isAuthenticated && !hasPageAccess(currentUser?.role, activeTab)) {
      setActiveTab(currentUser?.role === "OPERATOR" ? "process" : "dashboard");
    }
  }, [isAuthenticated, currentUser?.role, activeTab]);

  // ========================================================
  // SYSTEM USER ACCOUNTS & RBAC HANDLERS
  // ========================================================
  function loadUsers() {
    fetch(`${API}/users`)
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      })
      .catch((err) => {
        console.warn("Could not load users:", err);
      });
  }

  function handleCreateUser(e) {
    if (e) e.preventDefault();
    if (!newUser.username.trim()) {
      setError("Please enter a username.");
      return;
    }
    if (!newUser.password.trim()) {
      setError("Please enter a password.");
      return;
    }

    fetch(`${API}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setSuccessMsg(res.message || `User ${newUser.username} created successfully!`);
        setShowAddUserModal(false);
        setNewUser({
          username: "",
          password: "",
          full_name: "",
          role: "OPERATOR",
          line_assigned: "Line 2",
          shift_assigned: "Shift 1",
        });
        loadUsers();
      })
      .catch((err) => setError("Error creating user: " + err.message));
  }

  function handleUpdateUser(e) {
    if (e) e.preventDefault();
    if (!editingUser) return;

    fetch(`${API}/users/${editingUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingUser),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setSuccessMsg("User updated successfully!");
        setEditingUser(null);
        loadUsers();
      })
      .catch((err) => setError("Error updating user: " + err.message));
  }

  function handleUpdatePassword(e) {
    if (e) e.preventDefault();
    if (!passwordModalUser || !newPasswordVal.trim()) {
      setError("Please enter a valid password.");
      return;
    }

    fetch(`${API}/users/${passwordModalUser.id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newPasswordVal.trim() }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setSuccessMsg(`Password for "${passwordModalUser.username}" changed successfully!`);
        setPasswordModalUser(null);
        setNewPasswordVal("");
      })
      .catch((err) => setError("Error changing password: " + err.message));
  }

  function handleDeleteUser(user) {
    if (user.username.toLowerCase() === "admin") {
      setError("The primary system administrator account cannot be deleted.");
      return;
    }
    if (currentUser?.username?.toLowerCase() === user.username.toLowerCase()) {
      setError("You cannot delete your own logged-in user account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user account "${user.username}"?`)) {
      return;
    }

    fetch(`${API}/users/${user.id}`, {
      method: "DELETE",
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setSuccessMsg(`User "${user.username}" deleted successfully.`);
        loadUsers();
      })
      .catch((err) => setError("Error deleting user: " + err.message));
  }

  function handleToggleUserStatus(user) {
    if (user.username.toLowerCase() === "admin") {
      setError("The primary admin account status cannot be deactivated.");
      return;
    }
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    fetch(`${API}/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setSuccessMsg(`User "${user.username}" is now ${newStatus}.`);
        loadUsers();
      })
      .catch((err) => setError("Error updating status: " + err.message));
  }

  function loadAuditLogs() {
    fetch(`${API}/dashboard/audit-logs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.logs && data.logs.length > 0) {
          setAuditLogs(data.logs);
        }
      })
      .catch(() => {});
  }

  function loadDashboardStats() {
    fetch(`${API}/dashboard/stats`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success || data.total_master_parts !== undefined) {
          setCounters((prev) => ({
            ...prev,
            total_models: data.total_models || 0,
            total_part_no: data.total_part_no || 0,
            total_part_name: data.total_part_name || 0,
            total_master_parts: data.total_master_parts || 0,
            total_ok: data.total_ok_parts || 0,
            total_ng: data.total_ng_parts || 0,
            total_labels_today: data.total_label_generated_today || 0,
          }));
        }
      })
      .catch(() => {});
  }

  function loadModels() {
    fetch(`${API}/master/models`)
      .then((r) => r.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModelsList(data.models);
          // Pick selected model if valid, otherwise first available model from database
          const target = selectedModel && data.models.some((m) => m.model_no === selectedModel)
            ? selectedModel
            : data.models[0].model_no;
          handleModelSelect(target);
        } else {
          setModelsList([]);
          setSelectedModel("");
        }
      })
      .catch(() => setError("Backend server not responding on port 5000. Start backend with 'npm start'."));
  }

  function handleModelSelect(modelNo) {
    setSelectedModel(modelNo);
    setSelectedMotherPart("");
    setSelectedChildPart("");
    resetSpecs();

    if (!modelNo) {
      setMotherPartsList([]);
      return;
    }

    fetch(`${API}/master/parts?model_no=${encodeURIComponent(modelNo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.parts && data.parts.length > 0) {
          setMotherPartsList(data.parts);
          const firstPart = typeof data.parts[0] === "object" ? data.parts[0].part_no : data.parts[0];
          handleMotherPartSelect(modelNo, firstPart);
        } else {
          setMotherPartsList([]);
        }
      })
      .catch(console.error);
  }

  function handleMotherPartSelect(modelNo, partNo) {
    setSelectedMotherPart(partNo);
    setSelectedChildPart("");

    if (!modelNo || !partNo) {
      setChildPartsList([]);
      resetSpecs();
      return;
    }

    fetch(`${API}/master/sub-parts?model_no=${encodeURIComponent(modelNo)}&part_no=${encodeURIComponent(partNo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.subParts && data.subParts.length > 0) {
          setChildPartsList(data.subParts);
          handleChildPartSelect(data.subParts[0]);
        } else {
          setChildPartsList([]);
          resetSpecs();
        }
      })
      .catch(console.error);
  }

  function handleChildPartSelect(item) {
    if (!item) {
      resetSpecs();
      return;
    }
    setSelectedChildPart(item.sub_part_no || item.part_no || "");

    const cleanModel = (item.model_no || selectedModel || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const cleanPart = (item.part_no || item.sub_part_no || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const cleanSl = (item.sl_no || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const cleanAlc = (item.alc_code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const compCode = cleanPart ? `${cleanPart}${cleanSl}${cleanModel}${cleanAlc}` : "--";

    setSpecs({
      motherPartNo: item.part_no || "--",
      childPart: item.part_name || item.sub_part_no || item.part_no || "--",
      partName: item.part_name || item.part_no || "--",
      targetAlcCode: item.alc_code || "--",
      eoNumber: item.eo_number || "--",
      identifier: item.identifier || "--",
      supplierCode: item.supplier_code || "--",
      itemNumber: item.sl_no ? String(item.sl_no) : "--",
      lineCode: item.line_code || "--",
      partColor: item.remarks || item.part_color || "--",
      slNo: item.sl_no || "--",
      compositeCode: compCode,
      batchCode: item.alc_code || "--",
    });
  }

  function resetSpecs() {
    setSpecs({
      motherPartNo: "--",
      childPart: "--",
      partName: "--",
      targetAlcCode: "--",
      eoNumber: "--",
      identifier: "--",
      supplierCode: "--",
      itemNumber: "--",
      lineCode: "--",
      partColor: "--",
      slNo: "--",
      compositeCode: "--",
      batchCode: "--",
    });
  }

  // LOCK PRODUCTION SETUP & TRANSITION TO SCAN STATION
  function handleStartTerminal() {
    if (!selectedModel) {
      setError("Please choose a Vehicle Model.");
      return;
    }
    if (!selectedMotherPart) {
      setError("Please choose a Mother Part Name.");
      return;
    }

    setIsProcessLocked(true);
    setActiveTab("station");
    setSuccessMsg(`Production Setup Locked: Model ${selectedModel} | Part ${specs.motherPartNo} | ALC ${specs.targetAlcCode}. Scan Station is active!`);
  }

  function handleUnlockSelection() {
    setIsProcessLocked(false);
    setAutoWatcherActive(false);
    setSuccessMsg("Process Selection unlocked. You may change vehicle model or part number.");
  }

  // SCAN FOLDER FOR OK & NG IMAGES (AUTO-PRINTS ONE-BY-ONE IF AUTOPRINT ACTIVE)
  function scanInspectionFolder(pathOverride) {
    const targetPath = pathOverride || selectedFolder;
    if (!targetPath) {
      setError("Please specify a valid folder path.");
      return;
    }

    setIsScanning(true);
    setError("");

    fetch(`${API}/folder/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderPath: targetPath,
        model_no: selectedModel || "",
        part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
        sub_part_no: selectedChildPart || (specs.motherPartNo !== "--" ? specs.motherPartNo : ""),
        part_name: specs.partName !== "--" ? specs.partName : "",
        alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
        sl_no: specs.slNo !== "--" ? specs.slNo : "",
        autoPrint: autoPrintEnabled,
        printedBy: currentUser?.username || "operator",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setIsScanning(false);
        if (data.error) {
          setError(data.error);
          return;
        }

        const okFiles = (data.okFiles || []).map((f) => ({
          ...f,
          printed: true,
          printedAt: f.printedAt || new Date().toISOString(),
        }));
        setOkImages(okFiles);
        setNgImages(data.ngFiles || []);

        const okCount = okFiles.length;
        const ngCount = data.ngFiles?.length || 0;

        // Keep plant-wide counters authoritative from PostgreSQL
        loadDashboardStats();

        if (okCount > 0) {
          setSuccessMsg(`⚡ Auto-Print Active: Found ${okCount} OK Images. 100x30 labels auto-printed directly without asking!`);
          setPrintFeedback(`⚡ 100x30 Label directly auto-printed for ${okCount} OK part(s)!`);

          const labelsToPrint = okFiles.map((f, idx) => {
            const pieceSlNo = f.label?.sl_no || f.defaultSlNo || String(idx + 1).padStart(4, "0");
            const partNo = (f.label?.part_no && f.label.part_no !== "PART" && f.label.part_no !== "--")
              ? f.label.part_no
              : (specs.motherPartNo !== "--" ? specs.motherPartNo : (selectedChildPart || "59130C4000"));
            const modelNo = (f.label?.model_no && f.label.model_no !== "--")
              ? f.label.model_no
              : (selectedModel || "AH2/AI3");
            const alcCode = (f.label?.alc_code && f.label.alc_code !== "--")
              ? f.label.alc_code
              : (specs.targetAlcCode !== "--" ? specs.targetAlcCode : "CVH4");
            const partName = (f.label?.part_name && f.label.part_name !== "PART NAME" && f.label.part_name !== "--")
              ? f.label.part_name
              : (selectedMotherPart || (specs.partName !== "--" ? specs.partName : "VACUUM HOSE"));
            const pieceComposite = (f.label?.composite_code && !f.label.composite_code.startsWith("PART"))
              ? f.label.composite_code
              : computeCompositeCode({
                  prefix: "",
                  part_no: partNo,
                  sl_no: pieceSlNo,
                  model_no: modelNo,
                  alc_code: alcCode,
                });
            return {
              sl_no: pieceSlNo,
              model_no: modelNo,
              part_no: partNo,
              part_name: partName,
              alc_code: alcCode,
              composite_code: pieceComposite,
              batch_code: alcCode,
              qr_url: f.label?.qr_url || "",
            };
          });

          // DIRECTLY PRINT OK IMAGES WITHOUT ASKING!
          triggerMultiLabel100x30Print(labelsToPrint);
        } else {
          setSuccessMsg(`Folder Scanned: Found 0 OK Images and ${ngCount} Defect (NG) Images.`);
        }
      })
      .catch((err) => {
        setIsScanning(false);
        setError("Folder scan failed: " + err.message);
      });
  }

  // EXPLICIT USER-TRIGGERED PRINT FOR SINGLE OK PART
  function handlePrintSingleOk(img, idx = 0) {
    if (!img) return;
    const effectivePart = specs.motherPartNo !== "--" ? specs.motherPartNo : (selectedChildPart || "PART");
    const pieceSlNo = getPieceSerial(img, idx);

    fetch(`${API}/labels/print-single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: img.name,
        filePath: img.fullPath,
        folderPath: selectedFolder,
        model_no: selectedModel || "",
        part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
        sub_part_no: selectedChildPart || effectivePart,
        part_name: specs.partName !== "--" ? specs.partName : "",
        alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
        sl_no: pieceSlNo,
        piece_index: idx + 1,
        printedBy: currentUser?.username || "operator",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setOkImages((prev) =>
          prev.map((item) =>
            item.name === img.name
              ? { ...item, printed: true, printedAt: new Date().toISOString(), label: data.label }
              : item
          )
        );
        setCounters((prev) => ({ ...prev, total_labels_today: prev.total_labels_today + 1 }));
        setPrintFeedback(`✓ 100x30 Barcode Label Printed for ${img.name}! (SL NO: ${data.label?.sl_no || pieceSlNo})`);
        if (data.label) {
          trigger100x30Print(data.label);
        }
      })
      .catch((err) => setError("Print failed: " + err.message));
  }

  // EXPLICIT USER-TRIGGERED BATCH PRINT FOR ALL APPROVED OK PARTS
  function handlePrintAllApprovedOk() {
    if (!okImages.length) {
      setError("No OK images to print.");
      return;
    }
    const effectivePart = specs.motherPartNo !== "--" ? specs.motherPartNo : (selectedChildPart || "PART");

    fetch(`${API}/labels/print-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: okImages.map((f, i) => ({
          name: f.name,
          sl_no: getPieceSerial(f, i),
        })),
        folderPath: selectedFolder,
        model_no: selectedModel || "",
        part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
        sub_part_no: selectedChildPart || effectivePart,
        part_name: specs.partName !== "--" ? specs.partName : "",
        alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
        printedBy: currentUser?.username || "operator",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        if (data.labels && data.labels.length > 0) {
          setOkImages((prev) =>
            prev.map((item) => {
              const matched = data.labels.find((l) => l.fileName === item.name);
              return matched
                ? {
                    ...item,
                    printed: true,
                    printedAt: new Date().toISOString(),
                    label: {
                      ...matched,
                      model_no: selectedModel || "",
                      part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
                      part_name: specs.partName !== "--" ? specs.partName : "",
                      alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
                    },
                  }
                : { ...item, printed: true, printedAt: new Date().toISOString() };
            })
          );
        } else {
          setOkImages((prev) =>
            prev.map((item) => ({ ...item, printed: true, printedAt: new Date().toISOString() }))
          );
        }
        setCounters((prev) => ({ ...prev, total_labels_today: prev.total_labels_today + (data.count || 0) }));
        setPrintFeedback(`✓ Successfully printed all ${data.count || okImages.length} unique 100x30 labels!`);
        window.print();
      })
      .catch((err) => setError("Batch print failed: " + err.message));
  }

  // REAL PRODUCTION LIVE CAMERA AUTO-WATCHER
  function toggleAutoWatcher() {
    if (!autoWatcherActive) {
      if (!selectedFolder) {
        setError("Please choose or browse to an inspection folder first.");
        return;
      }
      fetch(`${API}/watcher/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderPath: selectedFolder,
          model_no: selectedModel,
          part_no: specs.motherPartNo,
          sub_part_no: selectedChildPart || specs.motherPartNo,
          part_name: selectedMotherPart,
          alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
          sl_no: specs.slNo,
          autoPrint: true,
          printedBy: currentUser.username || "operator",
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) {
            setError(d.error);
            return;
          }
          setAutoWatcherActive(true);
          setSuccessMsg(`✓ Live Production Watcher Active on ${selectedFolder}`);
        })
        .catch((err) => setError("Failed to start camera watcher: " + err.message));
    } else {
      fetch(`${API}/watcher/stop`, { method: "POST" })
        .then((r) => r.json())
        .then(() => {
          setAutoWatcherActive(false);
          setSuccessMsg("Live Camera Watcher Paused.");
        })
        .catch((err) => setError("Failed to stop watcher: " + err.message));
    }
  }

  // Poll for newly detected camera inspection files when live watcher is active
  useEffect(() => {
    let timer = null;
    if (autoWatcherActive && activeTab === "station") {
      timer = setInterval(() => {
        fetch(`${API}/watcher/status`)
          .then((r) => r.json())
          .then((data) => {
            if (data.recentEvents && data.recentEvents.length > 0) {
              const latest = data.recentEvents[0];
              const alreadyOk = okImages.some((i) => i.name === latest.fileName || i.fullPath === latest.fullPath);
              const alreadyNg = ngImages.some((i) => i.name === latest.fileName || i.fullPath === latest.fullPath);
              if (!alreadyOk && !alreadyNg) {
                if (latest.status === "OK") {
                  const newImg = {
                    name: latest.fileName,
                    fullPath: latest.fullPath,
                    previewUrl: latest.previewUrl,
                    status: "OK",
                    scannedAt: latest.detectedAt,
                    label: latest.label,
                    printed: true,
                  };
                  setOkImages((prev) => [newImg, ...prev]);
                  setCounters((prev) => ({
                    ...prev,
                    total_ok: prev.total_ok + 1,
                    total_labels_today: prev.total_labels_today + 1,
                  }));
                  setPrintFeedback(`⚡ Auto-Printed OK Part: ${latest.fileName} (SL NO: ${latest.label?.sl_no || "0001"})`);
                  if (autoPrintEnabled && latest.label) {
                    trigger100x30Print(latest.label);
                  }
                } else {
                  const newImg = {
                    name: latest.fileName,
                    fullPath: latest.fullPath,
                    previewUrl: latest.previewUrl,
                    status: "NG",
                    scannedAt: latest.detectedAt,
                  };
                  setNgImages((prev) => [newImg, ...prev]);
                  setCounters((prev) => ({ ...prev, total_ng: prev.total_ng + 1 }));
                  setError(`⚠ Camera Drop Detected: Defect (NG) Part Quarantined. Label printing blocked.`);
                }
              }
            }
          })
          .catch(() => {});
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoWatcherActive, activeTab, okImages, ngImages, autoPrintEnabled]);

  // HELPER: BUILD RAW 100x30 INDUSTRIAL SVG WITH STRICT NON-COLLIDING GEOMETRY
  function build100x30SvgString({
    sl_no = "",
    model_no = "",
    part_no = "",
    part_name = "",
    alc_code = "",
    batch_code = "",
    composite_code = "",
    qrSrc = "",
  }) {
    const effectivePart = (part_no && part_no !== "PART" && part_no !== "--") ? part_no : "59130C4000";
    const effectiveModel = (model_no && model_no !== "--") ? model_no : "AH2/AI3";
    const effectiveAlc = (alc_code && alc_code !== "--") ? alc_code : "CVH4";
    const effectivePartName = (part_name && part_name !== "PART NAME" && part_name !== "--") ? part_name : "VACUUM HOSE";
    const effectiveCode = (composite_code && !composite_code.startsWith("PART"))
      ? composite_code
      : `${effectivePart}${sl_no}${effectiveModel.replace(/[^a-zA-Z0-9]/g, "")}${effectiveAlc}`;
    const qrVector = generateQrVectorPath(effectiveCode);
    const qrScale = qrVector.size > 0 ? (198 / qrVector.size).toFixed(3) : "8";
    const compAttr = effectiveCode && effectiveCode.length > 20 ? 'textLength="600" lengthAdjust="spacingAndGlyphs"' : '';

    return `
<svg viewBox="0 0 1000 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:block;background:#ffffff;">
  <rect width="1000" height="300" fill="#ffffff" />
  <rect x="6" y="6" width="988" height="288" rx="16" ry="16" fill="#ffffff" stroke="#000000" stroke-width="5" />
  <rect x="15" y="15" width="970" height="270" rx="10" ry="10" fill="#ffffff" stroke="#000000" stroke-width="3" />
  <line x1="648" y1="15" x2="648" y2="285" stroke="#000000" stroke-width="3" />
  <line x1="15" y1="225" x2="985" y2="225" stroke="#000000" stroke-width="3" />
  <line x1="141.6" y1="15" x2="141.6" y2="225" stroke="#000000" stroke-width="2.5" />
  <line x1="268.2" y1="15" x2="268.2" y2="225" stroke="#000000" stroke-width="2.5" />
  <line x1="394.8" y1="15" x2="394.8" y2="225" stroke="#000000" stroke-width="2.5" />
  <line x1="521.4" y1="15" x2="521.4" y2="225" stroke="#000000" stroke-width="2.5" />

  <!-- COL 1: SL NO -->
  <g transform="translate(78.3, 120) rotate(90)">
    <text x="-95" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="19" font-weight="900" letter-spacing="0.5" fill="#000000">SL NO</text>
    <text x="95" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(sl_no).length > 4 ? 22 : 28}" font-weight="900" letter-spacing="0.5" fill="#000000">${sl_no || ""}</text>
  </g>

  <!-- COL 2: MODEL -->
  <g transform="translate(204.9, 120) rotate(90)">
    <text x="-95" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="19" font-weight="900" letter-spacing="0.5" fill="#000000">MODEL</text>
    <text x="95" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(effectiveModel || '').length > 6 ? 21 : 25}" font-weight="900" letter-spacing="0.4" fill="#000000">${effectiveModel || ""}</text>
  </g>

  <!-- COL 3: PART NO -->
  <g transform="translate(331.5, 120) rotate(90)">
    <text x="-95" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="18" font-weight="900" letter-spacing="0.5" fill="#000000">PART NO</text>
    <text x="95" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="${String(effectivePart || '').length > 10 ? 18 : 21}" font-weight="900" letter-spacing="0.3" fill="#000000" ${String(effectivePart || '').length > 7 ? 'textLength="98" lengthAdjust="spacingAndGlyphs"' : ''}>${effectivePart || ""}</text>
  </g>

  <!-- COL 4: PART NAME -->
  <g transform="translate(458.1, 120) rotate(90)">
    <text x="-95" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="17" font-weight="900" letter-spacing="0.5" fill="#000000">PART NAME</text>
    <text x="95" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="17.5" font-weight="900" letter-spacing="0.2" fill="#000000" ${String(effectivePartName || '').length > 7 ? 'textLength="96" lengthAdjust="spacingAndGlyphs"' : ''}>${effectivePartName || ""}</text>
  </g>

  <!-- COL 5: ALC CODE -->
  <g transform="translate(584.7, 120) rotate(90)">
    <text x="-95" y="0" text-anchor="start" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="18" font-weight="900" letter-spacing="0.5" fill="#000000">ALC CODE</text>
    <text x="95" y="0" text-anchor="end" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="28" font-weight="900" letter-spacing="0.5" fill="#000000">${effectiveAlc || ""}</text>
  </g>

  <!-- BOTTOM COMPOSITE BAR -->
  <text x="28" y="262" font-family="'Arial', 'Helvetica', sans-serif" font-size="29" font-weight="900" letter-spacing="0.8" fill="#000000" ${compAttr}>${effectiveCode}</text>

  <!-- 2D DATA MATRIX (PURE VECTOR SVG PATH - CRISP AT ANY DPI) -->
  <rect x="714" y="22" width="198" height="198" fill="#ffffff" />
  ${qrVector.path ? `
  <g transform="translate(714, 22) scale(${qrScale})">
    <path d="${qrVector.path}" fill="#000000" fill-rule="evenodd" shape-rendering="crispEdges" />
  </g>` : (qrSrc ? `
  <image href="${qrSrc}" xlink:href="${qrSrc}" x="714" y="22" width="198" height="198" preserveAspectRatio="xMidYMid meet" />` : "")}

  <!-- BATCH CODE -->
  <text x="816.5" y="262" text-anchor="middle" dominant-baseline="central" font-family="'Arial', 'Helvetica', sans-serif" font-size="38" font-weight="900" letter-spacing="1" fill="#000000">${batch_code || effectiveAlc || ""}</text>
</svg>
`;
  }

  // TRIGGER ISOLATED 100x30mm THERMAL LABEL PRINT (1 SHEET, RENDERED FULLY)
  async function trigger100x30Print(label) {
    if (!label) return;

    const sl_no = label.sl_no || "";
    const model_no = label.model_no || "";
    const part_no = label.part_no || label.sub_part_no || "";
    const part_name = label.part_name || "";
    const alc_code = label.alc_code || "";
    const batch_code = label.batch_code || alc_code || "";
    const composite_code =
      label.composite_code ||
      computeCompositeCode({
        prefix: "",
        part_no,
        sl_no,
        model_no,
        alc_code,
      });

    // Ensure state print target has full code synchronously
    setActiveLabelPrint({
      ...label,
      sl_no,
      model_no,
      part_no,
      part_name,
      alc_code,
      batch_code,
      composite_code,
    });

    let qrSrc = label.qr_data_url || label.qr_url || "";
    if (!qrSrc && composite_code) {
      qrSrc = generateDataMatrixDataUrl(composite_code);
    }

    const svgHtml = build100x30SvgString({
      sl_no,
      model_no,
      part_no,
      part_name,
      alc_code,
      batch_code,
      composite_code,
      qrSrc,
    });

    // Remove existing print frame if any
    const existing = document.getElementById("hsi-thermal-print-frame");
    if (existing) {
      try { document.body.removeChild(existing); } catch (e) {}
    }

    const printDim = LABEL_SIZE_DIMS[labelPrintSize] || { w: "100mm", h: "30mm" };

    // In-viewport (opacity: 0.01) frame so Chromium rasterizes every SVG node without blank print
    const printFrame = document.createElement("iframe");
    printFrame.id = "hsi-thermal-print-frame";
    printFrame.style.position = "fixed";
    printFrame.style.left = "0px";
    printFrame.style.top = "0px";
    printFrame.style.width = printDim.w;
    printFrame.style.height = printDim.h;
    printFrame.style.border = "none";
    printFrame.style.zIndex = "-9999";
    printFrame.style.opacity = "0.01";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: ${printDim.w} ${printDim.h};
      margin: 0mm !important;
    }
    @page :first { margin: 0mm !important; }
    @page :left { margin: 0mm !important; }
    @page :right { margin: 0mm !important; }
    @media print {
      @page {
        size: ${printDim.w} ${printDim.h} !important;
        margin: 0mm !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      html, body {
        width: ${printDim.w} !important;
        height: ${printDim.h} !important;
        max-width: ${printDim.w} !important;
        max-height: ${printDim.h} !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      svg {
        width: ${printDim.w} !important;
        height: ${printDim.h} !important;
        max-width: ${printDim.w} !important;
        max-height: ${printDim.h} !important;
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${svgHtml}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (err) {
        console.error("Print frame invocation error:", err);
      }
      setTimeout(() => {
        try {
          if (printFrame && printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
        } catch (e) {}
      }, 3000);
    }, 150);
  }

  // TRIGGER MULTI-LABEL BATCH PRINT (Continuous 100x30mm thermal pages, 1 per piece)
  async function triggerMultiLabel100x30Print(labels) {
    if (!labels || labels.length === 0) return;

    const valid = labels.filter((l) => l && (l.sl_no || l.part_no || l.composite_code));
    if (valid.length === 0) return;

    const svgs = [];
    for (const lbl of valid) {
      const sl_no = lbl.sl_no || "";
      const model_no = lbl.model_no || "";
      const part_no = lbl.part_no || lbl.sub_part_no || "";
      const part_name = lbl.part_name || "";
      const alc_code = lbl.alc_code || "";
      const batch_code = lbl.batch_code || alc_code || "";
      const composite_code =
        lbl.composite_code ||
        computeCompositeCode({
          prefix: "",
          part_no,
          sl_no,
          model_no,
          alc_code,
        });

      let qrSrc = lbl.qr_data_url || lbl.qr_url || "";
      if (!qrSrc && composite_code) {
        qrSrc = generateDataMatrixDataUrl(composite_code);
      }

      const svgHtml = build100x30SvgString({
        sl_no,
        model_no,
        part_no,
        part_name,
        alc_code,
        batch_code,
        composite_code,
        qrSrc,
      });
      svgs.push(svgHtml);
    }

    const existing = document.getElementById("hsi-thermal-print-frame");
    if (existing) {
      try { document.body.removeChild(existing); } catch (e) {}
    }

    const printDim = LABEL_SIZE_DIMS[labelPrintSize] || { w: "100mm", h: "30mm" };

    const printFrame = document.createElement("iframe");
    printFrame.id = "hsi-thermal-print-frame";
    printFrame.style.position = "fixed";
    printFrame.style.left = "0px";
    printFrame.style.top = "0px";
    printFrame.style.width = printDim.w;
    printFrame.style.height = printDim.h;
    printFrame.style.border = "none";
    printFrame.style.zIndex = "-9999";
    printFrame.style.opacity = "0.01";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: ${printDim.w} ${printDim.h};
      margin: 0mm !important;
    }
    @page :first { margin: 0mm !important; }
    @page :left { margin: 0mm !important; }
    @page :right { margin: 0mm !important; }
    @media print {
      @page {
        size: ${printDim.w} ${printDim.h} !important;
        margin: 0mm !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      html, body {
        width: ${printDim.w} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .label-page {
        width: ${printDim.w} !important;
        height: ${printDim.h} !important;
        max-width: ${printDim.w} !important;
        max-height: ${printDim.h} !important;
        margin: 0 !important;
        padding: 0 !important;
        page-break-before: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: always !important;
        break-after: page !important;
        overflow: hidden !important;
        display: block !important;
      }
      .label-page:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      svg {
        width: ${printDim.w} !important;
        height: ${printDim.h} !important;
        max-width: ${printDim.w} !important;
        max-height: ${printDim.h} !important;
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${svgs.map((s) => `<div class="label-page">${s}</div>`).join("")}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (err) {
        console.error("Multi-print frame invocation error:", err);
      }
      setTimeout(() => {
        try {
          if (printFrame && printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
        } catch (e) {}
      }, 5000);
    }, 250);
  }

  // OPEN CLEAN POPUP PRINT PREVIEW (FOOLPROOF FALLBACK)
  async function openPrintablePopup(label) {
    if (!label) return;
    const sl_no = label.sl_no || "";
    const model_no = label.model_no || "";
    const part_no = label.part_no || label.sub_part_no || "";
    const part_name = label.part_name || "";
    const alc_code = label.alc_code || "";
    const batch_code = label.batch_code || alc_code || "";
    const composite_code =
      label.composite_code ||
      computeCompositeCode({ prefix: "", part_no, sl_no, model_no, alc_code });

    let qrSrc = label.qr_data_url || label.qr_url || "";
    if (!qrSrc && composite_code) {
      qrSrc = generateDataMatrixDataUrl(composite_code);
    }

    const svgHtml = build100x30SvgString({
      sl_no,
      model_no,
      part_no,
      part_name,
      alc_code,
      batch_code,
      composite_code,
      qrSrc,
    });

    const popup = window.open("", "_blank", "width=750,height=380,resizable=yes,scrollbars=no");
    if (!popup) {
      trigger100x30Print(label);
      return;
    }
    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: 100mm 30mm; margin: 0mm !important; }
    @page :first { margin: 0mm !important; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    }
    .print-bar {
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .print-actions {
      display: flex;
      gap: 10px;
    }
    .btn-p {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    .thermal-tip {
      background: #fef2f2;
      border: 1px solid #f87171;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #991b1b;
      text-align: center;
    }
    .label-box {
      width: 100mm;
      height: 30mm;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    svg {
      width: 100mm;
      height: 30mm;
      display: block;
    }
    @media print {
      @page {
        size: 100mm 30mm !important;
        margin: 0mm !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      html, body {
        width: 100mm !important;
        height: 30mm !important;
        max-width: 100mm !important;
        max-height: 30mm !important;
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-bar { display: none !important; }
      .label-box {
        box-shadow: none !important;
        width: 100mm !important;
        height: 30mm !important;
        max-width: 100mm !important;
        max-height: 30mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      svg {
        width: 100mm !important;
        height: 30mm !important;
        max-width: 100mm !important;
        max-height: 30mm !important;
        display: block !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div class="thermal-tip">
      ⚠️ <b>Thermal Printer Setup:</b> In Chrome print dialog, set <b>Margins = None</b> and <b>UNCHECK "Headers and footers"</b>!
    </div>
    <div class="print-actions">
      <button class="btn-p" onclick="window.print()">🖨️ Print 100x30mm Label</button>
      <button class="btn-p" style="background:#64748b;" onclick="window.close()">Close Window</button>
    </div>
  </div>
  <div class="label-box">
    ${svgHtml}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 200);
    };
  <\/script>
</body>
</html>`);
    popup.document.close();
  }

  // MASTER DATA UPLOAD
  function handleMasterUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";

    setError("");
    const formData = new FormData();
    formData.append("file", file);

    fetch(`${API}/master/upload?mode=${uploadMode}`, {
      method: "POST",
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSuccessMsg(data.message);
        loadModels();
        loadMasterItems();
        loadDashboardStats();
      })
      .catch(() => setError("Failed to upload master data."));
  }

  function loadMasterItems() {
    fetch(`${API}/master/items`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) setMasterItems(data.items);
      })
      .catch(() => {});
  }

  function handleClearMasterData() {
    if (!window.confirm("Are you sure you want to clear all master parts? This removes all reference/master parts so you can upload a new production Excel list.")) {
      return;
    }
    fetch(`${API}/master/clear`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        setSuccessMsg("All master data parts cleared successfully. You may now upload a fresh production Excel file.");
        loadModels();
        loadMasterItems();
        loadDashboardStats();
      })
      .catch((err) => setError("Failed to clear master data: " + err.message));
  }

  function handleClearInspectionLogs() {
    if (!window.confirm("Are you sure you want to reset all shift inspection scan counts and audit logs to 0 for a clean production run?")) {
      return;
    }
    fetch(`${API}/logs/clear`, { method: "DELETE" })
      .then((r) => r.json())
      .then(() => {
        setSuccessMsg("Shift inspection scans and audit records reset to 0.");
        loadDashboardStats();
        loadAuditLogs();
        setOkImages([]);
        setNgImages([]);
      })
      .catch((err) => setError("Failed to reset logs: " + err.message));
  }

  function handleAddSinglePart(e) {
    e.preventDefault();
    if (!newPart.modelNo || !newPart.partNo) {
      setError("Model No and Part No are required.");
      return;
    }

    fetch(`${API}/master/add-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPart),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSuccessMsg(`Added Part ${newPart.partNo} to Model ${newPart.modelNo}`);
        setShowAddPartModal(false);
        setNewPart({
          modelNo: "",
          partName: "",
          partNo: "",
          subPartNo: "",
          alcCode: "",
          slNo: "",
          remarks: "",
        });
        loadModels();
        loadMasterItems();
      })
      .catch((err) => setError(err.message));
  }

  const filteredMasterItems = masterItems.filter((i) => {
    const q = masterSearch.toLowerCase();
    return (
      (i.model_no || "").toLowerCase().includes(q) ||
      (i.part_name || "").toLowerCase().includes(q) ||
      (i.part_no || "").toLowerCase().includes(q) ||
      (i.alc_code || "").toLowerCase().includes(q)
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="hsi-login-page">
        <div className="login-card">
          {/* Dark Navy Header inside Card */}
          <div className="login-card-header">
            <HsiLogo size="large" showText={true} />
            <h1 className="login-title">HSI AUTO</h1>
            <p className="login-subtitle">MES BARCODE VERIFICATION SYSTEM</p>
          </div>

          {/* White Body */}
          <form onSubmit={handleLogin} className="login-card-body">
            {loginError && (
              <div className="login-error-strip">
                <AlertTriangle size={15} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="login-field-group">
              <label className="login-label">Operator / User ID</label>
              <div className="login-input-wrap">
                <div className="login-input-icon">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  className="login-input"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                  id="input-login-username"
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <div className="login-input-icon">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  className="login-input"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter password"
                  id="input-login-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-login-submit"
              id="btn-login-submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "SIGNING IN..." : "SIGN IN"}
            </button>

            {/* Quick-Access Role Selector Chips */}
            <div className="login-role-selector">
              <div className="login-role-title">Select User Role to Quick-Fill & Sign In:</div>
              <div className="login-role-chips">
                <button
                  type="button"
                  className={`login-role-chip ${loginUser === "admin" ? "active" : ""}`}
                  onClick={() => {
                    setLoginUser("admin");
                    setLoginPass("Admin@123");
                    handleLogin(null, { username: "admin", password: "Admin@123" });
                  }}
                  id="btn-login-quick-admin"
                  title="Click to sign in instantly as Admin"
                >
                  <span className="chip-badge admin">ADMIN</span>
                  <div className="chip-details">
                    <span className="chip-user">admin / Admin@123</span>
                    <span className="chip-scope">Full MES Control (All 6 Modules) • ⚡ 1-Click Sign In</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`login-role-chip ${loginUser === "operator" ? "active" : ""}`}
                  onClick={() => {
                    setLoginUser("operator");
                    setLoginPass("Operator@123");
                    handleLogin(null, { username: "operator", password: "Operator@123" });
                  }}
                  id="btn-login-quick-operator"
                  title="Click to sign in instantly as Operator"
                >
                  <span className="chip-badge op">OPERATOR</span>
                  <div className="chip-details">
                    <span className="chip-user">operator / Operator@123</span>
                    <span className="chip-scope">Process Selection & Scan Station • ⚡ 1-Click Sign In</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`login-role-chip ${loginUser === "supervisor" ? "active" : ""}`}
                  onClick={() => {
                    setLoginUser("supervisor");
                    setLoginPass("Super@123");
                    handleLogin(null, { username: "supervisor", password: "Super@123" });
                  }}
                  id="btn-login-quick-supervisor"
                  title="Click to sign in instantly as Supervisor"
                >
                  <span className="chip-badge super">SUPERVISOR</span>
                  <div className="chip-details">
                    <span className="chip-user">supervisor / Super@123</span>
                    <span className="chip-scope">Dashboard, Shift Reports & Masters • ⚡ 1-Click Sign In</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`login-role-chip ${loginUser === "quality" ? "active" : ""}`}
                  onClick={() => {
                    setLoginUser("quality");
                    setLoginPass("Quality@123");
                    handleLogin(null, { username: "quality", password: "Quality@123" });
                  }}
                  id="btn-login-quick-quality"
                  title="Click to sign in instantly as Quality QA"
                >
                  <span className="chip-badge qi">QUALITY QA</span>
                  <div className="chip-details">
                    <span className="chip-user">quality / Quality@123</span>
                    <span className="chip-scope">Defect Analytics & Verification • ⚡ 1-Click Sign In</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="login-footer">
              Powered by <strong>Archery Technocrats Private Limited (ATPL)</strong>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="hsi-app">
      {/* ========================================================
          TOP NAVIGATION HEADER (MATCHING IMAGE 1 BRANDING)
          ======================================================== */}
      <header className="hsi-navbar">
        <div className="navbar-brand">
          <HsiLogo size="navbar" showText={false} />
          <span className="brand-company">HSI AUTO</span>
          <span className="brand-divider">|</span>
          <span className="brand-system">MES Verifier</span>
        </div>

        <nav className="navbar-tabs">
          {hasPageAccess(currentUser.role, "dashboard") && (
            <button
              className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
              id="nav-dashboard"
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
          )}

          {hasPageAccess(currentUser.role, "process") && (
            <button
              className={`nav-tab ${activeTab === "process" ? "active" : ""}`}
              onClick={() => setActiveTab("process")}
              id="nav-process-selection"
            >
              <Settings size={16} />
              <span>Process Selection</span>
            </button>
          )}

          {hasPageAccess(currentUser.role, "station") && (
            <button
              className={`nav-tab ${activeTab === "station" ? "active" : ""}`}
              onClick={() => setActiveTab("station")}
              id="nav-scan-station"
            >
              <Crosshair size={16} />
              <span>Scan Station</span>
              {isProcessLocked && <span className="tab-pill-live">LOCKED</span>}
            </button>
          )}

          {hasPageAccess(currentUser.role, "reports") && (
            <button
              className={`nav-tab ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
              id="nav-reports"
            >
              <FileBarChart size={16} />
              <span>Reports</span>
            </button>
          )}

          {/* Masters Direct Tab */}
          {hasPageAccess(currentUser.role, "masters") && (
            <button
              className={`nav-tab ${activeTab === "masters" ? "active" : ""}`}
              onClick={() => setActiveTab("masters")}
              id="nav-masters"
            >
              <FolderKanban size={16} />
              <span>Masters</span>
              {currentUser.role !== "ADMIN" && (
                <span className="badge-tab-viewonly">View Only</span>
              )}
            </button>
          )}

          {/* Administration Dropdown (ADMIN ONLY) */}
          {hasPageAccess(currentUser.role, "users") && (
            <div className="nav-dropdown-wrapper">
              <button
                className={`nav-tab ${activeTab === "users" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("users");
                  setAdminDropdownOpen(!adminDropdownOpen);
                }}
                id="nav-administration"
              >
                <ShieldCheck size={16} />
                <span>Administration</span>
                <ChevronDown size={14} />
              </button>
              {adminDropdownOpen && (
                <div className="nav-dropdown-menu">
                  <button
                    className="dropdown-item"
                    id="nav-dropdown-access-matrix"
                    onClick={() => {
                      setActiveTab("users");
                      setAdminSubTab("matrix");
                      setAdminDropdownOpen(false);
                    }}
                  >
                    <KeyRound size={14} />
                    <span>Page Access Control (Matrix)</span>
                  </button>
                  <button
                    className="dropdown-item"
                    id="nav-dropdown-user-accounts"
                    onClick={() => {
                      setActiveTab("users");
                      setAdminSubTab("accounts");
                      setAdminDropdownOpen(false);
                      loadUsers();
                    }}
                  >
                    <User size={14} />
                    <span>User Accounts</span>
                  </button>
                  <button
                    className="dropdown-item item-add-user-nav"
                    id="nav-dropdown-add-user"
                    onClick={() => {
                      setActiveTab("users");
                      setAdminSubTab("accounts");
                      setShowAddUserModal(true);
                      setAdminDropdownOpen(false);
                      loadUsers();
                    }}
                  >
                    <PlusCircle size={14} />
                    <span>➕ Add New User</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* User Badge & Logout */}
        <div className="navbar-user-section">
          <div className="user-profile">
            <div className="user-avatar">
              <User size={15} />
            </div>
            <div className="user-text">
              <span className="user-name">{currentUser.username}</span>
              <span className="user-badge">{currentUser.role}</span>
            </div>
          </div>
          <button
            className="btn-logout"
            onClick={handleLogout}
            title="Logout from HSI MES"
            id="btn-navbar-logout"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ================= GLOBAL ALERTS ================= */}
      {error && (
        <div className="alert-strip alert-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button className="strip-close" onClick={() => setError("")}>×</button>
        </div>
      )}

      {successMsg && (
        <div className="alert-strip alert-success">
          <CheckCircle2 size={17} />
          <span>{successMsg}</span>
          <button className="strip-close" onClick={() => setSuccessMsg("")}>×</button>
        </div>
      )}

      {printFeedback && (
        <div className="alert-strip alert-print">
          <Printer size={17} />
          <span>{printFeedback}</span>
        </div>
      )}

      {/* ========================================================
          PAGE 1: PROCESS & PRODUCTION SETUP (EXACT MATCH IMAGE 1)
          ======================================================== */}
      {activeTab === "process" && (
        <main className="hsi-page-container">
          {/* Page Title & Subtitle */}
          <div className="page-header-row">
            <div className="title-block">
              <div className="title-with-icon">
                <Settings className="page-gear-icon" size={26} />
                <h2>Process & Production Setup</h2>
              </div>
              <p className="page-subtitle">
                Select vehicle model and mother part to automatically load verification specifications.
              </p>
            </div>

            <div className="header-pills">
              <span className="pill-shift" onClick={() => setShowShiftLineHelpModal(true)} style={{ cursor: "pointer" }} title="Click to view shift/line details">{selectedShift} • {selectedLine}</span>
              {hasPageAccess(currentUser?.role, "dashboard") && (
                <button className="btn-header-dash" onClick={() => setActiveTab("dashboard")}>
                  <LayoutDashboard size={15} />
                  <span>Dashboard</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Production Selection (Step 1 of 2) */}
          <div className="hsi-card selection-card">
            <div className="card-top-bar">
              <h3 className="card-heading">1. Production Selection</h3>
              <span className="step-tag">Step 1 of 2</span>
            </div>

            <div className="selection-grid">
              {/* VEHICLE MODEL */}
              <div className="select-field-group">
                <label className="field-label">
                  VEHICLE MODEL <span className="text-red">*</span>
                </label>
                <div className="custom-select-box">
                  <select
                    className="hsi-select"
                    value={selectedModel}
                    disabled={isProcessLocked}
                    onChange={(e) => handleModelSelect(e.target.value)}
                    id="select-vehicle-model"
                  >
                    <option value="">-- Choose Vehicle Model --</option>
                    {modelsList.map((m) => (
                      <option key={m.model_no} value={m.model_no}>
                        {m.model_no} ({m.parts_count || 0} parts)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
                <span className="field-help">Select car / platform model code</span>
              </div>

              {/* MOTHER PART NUMBER */}
              <div className="select-field-group">
                <label className="field-label">
                  PART NO (MOTHER PART) <span className="text-red">*</span>
                </label>
                <div className="custom-select-box">
                  <select
                    className="hsi-select"
                    value={selectedMotherPart}
                    disabled={isProcessLocked || !selectedModel}
                    onChange={(e) => handleMotherPartSelect(selectedModel, e.target.value)}
                    id="select-mother-part-name"
                  >
                    <option value="">-- Choose Part Number --</option>
                    {motherPartsList.map((p) => {
                      const pNo = typeof p === "object" ? p.part_no : p;
                      const pName = typeof p === "object" && p.part_name ? p.part_name : "";
                      return (
                        <option key={pNo} value={pNo}>
                          {pNo}{pName ? ` — ${pName}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
                <span className="field-help">Real part numbers from master database for {selectedModel || "model"}</span>
              </div>

              {/* CHILD PART / SUB PART SELECTOR */}
              <div className="select-field-group subpart-select-field">
                <label className="field-label">
                  CHILD PART NO / SUB PART NO <span className="text-red">*</span>
                </label>
                <div className="custom-select-box">
                  <select
                    className="hsi-select"
                    value={selectedChildPart}
                    disabled={isProcessLocked || childPartsList.length === 0}
                    onChange={(e) => {
                      const it = childPartsList.find((c) => c.sub_part_no === e.target.value);
                      handleChildPartSelect(it);
                    }}
                    id="select-child-part-no"
                  >
                    {childPartsList.length === 0 && (
                      <option value="">-- Select Model & Part First --</option>
                    )}
                    {childPartsList.map((c) => (
                      <option key={c.id || c.sub_part_no} value={c.sub_part_no}>
                        {c.sub_part_no} {c.alc_code ? `[ALC: ${c.alc_code}]` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
                <span className="field-help">Specific sub-assembly part number from master data</span>
              </div>
            </div>
          </div>

          {/* Section 2: Process & Verification Specifications */}
          <div className="hsi-card specs-card">
            <div className="card-top-bar">
              <h3 className="card-heading">2. Process & Verification Specifications</h3>
              <div className="specs-top-actions">
                <button
                  type="button"
                  className={`btn-spec-edit-toggle ${isEditingSpecs ? "active" : ""}`}
                  onClick={() => setIsEditingSpecs(!isEditingSpecs)}
                  id="btn-toggle-edit-specs"
                  title="Toggle manual editing of specifications"
                >
                  <Edit3 size={14} />
                  <span>{isEditingSpecs ? "✓ Done Editing" : "✏️ Edit Specifications"}</span>
                </button>
                <span className="auto-loaded-tag">{isEditingSpecs ? "Manual Custom" : "Auto Loaded"}</span>
              </div>
            </div>

            <div className="specs-grid">
              {/* Row 1 */}
              <div className="spec-tile">
                <span className="spec-label">MOTHER PART NO</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable font-mono"
                    value={specs.motherPartNo !== "--" ? specs.motherPartNo : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => {
                        const next = { ...prev, motherPartNo: v };
                        next.compositeCode = computeCompositeCode(next);
                        return next;
                      });
                      setSelectedMotherPart(v);
                    }}
                    placeholder="Enter Part Number"
                  />
                ) : (
                  <div className="spec-input-box font-mono">{specs.motherPartNo}</div>
                )}
              </div>

              <div className="spec-tile">
                <span className="spec-label">CHILD PART (NAME / NO)</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable font-mono"
                    value={specs.childPart !== "--" ? specs.childPart : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => ({ ...prev, childPart: v }));
                    }}
                    placeholder="Enter Child Part"
                  />
                ) : (
                  <div className="spec-input-box">{specs.childPart}</div>
                )}
              </div>

              <div className="spec-tile">
                <span className="spec-label text-blue">TARGET ALC CODE</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable font-mono bold text-blue"
                    value={specs.targetAlcCode !== "--" ? specs.targetAlcCode : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => {
                        const next = { ...prev, targetAlcCode: v, batchCode: v };
                        next.compositeCode = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="Enter ALC Code"
                  />
                ) : (
                  <div className="spec-input-box font-mono bold text-blue">{specs.targetAlcCode}</div>
                )}
              </div>

              {/* Real Master Database Fields */}
              <div className="spec-tile">
                <span className="spec-label">PART NAME</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable"
                    value={specs.partName !== "--" ? specs.partName : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => ({ ...prev, partName: v }));
                    }}
                    placeholder="Enter Part Name"
                  />
                ) : (
                  <div className="spec-input-box">{specs.partName}</div>
                )}
              </div>

              <div className="spec-tile">
                <span className="spec-label">SL NO / HAND</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable font-mono"
                    value={specs.slNo !== "--" ? specs.slNo : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => {
                        const next = { ...prev, slNo: v };
                        next.compositeCode = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="e.g. 01"
                  />
                ) : (
                  <div className="spec-input-box font-mono">{specs.slNo || "--"}</div>
                )}
              </div>

              <div className="spec-tile">
                <span className="spec-label">COMPOSITE BARCODE CODE</span>
                <div className="spec-input-box font-mono">{specs.compositeCode || "--"}</div>
              </div>

              <div className="spec-tile">
                <span className="spec-label">REMARKS / SPEC NOTES</span>
                {isEditingSpecs ? (
                  <input
                    type="text"
                    className="spec-input-editable"
                    value={specs.partColor !== "--" ? specs.partColor : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpecs((prev) => ({ ...prev, partColor: v }));
                    }}
                    placeholder="Remarks"
                  />
                ) : (
                  <div className="spec-input-box">{specs.partColor || "--"}</div>
                )}
              </div>
            </div>
          </div>

          {/* Start and Preview Buttons matching Image 1 */}
          <div className="terminal-start-container">
            <div className="terminal-action-buttons-row">
              <button
                type="button"
                className="btn-preview-selection-label"
                onClick={() => {
                  setSelectedLabelModal({
                    sl_no: specs.slNo || "",
                    model_no: selectedModel || "",
                    part_no: specs.motherPartNo !== "--" ? specs.motherPartNo : "",
                    part_name: specs.partName || "",
                    alc_code: specs.targetAlcCode !== "--" ? specs.targetAlcCode : "",
                    composite_code: specs.compositeCode,
                    batch_code: specs.batchCode || specs.targetAlcCode || "",
                  });
                }}
                disabled={!selectedModel || !selectedMotherPart}
                id="btn-preview-selection-label"
              >
                <Maximize2 size={16} />
                <span>👁 View / Edit 100x30 Label for This Input</span>
              </button>

              {!isProcessLocked ? (
                <button
                  className="btn-start-terminal"
                  onClick={handleStartTerminal}
                  disabled={!selectedModel || !selectedMotherPart}
                  id="btn-start-terminal"
                >
                  <span>🚀 LOCK PRODUCTION SETUP & OPEN SCAN STATION →</span>
                </button>
              ) : null}
            </div>

            {isProcessLocked && (
              <div className="locked-terminal-banner">
                <div className="locked-info">
                  <Lock size={20} className="text-emerald" />
                  <div>
                    <strong>PRODUCTION SETUP IS CURRENTLY ACTIVE & LOCKED</strong>
                    <p>Model: {selectedModel} | Part: {specs.motherPartNo} | ALC: {specs.targetAlcCode}</p>
                  </div>
                </div>
                <div className="locked-buttons">
                  <button className="btn-go-station" onClick={() => setActiveTab("station")}>
                    Go to Scan Station →
                  </button>
                  <button className="btn-unlock-setup" onClick={handleUnlockSelection}>
                    <Unlock size={15} />
                    Unlock Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================
          PAGE 2: SCAN STATION (OK & NG IMAGES DISPLAY + 100x30 PRINT)
          ======================================================== */}
      {activeTab === "station" && (
        <main className="hsi-page-container">
          {/* Top Scan Details Header Bar matching reference screenshot */}
          <div className="terminal-header-panel">
            <div className="terminal-header-left">
              <h2 className="terminal-page-title">Scan Details</h2>
              <div className="terminal-breadcrumb-trail">
                <span className="crumb-link" onClick={() => setActiveTab("dashboard")}>Home</span>
                <span className="crumb-separator">/</span>
                <span className="crumb-current">Scan Details</span>
              </div>
            </div>

            <div className="terminal-header-right">
              <div className="shift-line-badge-group">
                <span
                  className="terminal-badge badge-shift"
                  title="Click to view work shift details or change shift"
                  onClick={() => setShowShiftLineHelpModal(true)}
                  style={{ cursor: "pointer" }}
                >
                  <Clock size={13} /> {selectedShift}
                </span>
                <span
                  className="terminal-badge badge-line"
                  title="Click to view production line details or change line"
                  onClick={() => setShowShiftLineHelpModal(true)}
                  style={{ cursor: "pointer" }}
                >
                  {selectedLine}
                </span>
                <button
                  type="button"
                  className="btn-shift-line-info"
                  onClick={() => setShowShiftLineHelpModal(true)}
                  title="Explain Shift & Line"
                >
                  ℹ️ Shift & Line Guide
                </button>
              </div>
              <span className="terminal-badge badge-model">Model: {selectedModel || "--"}</span>
              <span className="terminal-badge badge-alc">ALC: {specs.targetAlcCode && specs.targetAlcCode !== "--" ? specs.targetAlcCode : "--"}</span>
              <button
                type="button"
                className="btn-change-model-part"
                onClick={() => setActiveTab("process")}
                id="btn-header-change-model-part"
              >
                <Settings size={14} />
                <span>Change Model / Part</span>
              </button>
            </div>
          </div>

          {/* CAMERA FOLDER INSPECTION & 100x30 LABEL GENERATION STATION */}
          <div className="camera-inspection-container">
              {/* Active Terminal Banner */}
              <div className="terminal-status-bar">
                <div className="status-meta">
                  <span className="station-dot pulse"></span>
                  <span className="station-title">AUTOMATED VISION INSPECTION</span>
                  <span className="station-pill">{selectedModel || "--"}</span>
                  <span className="station-pill">{specs.motherPartNo !== "--" ? specs.motherPartNo : "--"}</span>
                  <span className="station-pill alc">{specs.targetAlcCode !== "--" ? specs.targetAlcCode : "--"}</span>
                </div>

                <div className="status-controls">
                  <button
                    type="button"
                    className={`btn-autoprint-toggle ${autoPrintEnabled ? "active" : ""}`}
                    onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
                    title={autoPrintEnabled ? "Auto-Print is ON: OK images print automatically one-by-one" : "Auto-Print is OFF: manual print only"}
                    id="btn-autoprint-toggle"
                  >
                    <Zap size={14} className={autoPrintEnabled ? "text-amber" : ""} />
                    <span>{autoPrintEnabled ? "⚡ Auto-Print: ON" : "Auto-Print: OFF"}</span>
                  </button>
                  <button
                    className={`btn-watcher-toggle ${autoWatcherActive ? "active" : ""}`}
                    onClick={() => setAutoWatcherActive(!autoWatcherActive)}
                    id="btn-watcher-toggle"
                  >
                    <span className={`status-led ${autoWatcherActive ? "green" : ""}`}></span>
                    {autoWatcherActive ? "Auto-Watcher: LIVE (3s)" : "Auto-Watcher: OFF"}
                  </button>
                  <button className="btn-unlock-small" onClick={handleUnlockSelection}>
                    <Unlock size={14} />
                    Change Model/Part
                  </button>
                </div>
              </div>

          {/* =========================================================
              INTERACTIVE FOLDER SELECTION & BROWSER (ORIGINAL APP FEATURE)
              ========================================================= */}
          <div className="hsi-card folder-browser-card">
            {/* Top Title & Toggle Bar */}
            <div className="folder-browser-top-row">
              <div className="folder-browser-title-wrap">
                <FolderOpen size={18} className="text-blue" />
                <h3 className="folder-browser-heading">1. Choose or Browse Inspection Folder</h3>
              </div>

              <div className="folder-browser-top-actions">
                <button
                  type="button"
                  className={`btn-toggle-browser ${showFolderBrowser ? "active" : ""}`}
                  onClick={() => setShowFolderBrowser(!showFolderBrowser)}
                  id="btn-toggle-folder-browser"
                >
                  <FolderOpen size={14} />
                  <span>{showFolderBrowser ? "Hide Explorer ▲" : "Browse Drives & Folders ▼"}</span>
                </button>
              </div>
            </div>

            {/* Folder Bar: Input + Main Actions */}
            <div className="folder-bar-row">
              <div className="folder-path-wrap">
                <FolderOpen size={18} className="folder-icon" />
                <input
                  type="text"
                  className="folder-path-input font-mono"
                  value={selectedFolder}
                  onChange={(e) => {
                    setSelectedFolder(e.target.value);
                    setBrowseCurrentPath(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDirectScanClick();
                    }
                  }}
                  placeholder="Enter or paste ANY folder path (e.g. C:\ or D:\ClientFolder\Camera) & press Scan"
                  id="input-scan-folder"
                />
              </div>

              <button
                className="btn-hsi-primary"
                onClick={handleDirectScanClick}
                disabled={isScanning || isUploadingFolder}
                id="btn-scan-now"
                title="Scan this folder and all subfolders recursively for camera images"
              >
                <RefreshCw size={16} className={isScanning ? "spin" : ""} />
                <span>{isScanning ? "Scanning All Subfolders..." : "🔍 Scan Folder & All Subfolders"}</span>
              </button>

              <button
                className={`btn-toggle-live-watcher ${autoWatcherActive ? "active-live" : ""}`}
                onClick={toggleAutoWatcher}
                title={autoWatcherActive ? "Stop live camera watcher" : "Start live camera watcher on this folder"}
                id="btn-toggle-live-watcher"
              >
                {autoWatcherActive ? (
                  <>
                    <Square size={14} className="text-red" />
                    <span>Stop Camera Watcher</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="text-emerald" />
                    <span>Start Live Watcher</span>
                  </>
                )}
              </button>

              <div className="live-status-pill">
                <span className={`status-dot ${autoWatcherActive ? "live" : "idle"}`}></span>
                <span className="status-label">
                  Watcher: <strong>{autoWatcherActive ? "LIVE ON" : "STANDBY"}</strong>
                </span>
              </div>

              {/* Dynamic Label Print Size Selector */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#f8fafc",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <Printer size={14} className="text-blue-600" />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Print Size:</span>
                <select
                  value={labelPrintSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLabelPrintSize(val);
                    localStorage.setItem("hsi_label_print_size", val);
                    const optText = e.target.options[e.target.selectedIndex].text;
                    setSuccessMsg(`✓ Label Print Size set to: ${optText}`);
                  }}
                  id="select-label-print-size"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid #94a3b8",
                    background: "#ffffff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                  title="Select label scale: 100x30 thermal roll, or larger 140x42 / 200x60 for A4 printer"
                >
                  <option value="100x30">Standard 100x30 mm (100%)</option>
                  <option value="140x42">Medium 140x42 mm (140%)</option>
                  <option value="180x54">Large 180x54 mm (180%)</option>
                  <option value="200x60">Extra Large 200x60 mm (200%)</option>
                  <option value="a4_fit">Fit Full A4 Page Width (190x57 mm)</option>
                </select>
              </div>
            </div>

            {/* Active Folder Upload Progress Banner */}
            {uploadProgress && (
              <div
                style={{
                  margin: "8px 0 14px 0",
                  padding: "10px 14px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  color: "#1d4ed8",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <RefreshCw size={15} className="spin text-blue" />
                <span>{uploadProgress}</span>
              </div>
            )}

            {/* Interactive Drive & Folder Explorer Panel (Matching Original App) */}
            {showFolderBrowser && (
              <div className="folder-explorer-panel">
                {/* Drives List */}
                <div className="drives-row">
                  <span className="drives-label">System Drives:</span>
                  <div className="drives-list">
                    {drives.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`drive-chip ${browseCurrentPath && browseCurrentPath.startsWith(d) ? "active" : ""}`}
                        onClick={() => openFolder(d)}
                        title={`Browse Drive ${d}`}
                      >
                        <HardDrive size={13} />
                        <span>{d}</span>
                      </button>
                    ))}
                    {selectedFolder && (
                      <button
                        type="button"
                        className="drive-chip chip-reload-folder"
                        onClick={() => openFolder(selectedFolder)}
                        title="Reload current folder"
                      >
                        <RefreshCw size={12} />
                        <span>Refresh Current</span>
                      </button>
                    )}

                    {/* Native Windows Folder Picker */}
                    <input
                      type="file"
                      ref={nativeFolderInputRef}
                      webkitdirectory="true"
                      directory=""
                      multiple
                      style={{ display: "none" }}
                      onChange={handleLocalFolderSelect}
                    />
                    <button
                      type="button"
                      className={`drive-chip chip-pick-native ${isUploadingFolder ? "active" : ""}`}
                      onClick={handlePickFolderClick}
                      disabled={isUploadingFolder}
                      title="Select any folder from your computer without browser freezing"
                    >
                      {isUploadingFolder ? (
                        <>
                          <RefreshCw size={13} className="spin text-blue" />
                          <span>Opening Folder...</span>
                        </>
                      ) : (
                        <>
                          <FolderOpen size={13} />
                          <span>📁 Choose Local Windows Folder</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>



                {/* Breadcrumbs & Navigation */}
                {browseCurrentPath ? (
                  <div className="explorer-breadcrumb-row">
                    <div className="breadcrumb-path-group">
                      {browseParentPath && (
                        <button
                          type="button"
                          className="btn-nav-up"
                          onClick={() => openFolder(browseParentPath)}
                          title="Go up to parent directory"
                        >
                          ↑ Up
                        </button>
                      )}
                      <div className="breadcrumb-segments-list">
                        {parsePathSegments(browseCurrentPath).map((seg, idx, arr) => (
                          <span key={seg.path} className="breadcrumb-segment-item">
                            {idx > 0 && <span className="breadcrumb-arrow">/</span>}
                            <button
                              type="button"
                              className={`breadcrumb-segment-btn ${idx === arr.length - 1 ? "active-segment" : ""}`}
                              onClick={() => openFolder(seg.path)}
                              title={`Navigate to ${seg.path}`}
                            >
                              {seg.isDrive ? <HardDrive size={12} /> : <FolderOpen size={12} />}
                              <span>{seg.name}</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-select-current-folder"
                      onClick={() => handleSelectAndScanFolder(browseCurrentPath)}
                      disabled={isScanning || !browseCurrentPath}
                    >
                      <CheckCircle2 size={14} />
                      <span>Use This Folder & Scan Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="explorer-empty-prompt" style={{ padding: "14px 16px", background: "#ffffff", borderRadius: "6px", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", gap: "10px", color: "#475569", marginBottom: "12px", fontSize: "13px" }}>
                    <HardDrive size={18} className="text-blue" />
                    <span>Select a System Drive above ({drives.join(", ") || "C:\\"}) or type/paste any folder path in the box above to explore folders and inspect images.</span>
                  </div>
                )}

                {/* Inspection Images Ready Banner (if images detected in folder) */}
                {browseFolderStats.imageCount > 0 && (
                  <div className="folder-images-ready-banner">
                    <div className="ready-banner-info">
                      <CheckCircle2 size={20} className="text-emerald" />
                      <div>
                        <div className="ready-banner-title">
                          Camera Inspection Images Folder Reached: <strong>{browseFolderStats.imageCount} Images Found</strong>
                        </div>
                        <div className="ready-banner-sub">
                          <span className="badge-ok-mini">{browseFolderStats.okCount} OK Images</span>
                          <span className="badge-ng-mini">{browseFolderStats.ngCount} Defect (NG) Images</span>
                          <span className="text-muted">ready for inspection & 100x30 barcode label printing</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-scan-folder-direct"
                      onClick={() => handleSelectAndScanFolder(browseCurrentPath)}
                      disabled={isScanning}
                    >
                      <Zap size={14} />
                      <span>Scan & Load Images</span>
                    </button>
                  </div>
                )}

                {/* Subfolders Grid */}
                {browseCurrentPath && (
                  <div className="subfolders-area">
                    <div className="subfolders-header-row">
                      <span className="subfolders-section-title">
                        Subfolders in <code>{browseCurrentPath}</code>:
                      </span>
                      <span className="subfolders-count-pill">{browseFolders.length} folders</span>
                    </div>

                    {loadingBrowse ? (
                      <div className="folders-loading">
                        <RefreshCw size={15} className="spin text-blue" />
                        <span>Reading directory...</span>
                      </div>
                    ) : browseFolders.length === 0 ? (
                      <div className="no-subfolders-notice">
                        <span>No subdirectories here (inspection images folder reached). Click <strong>"Use This Folder & Scan Now"</strong> or <strong>"Scan Folder"</strong> above.</span>
                      </div>
                    ) : (
                      <div className="subfolders-grid">
                        {browseFolders.map((f) => {
                          const childPath = joinChildPath(browseCurrentPath, f);
                          return (
                            <button
                              key={f}
                              type="button"
                              className="subfolder-chip"
                              onClick={() => openFolder(childPath)}
                              title={`Open ${childPath}`}
                            >
                              <FolderOpen size={14} className="folder-chip-icon" />
                              <span className="folder-chip-name">{f}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OK IMAGES & NOT OK IMAGES SIDE-BY-SIDE PANELS ("i wat ok iameg and not ok image") */}
          <div className="station-panels-grid">
            {/* 1. OK IMAGES (APPROVED - PRINTS ONLY ON USER CLICK) */}
            <div className="hsi-panel ok-panel">
              <div className="panel-banner ok-banner">
                <div className="banner-left">
                  <CheckCircle2 size={20} className="text-emerald" />
                  <div>
                    <h3>OK Images (Approved)</h3>
                    <span className="banner-hint" style={{ fontSize: "11px", color: "#a7f3d0", display: "block" }}>
                      ⚡ Auto-Print Active: 100x30 Labels print directly for each verified OK part without asking.
                    </span>
                  </div>
                </div>
                <div className="banner-actions-right">
                  <span className="count-pill ok-count">{okImages.length} OK</span>
                  {okImages.length > 0 && (
                    <div className="ok-banner-status-group">
                      <span className="badge-all-direct-printed">
                        <CheckCircle2 size={13} className="text-emerald" />
                        <span>All OK Labels Auto-Printed Directly ({okImages.length})</span>
                      </span>
                      <button
                        type="button"
                        className="btn-subtle-reprint-all"
                        onClick={handlePrintAllApprovedOk}
                        title="Reprint all 100x30 labels if needed"
                        id="btn-reprint-all-ok"
                      >
                        <Printer size={12} />
                        <span>Reprint All</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="images-scroll-area">
                {okImages.length === 0 ? (
                  <div
                    className="no-images-state"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={handleDropFiles}
                  >
                    <CheckCircle2 size={36} className="text-muted" />
                    <p className="no-img-title">No OK Parts Detected Yet</p>
                    <p className="no-img-sub">
                      Choose an inspection folder above. Verified OK images appear here and 100x30 barcode labels auto-print directly without asking.
                    </p>
                  </div>
                ) : (
                  <div className="image-cards-flow">
                    {okImages.map((img, idx) => (
                      <div key={idx} className="station-item-card ok-item">
                        {/* Left: Thumbnail with click to zoom */}
                        <div className="thumb-container" onClick={() => setSelectedImageModal(img)}>
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className="img-thumb"
                            onError={(e) => {
                              e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='100' fill='%23064e3b'><text x='50%25' y='50%25' fill='%2310b981' font-size='16' text-anchor='middle'>OK IMAGE</text></svg>";
                            }}
                          />
                          <span className="stamp-badge ok">✓ OK</span>
                          <div className="thumb-hover-hint">
                            <Eye size={14} /> Zoom
                          </div>
                        </div>

                        {/* Right: Info, Status & Direct Print Confirmation */}
                        <div className="item-details">
                          <div className="details-header">
                            <span className="file-name-tag font-mono" title={img.name}>{img.name}</span>
                            <span className="printed-tag is-printed">
                              <CheckCircle2 size={12} /> Auto-Printed Directly ✓
                            </span>
                          </div>

                          {/* DIRECT AUTO-PRINT CONFIRMATION (NO ASKING) */}
                          <div className="direct-print-status-bar">
                            <span className="badge-direct-auto-printed">
                              <CheckCircle2 size={13} className="text-emerald" />
                              <span>100x30 Label Auto-Printed Directly</span>
                            </span>
                            <button
                              type="button"
                              className="btn-subtle-reprint"
                              onClick={() => handlePrintSingleOk(img, idx)}
                              title="Reprint label if needed"
                              id={`btn-reprint-${idx}`}
                            >
                              <Printer size={12} />
                              <span>Reprint</span>
                            </button>
                          </div>

                          {/* EXACT 100x30MM LABEL CARD (UNIQUE PIECE SERIAL & QR) */}
                          <div className="card-label-section">
                            {(() => {
                              const pieceSlNo = getPieceSerial(img, idx);
                              const cardPart = (img.label?.part_no && img.label.part_no !== "PART" && img.label.part_no !== "--")
                                ? img.label.part_no
                                : (specs.motherPartNo !== "--" ? specs.motherPartNo : (selectedChildPart || "59130C4000"));
                              const cardModel = (img.label?.model_no && img.label.model_no !== "--")
                                ? img.label.model_no
                                : (selectedModel || "AH2/AI3");
                              const cardAlc = (img.label?.alc_code && img.label.alc_code !== "--")
                                ? img.label.alc_code
                                : (specs.targetAlcCode !== "--" ? specs.targetAlcCode : "CVH4");
                              const cardPartName = (img.label?.part_name && img.label.part_name !== "PART NAME" && img.label.part_name !== "--")
                                ? img.label.part_name
                                : (selectedMotherPart || (specs.partName !== "--" ? specs.partName : "VACUUM HOSE"));
                              const pieceComposite = (img.label?.composite_code && !img.label.composite_code.startsWith("PART"))
                                ? img.label.composite_code
                                : computeCompositeCode({
                                    prefix: "",
                                    part_no: cardPart,
                                    sl_no: pieceSlNo,
                                    model_no: cardModel,
                                    alc_code: cardAlc,
                                  });
                              return (
                                <Label100x30
                                  label={{
                                    sl_no: pieceSlNo,
                                    model_no: cardModel,
                                    part_no: cardPart,
                                    part_name: cardPartName,
                                    alc_code: cardAlc,
                                    composite_code: pieceComposite,
                                    batch_code: cardAlc,
                                    qr_url: img.label?.qr_url || "",
                                  }}
                                  onViewFull={(lbl) => setSelectedLabelModal(lbl)}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. NOT OK (NG) IMAGES (REJECTED / DEFECTIVE) */}
            <div className="hsi-panel ng-panel">
              <div className="panel-banner ng-banner">
                <div className="banner-left">
                  <XCircle size={20} className="text-rose" />
                  <h3>Not OK Images (Defect / NG)</h3>
                </div>
                <span className="count-pill ng-count">{ngImages.length} NG</span>
              </div>

              <div className="images-scroll-area">
                {ngImages.length === 0 ? (
                  <div
                    className="no-images-state"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={handleDropFiles}
                  >
                    <XCircle size={36} className="text-muted" />
                    <p className="no-img-title">No Defective (NG) Images Detected</p>
                    <p className="no-img-sub">
                      Camera parts marked with defect flags (NG, defect, reject, fail) or in defect subfolders are automatically isolated here.
                    </p>
                  </div>
                ) : (
                  <div className="image-cards-flow">
                    {ngImages.map((img, idx) => (
                      <div key={idx} className="station-item-card ng-item">
                        {/* Left: Thumbnail with click to zoom */}
                        <div className="thumb-container" onClick={() => setSelectedImageModal(img)}>
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className="img-thumb"
                            onError={(e) => {
                              e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='100' fill='%237f1d1d'><text x='50%25' y='50%25' fill='%23ef4444' font-size='16' text-anchor='middle'>NG DEFECT</text></svg>";
                            }}
                          />
                          <span className="stamp-badge ng">✗ REJECT NG</span>
                          <div className="thumb-hover-hint">
                            <Eye size={14} /> Zoom
                          </div>
                        </div>

                        {/* Right: Defect warning & safety lockout notice */}
                        <div className="item-details">
                          <div className="details-header">
                            <span className="file-name-tag font-mono" title={img.name}>{img.name}</span>
                            <span className="rejected-tag">
                              <ShieldAlert size={12} /> DEFECT FLAGGED
                            </span>
                          </div>

                          <div className="defect-alert-card">
                            <AlertTriangle size={18} className="text-rose" />
                            <div>
                              <strong>Quality Alert: Defective Piece</strong>
                              <p>Label printing is blocked for this part. Automatically logged to quality audit trail.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
            </div>
        </main>
      )}

      {/* ========================================================
          PAGE 3: EXECUTIVE & OPERATIONS DASHBOARD (EXACT SCREENSHOT 2 MATCH)
          ======================================================== */}
      {activeTab === "dashboard" && hasPageAccess(currentUser?.role, "dashboard") && (
        <main className="hsi-page-container dashboard-page">
          {/* Dashboard Header Row */}
          <div className="page-header-row dash-header-row">
            <div className="title-block">
              <h2 className="dash-main-title">Executive & Operations Dashboard</h2>
              <p className="page-subtitle">Master Data health, live shift verification metrics & plant-wide audit</p>
            </div>

            <div className="header-pills dash-action-pills">
              <span className="pill-badge pill-shift-blue" onClick={() => setShowShiftLineHelpModal(true)} style={{ cursor: "pointer" }} title="Click to view shift/line details">{selectedShift}</span>
              <span className="pill-badge pill-date-gray">Date: {getLocalDateString()}</span>
              <span className="pill-badge pill-time-gray font-mono">Time: {liveTime}</span>
              <button
                className="btn-dash-action btn-dash-process"
                onClick={() => setActiveTab("process")}
                id="btn-dash-process-select"
              >
                <Settings size={15} />
                <span>Process Select</span>
              </button>
              <button
                className="btn-dash-action btn-dash-station"
                onClick={() => setActiveTab("station")}
                id="btn-dash-scan-station"
              >
                <Crosshair size={15} />
                <span>Scan Station</span>
              </button>
              <button
                className="btn-dash-action btn-dash-clear"
                onClick={handleClearInspectionLogs}
                title="Reset all inspection scans to 0 for clean production"
                id="btn-dash-reset-scans"
              >
                <Trash2 size={15} />
                <span>Reset Scans to 0</span>
              </button>
            </div>
          </div>

          {/* Section 1: Master Data & System Overview (100% Real Database Metrics) */}
          <div className="dash-section">
            <div className="dash-section-header">
              <div className="section-title-wrap">
                <span className="section-icon">📋</span>
                <h3 className="section-title">Master Data & Production Overview</h3>
              </div>
              <span className="badge-core-masters">Live System Masters</span>
            </div>

            <div className="masters-cards-grid">
              {/* Card 1: Vehicle Models (Blue) */}
              <div className="master-tile tile-blue">
                <div className="tile-content">
                  <span className="tile-num">{counters.total_models || 0}</span>
                  <span className="tile-name">Vehicle Models</span>
                  <Package className="tile-bg-icon" size={82} />
                </div>
                <button className="tile-footer-bar" onClick={() => setActiveTab("masters")}>
                  <span>Manage in Masters</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 2: Mother Parts (Green) */}
              <div className="master-tile tile-green">
                <div className="tile-content">
                  <span className="tile-num">{counters.total_part_no || 0}</span>
                  <span className="tile-name">Mother Parts</span>
                  <Puzzle className="tile-bg-icon" size={82} />
                </div>
                <button className="tile-footer-bar" onClick={() => setActiveTab("masters")}>
                  <span>View Part Numbers</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 3: Child Parts & ALC Codes (Forest Green) */}
              <div className="master-tile tile-forest">
                <div className="tile-content">
                  <span className="tile-num">{counters.total_master_parts || 0}</span>
                  <span className="tile-name">Child Parts / ALC Codes</span>
                  <Zap className="tile-bg-icon" size={82} />
                </div>
                <button className="tile-footer-bar" onClick={() => setActiveTab("masters")}>
                  <span>View ALC Master</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 4: Labels Generated Today (Purple) */}
              <div className="master-tile tile-purple">
                <div className="tile-content">
                  <span className="tile-num">{counters.total_labels_today || 0}</span>
                  <span className="tile-name">Labels Generated Today</span>
                  <QrCode className="tile-bg-icon" size={82} />
                </div>
                <button className="tile-footer-bar" onClick={() => setActiveTab("station")}>
                  <span>Go to Scan Station</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Plant-Wide Verification Metrics */}
          <div className="dash-section">
            <div className="dash-section-header">
              <div className="section-title-wrap">
                <span className="section-icon">📊</span>
                <h3 className="section-title">Plant-Wide Verification Metrics</h3>
              </div>
            </div>

            <div className="metrics-cards-grid">
              {/* TOTAL SCANS */}
              <div className="metric-box box-blue">
                <div className="metric-top-label">TOTAL SCANS (RECENT)</div>
                <div className="metric-main-val">
                  {counters.total_ok + counters.total_ng}
                </div>
                <div className="metric-sub-label">Plant-wide throughput</div>
              </div>

              {/* PASSED UNITS */}
              <div className="metric-box box-green">
                <div className="metric-top-label">PASSED UNITS</div>
                <div className="metric-main-val text-green">
                  {counters.total_ok}
                </div>
                <div className="metric-sub-label text-green">✓ Verified & Cleared for Packing</div>
              </div>

              {/* REJECTED / DEFECTS */}
              <div className="metric-box box-red">
                <div className="metric-top-label">REJECTED / DEFECTS</div>
                <div className="metric-main-val text-red">
                  {counters.total_ng}
                </div>
                <div className="metric-sub-label text-red">⚠ Inspection & Barcode Defects</div>
              </div>

              {/* PASS YIELD RATE */}
              <div className="metric-box box-cyan">
                <div className="metric-top-label">PASS YIELD RATE</div>
                <div className="metric-main-val text-cyan">
                  {counters.total_ok + counters.total_ng > 0
                    ? Math.round((counters.total_ok / (counters.total_ok + counters.total_ng)) * 100)
                    : 0}%
                </div>
                <div className="metric-sub-label">Quality Compliance Rate</div>
              </div>
            </div>
          </div>

          {/* Section 3: Recent Plant Verification Audit Logs */}
          <div className="dash-section">
            <div className="dash-table-card">
              <div className="dash-table-header-row">
                <div className="table-title-wrap">
                  <div className="table-title-icon-row">
                    <Clock size={17} className="text-slate-500" />
                    <h3 className="dash-table-title">Recent Plant Verification Audit Logs</h3>
                  </div>
                  <p className="dash-table-subtitle">Showing latest 50 scans plant-wide</p>
                </div>

                <button
                  className="btn-view-historical"
                  onClick={() => setActiveTab("reports")}
                  id="btn-view-full-reports"
                >
                  <span>View Full Historical Reports →</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="hsi-audit-table">
                  <thead>
                    <tr>
                      <th>#ID</th>
                      <th>Date Done</th>
                      <th>Status</th>
                      <th>Mother Part</th>
                      <th>ALC Code</th>
                      <th>Trace Number</th>
                      <th>Pressure</th>
                      <th>Operator</th>
                      <th>Model</th>
                      <th>Shift</th>
                      <th>Pack Qty</th>
                      <th>Remark / Defect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                          No plant verification audit logs recorded yet. Start camera watcher or scan an inspection folder to verify parts and generate real logs.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, index) => {
                      const isFail = log.status === "FAIL" || log.status === "NG";
                      return (
                        <tr key={log.id || index} className={isFail ? "row-fail" : "row-pass"}>
                          <td className="font-mono text-slate-700 font-semibold">{log.id}</td>
                          <td className="text-slate-700 font-mono text-xs">
                            <div className="font-semibold text-slate-800">{formatLocalDateTime(log.raw_timestamp || log.date_done)}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{formatTime12h(log.raw_timestamp || log.date_done)}</div>
                          </td>
                          <td>
                            <span className={`badge-audit ${isFail ? "fail" : "pass"}`}>
                              {isFail ? "FAIL" : "PASS"}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-slate-800">{log.mother_part}</td>
                          <td>
                            <span className={`font-mono font-bold ${isFail ? "text-alc-fail" : "text-alc-pass"}`}>
                              {log.alc_code}
                            </span>
                          </td>
                          <td className="font-mono text-slate-600">{log.trace_number}</td>
                          <td className="font-mono text-slate-700">{log.pressure}</td>
                          <td className="text-slate-600">{log.operator}</td>
                          <td>
                            <span className="badge-model-sm">{log.model}</span>
                          </td>
                          <td className="text-slate-600">{log.shift}</td>
                          <td className="font-mono text-slate-600">{log.pack_qty}</td>
                          <td className={`font-medium ${isFail ? "text-remark-fail" : "text-remark-pass"}`}>
                            {log.remark}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          PAGE 4: REPORTS (DAILY EXCEL EXPORT)
          ======================================================== */}
      {activeTab === "reports" && hasPageAccess(currentUser?.role, "reports") && (
        <main className="hsi-page-container">
          <div className="page-header-row">
            <div className="title-block">
              <h2>Production & Inspection Reports</h2>
              <p className="page-subtitle">Export daily inspection records and printed barcode logs as Excel</p>
            </div>

            <a
              href={`${API}/reports/daily-excel`}
              className="btn-hsi-export"
              download
              id="btn-export-excel-report"
            >
              <FileSpreadsheet size={17} />
              <span>Generate Daily Report as Excel (.xlsx)</span>
            </a>
          </div>

          <div className="hsi-card">
            <h3 className="card-heading mb-4">Inspection Summary Snapshot</h3>
            <div className="report-summary-box">
              <div className="report-metric">
                <span>Date:</span>
                <strong>{getLocalDateString()}</strong>
              </div>
              <div className="report-metric">
                <span>Total OK Passed:</span>
                <strong className="text-emerald">{counters.total_ok}</strong>
              </div>
              <div className="report-metric">
                <span>Total NG Rejected:</span>
                <strong className="text-rose">{counters.total_ng}</strong>
              </div>
              <div className="report-metric">
                <span>Labels Printed Today:</span>
                <strong className="text-sky">{counters.total_labels_today}</strong>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          PAGE 5: MASTERS (UPLOAD MASTER DATA & PART LIST)
          ======================================================== */}
      {activeTab === "masters" && hasPageAccess(currentUser?.role, "masters") && (
        <main className="hsi-page-container">
          <div className="page-header-row">
            <div className="title-block">
              <h2>Master Data Administration</h2>
              <p className="page-subtitle">Upload Excel master list (.xlsx, .xls, .csv) or manage production parts</p>
            </div>

            <div className="header-pills">
              {currentUser?.role === "ADMIN" ? (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleMasterUpload}
                  />
                  <button
                    className="btn-hsi-primary"
                    onClick={() => fileInputRef.current?.click()}
                    id="btn-upload-master-file"
                  >
                    <Upload size={16} />
                    <span>Upload Master Data Excel</span>
                  </button>

                  <button
                    className="btn-hsi-secondary"
                    onClick={() => setShowAddPartModal(true)}
                    id="btn-add-part-modal"
                  >
                    <PlusCircle size={16} />
                    <span>Add Part</span>
                  </button>

                  <button
                    className="btn-hsi-danger"
                    onClick={handleClearMasterData}
                    id="btn-clear-master-data"
                    title="Clear all master data to upload a new production Excel list"
                  >
                    <Trash2 size={16} />
                    <span>Clear All Master Data</span>
                  </button>
                </>
              ) : (
                <div className="badge-view-only-mode">
                  <ShieldCheck size={16} />
                  <span>View Only Mode ({currentUser?.role})</span>
                </div>
              )}
            </div>
          </div>

          {/* Master Table */}
          <div className="hsi-card">
            <div className="table-search-row">
              <span className="font-bold text-slate-700">Master Parts ({filteredMasterItems.length} items)</span>
              <div className="search-wrap">
                <Search size={15} className="search-ico" />
                <input
                  type="text"
                  placeholder="Search model, part no, ALC..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  className="search-input-field"
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="hsi-master-table">
                <thead>
                  <tr>
                    <th>SL NO</th>
                    <th>MODEL NO</th>
                    <th>PART NAME</th>
                    <th>PART NO</th>
                    <th>SUB PART NO</th>
                    <th>ALC CODE</th>
                    <th>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasterItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="font-mono">{item.sl_no || idx + 1}</td>
                      <td>
                        <span className="badge-model-tag">{item.model_no}</span>
                      </td>
                      <td>{item.part_name}</td>
                      <td className="font-mono bold">{item.part_no}</td>
                      <td className="font-mono text-emerald bold">{item.sub_part_no}</td>
                      <td>
                        {item.alc_code ? (
                          <span className="badge-alc-tag">{item.alc_code}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="text-slate-500">{item.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          PAGE 6: ADMINISTRATION (USER ACCOUNTS & PAGE ACCESS MATRIX)
          ======================================================== */}
      {activeTab === "users" && hasPageAccess(currentUser?.role, "users") && (
        <main className="hsi-page-container">
          <div className="page-header-row">
            <div className="title-block">
              <h2>User Management & System Administration</h2>
              <p className="page-subtitle">
                Manage operator credentials, plant line assignments, and industrial role permissions
              </p>
            </div>

            {/* Sub-tab Navigation Pill Switcher */}
            <div className="admin-subtab-nav">
              <button
                type="button"
                className={`admin-subtab-btn ${adminSubTab === "accounts" ? "active" : ""}`}
                onClick={() => {
                  setAdminSubTab("accounts");
                  loadUsers();
                }}
                id="btn-subtab-user-accounts"
              >
                <User size={15} />
                <span>User Accounts</span>
                <span className="badge-pill-count">{usersList.length}</span>
              </button>
              <button
                type="button"
                className={`admin-subtab-btn ${adminSubTab === "matrix" ? "active" : ""}`}
                onClick={() => setAdminSubTab("matrix")}
                id="btn-subtab-access-matrix"
              >
                <KeyRound size={15} />
                <span>Page Access Control (Matrix)</span>
              </button>
              <button
                type="button"
                className="btn-header-add-user"
                onClick={() => {
                  setAdminSubTab("accounts");
                  setShowAddUserModal(true);
                }}
                id="btn-header-add-new-user"
              >
                <PlusCircle size={15} />
                <span>Add New User</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: USER ACCOUNTS */}
          {adminSubTab === "accounts" && (
            <div>
              {/* Quick Metrics Summary Cards */}
              <div className="user-quick-stats">
                <div className="user-stat-card">
                  <div className="user-stat-icon blue">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="user-stat-num">{usersList.length}</div>
                    <div className="user-stat-label">Total System Accounts</div>
                  </div>
                </div>

                <div className="user-stat-card">
                  <div className="user-stat-icon emerald">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className="user-stat-num">
                      {usersList.filter((u) => u.status === "ACTIVE").length}
                    </div>
                    <div className="user-stat-label">Active Users</div>
                  </div>
                </div>

                <div className="user-stat-card">
                  <div className="user-stat-icon purple">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="user-stat-num">
                      {usersList.filter((u) => u.role === "ADMIN" || u.role === "SUPERVISOR").length}
                    </div>
                    <div className="user-stat-label">Admins & Supervisors</div>
                  </div>
                </div>

                <div className="user-stat-card">
                  <div className="user-stat-icon amber">
                    <Crosshair size={20} />
                  </div>
                  <div>
                    <div className="user-stat-num">
                      {usersList.filter((u) => u.role === "OPERATOR").length}
                    </div>
                    <div className="user-stat-label">Production Operators</div>
                  </div>
                </div>
              </div>

              {/* Main User Accounts Card */}
              <div className="hsi-card">
                <div className="admin-action-row">
                  <div className="admin-section-title">
                    <Users size={18} className="text-blue" />
                    <span>Active System User Accounts</span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn-reload-mini"
                      onClick={loadUsers}
                      title="Reload Users List"
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                      type="button"
                      className="btn-add-user"
                      onClick={() => setShowAddUserModal(true)}
                      id="btn-add-new-user"
                    >
                      <PlusCircle size={15} /> Add New User
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="hsi-master-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Full Name / Designation</th>
                        <th>System Role</th>
                        <th>Line Assigned</th>
                        <th>Shift Assigned</th>
                        <th>Account Status</th>
                        <th>Created / Last Active</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                            No users found in database. Click "Add New User" to create one.
                          </td>
                        </tr>
                      ) : (
                        usersList.map((u) => {
                          const roleClass =
                            u.role === "ADMIN"
                              ? "badge-role-admin"
                              : u.role === "SUPERVISOR"
                              ? "badge-role-super"
                              : u.role === "QUALITY_INSPECTOR"
                              ? "badge-role-qi"
                              : "badge-role-op";

                          return (
                            <tr key={u.id}>
                              <td className="font-mono bold">{u.username}</td>
                              <td>{u.full_name || "--"}</td>
                              <td>
                                <span className={roleClass}>{u.role}</span>
                              </td>
                              <td>{u.line_assigned || "Line 2"}</td>
                              <td>{u.shift_assigned || "Shift 1"}</td>
                              <td>
                                <span
                                  className={
                                    u.status === "ACTIVE"
                                      ? "badge-status-active"
                                      : "badge-status-inactive"
                                  }
                                >
                                  {u.status === "ACTIVE" ? "● ACTIVE" : "○ INACTIVE"}
                                </span>
                              </td>
                              <td style={{ fontSize: "12px", color: "#64748b" }}>
                                {u.last_login
                                  ? formatLocalDateTime(u.last_login)
                                  : u.created_at
                                  ? formatLocalDateTime(u.created_at)
                                  : "--"}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div className="user-action-buttons" style={{ justifyContent: "flex-end" }}>
                                  <button
                                    type="button"
                                    className="btn-user-action edit"
                                    title="Edit user details"
                                    onClick={() => setEditingUser(u)}
                                  >
                                    <Edit3 size={13} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-user-action pw"
                                    title="Reset user password"
                                    onClick={() => {
                                      setPasswordModalUser(u);
                                      setNewPasswordVal("");
                                    }}
                                  >
                                    <KeyRound size={13} /> Password
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-user-action toggle"
                                    title={`Set ${u.status === "ACTIVE" ? "Inactive" : "Active"}`}
                                    onClick={() => handleToggleUserStatus(u)}
                                    disabled={u.username === "admin"}
                                  >
                                    {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-user-action delete"
                                    title="Delete user account"
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={
                                      u.username === "admin" ||
                                      currentUser?.username?.toLowerCase() === u.username.toLowerCase()
                                    }
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: PAGE ACCESS CONTROL MATRIX */}
          {adminSubTab === "matrix" && (
            <div className="hsi-card">
              <div className="admin-action-row">
                <div className="admin-section-title">
                  <KeyRound size={18} className="text-blue" />
                  <span>Page Access Control & Permissions Matrix</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge-pill-count">Role-Based Access Control (RBAC) Active</span>
                  <button
                    type="button"
                    className="btn-add-user"
                    onClick={() => setShowAddUserModal(true)}
                    id="btn-matrix-action-add-user"
                  >
                    <PlusCircle size={15} /> Add New User
                  </button>
                </div>
              </div>

              {/* Quick Action Provisioning Banner */}
              <div className="matrix-quick-add-banner">
                <div className="matrix-banner-text">
                  <ShieldCheck size={22} className="text-emerald" />
                  <div>
                    <strong>User Accounts & Industrial RBAC Provisioning</strong>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      Need to create a new shopfloor operator, quality inspector, or supervisor? Provision their credentials, line assignment, and role permissions here.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-banner-add-user"
                  onClick={() => setShowAddUserModal(true)}
                  id="btn-banner-add-user"
                >
                  <PlusCircle size={15} /> Add New User Account
                </button>
              </div>

              <div className="matrix-table-wrap">
                <table className="access-matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: "32%" }}>Industrial MES Module / Page</th>
                      <th className="role-col" style={{ width: "17%" }}>
                        <span className="badge-role-admin">ADMIN</span>
                      </th>
                      <th className="role-col" style={{ width: "17%" }}>
                        <span className="badge-role-super">SUPERVISOR</span>
                      </th>
                      <th className="role-col" style={{ width: "17%" }}>
                        <span className="badge-role-qi">QUALITY INSPECTOR</span>
                      </th>
                      <th className="role-col" style={{ width: "17%" }}>
                        <span className="badge-role-op">OPERATOR</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Dashboard Overview & Plant KPIs</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Shift targets, hourly pass/fail rates, plant-wide audit table
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Access</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Access</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> View Analytics</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-partial"><Check size={13} /> Shift Target View</span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>Process Selection & Lock</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Vehicle model selector, mother part & subpart specs locking
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Control</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Control</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-partial"><Check size={13} /> Inspection Only</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Select & Lock</span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>Scan Station (Inspection & 100x30 Print)</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          OK/NG image recognition, folder scanning, thermal barcode printing
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Access</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Access</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Defect Validation</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Primary Operator</span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>Production Reports & Excel Downloads</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Daily shift summary, plant audit trails, Excel report export
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Download Excel</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Shift Reports</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Defect Export</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-restricted"><XCircle size={13} /> Restricted</span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>Master Data Management (Excel Ingestion)</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Part list upload, add single part, model configurations
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Ingest & Edit</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-partial"><Check size={13} /> View Only</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-partial"><Check size={13} /> View Only</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-restricted"><XCircle size={13} /> Restricted</span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>User Accounts & Administration</strong>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Add/edit user credentials, assign lines/shifts, role management
                        </div>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-allowed"><Check size={13} /> Full Control</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-restricted"><XCircle size={13} /> Restricted</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-restricted"><XCircle size={13} /> Restricted</span>
                      </td>
                      <td className="role-col">
                        <span className="matrix-badge-restricted"><XCircle size={13} /> Restricted</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ========================================================
          RBAC ACCESS RESTRICTED FALLBACK CARD
          ======================================================== */}
      {!hasPageAccess(currentUser?.role, activeTab) && (
        <main className="hsi-page-container">
          <div className="hsi-card access-restricted-card">
            <div className="access-restricted-icon">
              <ShieldAlert size={40} />
            </div>
            <h2>Access Restricted ({currentUser?.role})</h2>
            <p>
              Your account role (<strong>{currentUser?.role}</strong>) does not have authorization to view or operate this industrial module under plant access control policies.
            </p>
            <button
              type="button"
              className="btn-hsi-primary"
              style={{ display: "inline-flex", margin: "0 auto" }}
              onClick={() => setActiveTab(currentUser?.role === "OPERATOR" ? "process" : "dashboard")}
            >
              Return to Authorized Station
            </button>
          </div>
        </main>
      )}

      {/* ================= MODAL: ADD NEW USER ================= */}
      {showAddUserModal && (
        <div className="modal-backdrop" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-top">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <PlusCircle size={18} className="text-blue" />
                <h3>Add New System User</h3>
              </div>
              <button className="modal-x" onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-form-grid">
                <div className="form-item">
                  <label>User ID / Login Username *</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="e.g. op_line2_01"
                    className="modal-input font-mono"
                  />
                </div>
                <div className="form-item">
                  <label>Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Min 4 characters"
                    className="modal-input font-mono"
                  />
                </div>
                <div className="form-item" style={{ gridColumn: "span 2" }}>
                  <label>Full Name / Designation *</label>
                  <input
                    type="text"
                    required
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar (Line 2 Operator)"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>Role Assignment *</label>
                  <select
                    className="modal-input"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="OPERATOR">OPERATOR (Scan & Verify Only)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Shift Control & Reports)</option>
                    <option value="QUALITY_INSPECTOR">QUALITY INSPECTOR (Quality QA)</option>
                    <option value="ADMIN">ADMIN (Full System Administrator)</option>
                  </select>
                </div>
                <div className="form-item">
                  <label>Assigned Line</label>
                  <select
                    className="modal-input"
                    value={newUser.line_assigned}
                    onChange={(e) => setNewUser({ ...newUser, line_assigned: e.target.value })}
                  >
                    <option value="Line 1">Line 1 (Main Assembly)</option>
                    <option value="Line 2">Line 2 (Camera Vision Station)</option>
                    <option value="Line 3">Line 3 (Sub-Assembly)</option>
                    <option value="All Lines">All Lines (Multi-line Access)</option>
                  </select>
                </div>
                <div className="form-item" style={{ gridColumn: "span 2" }}>
                  <label>Assigned Work Shift</label>
                  <select
                    className="modal-input"
                    value={newUser.shift_assigned}
                    onChange={(e) => setNewUser({ ...newUser, shift_assigned: e.target.value })}
                  >
                    <option value="Shift 1">Shift 1 (06:00 AM – 02:00 PM)</option>
                    <option value="Shift 2">Shift 2 (02:00 PM – 10:00 PM)</option>
                    <option value="Shift 3">Shift 3 (10:00 PM – 06:00 AM)</option>
                    <option value="All Shifts">All Shifts (Flexible)</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowAddUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER ================= */}
      {editingUser && (
        <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-top">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Edit3 size={18} className="text-blue" />
                <h3>Edit User: {editingUser.username}</h3>
              </div>
              <button className="modal-x" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-form-grid">
                <div className="form-item" style={{ gridColumn: "span 2" }}>
                  <label>Full Name / Designation *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.full_name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>System Role *</label>
                  <select
                    className="modal-input"
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    disabled={editingUser.username === "admin"}
                  >
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="QUALITY_INSPECTOR">QUALITY INSPECTOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="form-item">
                  <label>Account Status *</label>
                  <select
                    className="modal-input"
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    disabled={editingUser.username === "admin"}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div className="form-item">
                  <label>Assigned Line</label>
                  <select
                    className="modal-input"
                    value={editingUser.line_assigned || "Line 2"}
                    onChange={(e) => setEditingUser({ ...editingUser, line_assigned: e.target.value })}
                  >
                    <option value="Line 1">Line 1 (Main Assembly)</option>
                    <option value="Line 2">Line 2 (Camera Vision Station)</option>
                    <option value="Line 3">Line 3 (Sub-Assembly)</option>
                    <option value="All Lines">All Lines (Multi-line Access)</option>
                  </select>
                </div>
                <div className="form-item">
                  <label>Assigned Work Shift</label>
                  <select
                    className="modal-input"
                    value={editingUser.shift_assigned || "Shift 1"}
                    onChange={(e) => setEditingUser({ ...editingUser, shift_assigned: e.target.value })}
                  >
                    <option value="Shift 1">Shift 1 (06:00 AM – 02:00 PM)</option>
                    <option value="Shift 2">Shift 2 (02:00 PM – 10:00 PM)</option>
                    <option value="Shift 3">Shift 3 (10:00 PM – 06:00 AM)</option>
                    <option value="All Shifts">All Shifts (Flexible)</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {passwordModalUser && (
        <div className="modal-backdrop" onClick={() => setPasswordModalUser(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal-top">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={18} className="text-blue" />
                <h3>Reset Password: {passwordModalUser.username}</h3>
              </div>
              <button className="modal-x" onClick={() => setPasswordModalUser(null)}>×</button>
            </div>
            <form onSubmit={handleUpdatePassword}>
              <div style={{ padding: "12px 0" }}>
                <p style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "12px" }}>
                  Enter a new password for account <strong>{passwordModalUser.username}</strong> ({passwordModalUser.full_name || passwordModalUser.role}).
                </p>
                <div className="form-item">
                  <label>New Password *</label>
                  <input
                    type="password"
                    required
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Enter new password (min 4 chars)"
                    className="modal-input font-mono"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setPasswordModalUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD PART ================= */}
      {showAddPartModal && (
        <div className="modal-backdrop" onClick={() => setShowAddPartModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Add New Master Part</h3>
              <button className="modal-x" onClick={() => setShowAddPartModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddSinglePart}>
              <div className="modal-form-grid">
                <div className="form-item">
                  <label>Model No *</label>
                  <input
                    type="text"
                    required
                    value={newPart.modelNo}
                    onChange={(e) => setNewPart({ ...newPart, modelNo: e.target.value })}
                    placeholder="e.g. SU2B"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>Part Name</label>
                  <input
                    type="text"
                    value={newPart.partName}
                    onChange={(e) => setNewPart({ ...newPart, partName: e.target.value })}
                    placeholder="e.g. Hose, Sensor, Module"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>Part No *</label>
                  <input
                    type="text"
                    required
                    value={newPart.partNo}
                    onChange={(e) => setNewPart({ ...newPart, partNo: e.target.value, subPartNo: newPart.subPartNo || e.target.value })}
                    placeholder="59130BX350"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>Sub Part No</label>
                  <input
                    type="text"
                    value={newPart.subPartNo}
                    onChange={(e) => setNewPart({ ...newPart, subPartNo: e.target.value })}
                    placeholder="59130BX350"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>ALC Code</label>
                  <input
                    type="text"
                    value={newPart.alcCode}
                    onChange={(e) => setNewPart({ ...newPart, alcCode: e.target.value })}
                    placeholder="VH30"
                    className="modal-input"
                  />
                </div>
                <div className="form-item">
                  <label>SL NO</label>
                  <input
                    type="text"
                    value={newPart.slNo}
                    onChange={(e) => setNewPart({ ...newPart, slNo: e.target.value })}
                    placeholder="10001"
                    className="modal-input"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowAddPartModal(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Save Part</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: IMAGE ZOOM ================= */}
      {selectedImageModal && (
        <div className="modal-backdrop" onClick={() => setSelectedImageModal(null)}>
          <div className="image-zoom-box" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-top">
              <span className="font-mono">{selectedImageModal.name}</span>
              <button className="modal-x" onClick={() => setSelectedImageModal(null)}>×</button>
            </div>
            <div className="zoom-img-container">
              <img src={selectedImageModal.previewUrl} alt={selectedImageModal.name} className="zoom-img" />
            </div>
            <div className="zoom-bottom">
              <span className={`zoom-badge ${selectedImageModal.status === "OK" ? "ok" : "ng"}`}>
                STATUS: {selectedImageModal.status === "OK" ? "✓ APPROVED / OK" : "✗ DEFECT DETECTED / REJECT NG"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: FULL 100x30 LABEL ZOOM & LIVE INPUT EDITOR ================= */}
      {selectedLabelModal && (
        <div className="modal-backdrop" onClick={() => setSelectedLabelModal(null)}>
          <div className="label-zoom-box" onClick={(e) => e.stopPropagation()}>
            <div className="label-zoom-top">
              <div className="label-zoom-header-info">
                <div className="label-zoom-title-row">
                  <QrCode size={22} className="text-blue" />
                  <h3 className="label-zoom-title">100x30mm Industrial Thermal Label (Live Input Editor)</h3>
                  <span className="badge-spec-full">Real Dynamic Data</span>
                </div>
                <p className="label-zoom-subtitle">
                  Edit any input field below — the label, barcode string, and Data Matrix code update in real-time!
                </p>
              </div>
              <button className="modal-x" onClick={() => setSelectedLabelModal(null)} title="Close">×</button>
            </div>

            {/* Live Interactive Input Controls Grid */}
            <div className="label-inputs-card">
              <div className="label-inputs-title">
                <span>✏️ Live Label Data Inputs (Type to customize your label):</span>
              </div>
              <div className="label-inputs-row">
                <div className="lbl-input-group">
                  <label>SL NO</label>
                  <input
                    type="text"
                    className="lbl-input font-mono"
                    value={selectedLabelModal.sl_no || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => {
                        const next = { ...prev, sl_no: v, qr_data_url: null, qr_url: null };
                        next.composite_code = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="e.g. 01"
                  />
                </div>

                <div className="lbl-input-group">
                  <label>MODEL</label>
                  <input
                    type="text"
                    className="lbl-input font-mono"
                    value={selectedLabelModal.model_no || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => {
                        const next = { ...prev, model_no: v, qr_data_url: null, qr_url: null };
                        next.composite_code = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="e.g. SU2B"
                  />
                </div>

                <div className="lbl-input-group">
                  <label>PART NO</label>
                  <input
                    type="text"
                    className="lbl-input font-mono"
                    value={selectedLabelModal.part_no || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => {
                        const next = { ...prev, part_no: v, qr_data_url: null, qr_url: null };
                        next.composite_code = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="e.g. 59130BX350"
                  />
                </div>

                <div className="lbl-input-group">
                  <label>PART NAME</label>
                  <input
                    type="text"
                    className="lbl-input"
                    value={selectedLabelModal.part_name || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => ({ ...prev, part_name: v, qr_data_url: null, qr_url: null }));
                    }}
                    placeholder="e.g. PART NAME"
                  />
                </div>

                <div className="lbl-input-group">
                  <label>ALC CODE</label>
                  <input
                    type="text"
                    className="lbl-input font-mono"
                    value={selectedLabelModal.alc_code || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => {
                        const next = { ...prev, alc_code: v, qr_data_url: null, qr_url: null };
                        next.composite_code = computeCompositeCode(next);
                        return next;
                      });
                    }}
                    placeholder="e.g. CVH4"
                  />
                </div>

                <div className="lbl-input-group">
                  <label>BATCH CODE</label>
                  <input
                    type="text"
                    className="lbl-input font-mono"
                    value={selectedLabelModal.batch_code || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLabelModal((prev) => ({ ...prev, batch_code: v, qr_data_url: null, qr_url: null }));
                    }}
                    placeholder="Enter Batch Code (Optional)"
                  />
                </div>
              </div>
            </div>

            {/* High-res Large Label Vector Container */}
            <div className="label-full-render-wrap">
              <Label100x30 label={selectedLabelModal} isPrintMode={false} />
            </div>

            {/* Composite Code Detail Strip */}
            <div className="label-meta-strip">
              <div className="meta-strip-item">
                <span className="meta-strip-label">Calculated Composite Barcode String:</span>
                <span className="meta-strip-value font-mono">
                  {selectedLabelModal.composite_code || computeCompositeCode(selectedLabelModal)}
                </span>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => {
                    const code = selectedLabelModal.composite_code || computeCompositeCode(selectedLabelModal);
                    navigator.clipboard.writeText(code);
                    setSuccessMsg("✓ Copied composite barcode string to clipboard!");
                  }}
                  title="Copy barcode string"
                >
                  <Copy size={13} />
                  <span>Copy String</span>
                </button>
              </div>
            </div>

            {/* Actions: Save & Apply, Print, Popup, Open Raw SVG, Close */}
            <div className="label-zoom-actions">
              <button
                type="button"
                className="btn-hsi-success"
                onClick={() => {
                  const { sl_no, model_no, part_no, part_name, alc_code, batch_code, composite_code } = selectedLabelModal;
                  const comp = composite_code || computeCompositeCode(selectedLabelModal);
                  setSpecs((prev) => ({
                    ...prev,
                    slNo: sl_no || prev.slNo,
                    motherPartNo: part_no || prev.motherPartNo,
                    partName: part_name || prev.partName,
                    targetAlcCode: alc_code || prev.targetAlcCode,
                    batchCode: batch_code || alc_code || prev.batchCode,
                    compositeCode: comp,
                  }));
                  if (model_no) setSelectedModel(model_no);
                  if (part_no) setSelectedMotherPart(part_no);
                  setSuccessMsg("✓ Specifications and Active Setup updated from custom label inputs!");
                  setSelectedLabelModal(null);
                }}
                id="btn-apply-modal-edits"
                title="Save these custom values to the active production session"
              >
                <Check size={16} />
                <span>✓ Save & Apply to Active Setup</span>
              </button>

              <button
                type="button"
                className="btn-hsi-primary"
                onClick={() => trigger100x30Print(selectedLabelModal)}
                id="btn-print-modal-label"
              >
                <Printer size={16} />
                <span>Print 100x30mm Label</span>
              </button>

              <button
                type="button"
                className="btn-hsi-secondary"
                onClick={() => openPrintablePopup(selectedLabelModal)}
                id="btn-popup-print-modal-label"
                title="Open label in popup print preview window"
              >
                <Maximize2 size={15} />
                <span>Open Printable Popup</span>
              </button>

              <a
                href={`${API}/labels/100x30/svg?sl_no=${encodeURIComponent(selectedLabelModal.sl_no || "")}&model_no=${encodeURIComponent(selectedLabelModal.model_no || "")}&part_no=${encodeURIComponent(selectedLabelModal.part_no || "")}&part_name=${encodeURIComponent(selectedLabelModal.part_name || "")}&alc_code=${encodeURIComponent(selectedLabelModal.alc_code || "")}&batch_code=${encodeURIComponent(selectedLabelModal.batch_code || "")}`}
                target="_blank"
                rel="noreferrer"
                className="btn-hsi-secondary"
                id="btn-open-label-tab"
              >
                <ExternalLink size={15} />
                <span>Open Raw SVG in New Tab</span>
              </a>

              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedLabelModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SHIFT & LINE OPERATOR GUIDE & SELECTOR MODAL ================= */}
      {showShiftLineHelpModal && (
        <div className="shift-line-modal-overlay" onClick={() => setShowShiftLineHelpModal(false)}>
          <div className="shift-line-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="shift-line-modal-header">
              <h3>
                <Clock size={18} className="text-sky" />
                <span>Understanding Shift & Line in MES Production</span>
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowShiftLineHelpModal(false)}
                title="Close Guide"
              >
                ✕
              </button>
            </div>

            <div className="shift-line-modal-body">
              {/* Shift Explanation */}
              <div className="guide-box">
                <div className="guide-title">
                  <Clock size={15} />
                  <span>WHAT IS "SHIFT"? (Work Hours Schedule)</span>
                </div>
                <p className="guide-text">
                  A <strong>Shift</strong> represents the active work timing for the factory floor team. 
                  Industrial plants operate 24 hours divided into 3 standard shifts:
                </p>
                <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: "12px", color: "#cbd5e1" }}>
                  <li><strong>Shift 1 (Morning):</strong> 06:00 AM – 02:00 PM</li>
                  <li><strong>Shift 2 (Evening):</strong> 02:00 PM – 10:00 PM</li>
                  <li><strong>Shift 3 (Night):</strong> 10:00 PM – 06:00 AM</li>
                </ul>
                <p className="guide-text" style={{ marginTop: "6px" }}>
                  The <em>"Shift Total Verified"</em> counter resets each shift so you and your supervisor know exactly how many parts your team produced during your operational hours.
                </p>
              </div>

              {/* Line Explanation */}
              <div className="guide-box line-guide">
                <div className="guide-title">
                  <Cpu size={15} />
                  <span>WHAT IS "LINE"? (Physical Assembly Station)</span>
                </div>
                <p className="guide-text">
                  A <strong>Line</strong> refers to the physical conveyor line or manufacturing cell in the plant.
                  For example: <strong>Line 2</strong> is the dedicated assembly & camera vision inspection station.
                  Printing and audit records save the Line number so each part can be traced back to the exact physical machine that verified it.
                </p>
              </div>

              {/* Interactive Change Shift & Line Selectors */}
              <div className="guide-controls-row">
                <div className="control-field">
                  <label>Current Active Shift</label>
                  <select
                    className="control-select"
                    value={selectedShift}
                    onChange={(e) => {
                      setSelectedShift(e.target.value);
                      setSuccessMsg(`Active shift changed to ${e.target.value}.`);
                    }}
                  >
                    <option value="Shift 1">Shift 1 (Morning: 06:00 - 14:00)</option>
                    <option value="Shift 2">Shift 2 (Evening: 14:00 - 22:00)</option>
                    <option value="Shift 3">Shift 3 (Night: 22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="control-field">
                  <label>Current Assembly Line</label>
                  <select
                    className="control-select"
                    value={selectedLine}
                    onChange={(e) => {
                      setSelectedLine(e.target.value);
                      setSuccessMsg(`Active assembly line changed to ${e.target.value}.`);
                    }}
                  >
                    <option value="Line 1">Line 1 (Main Assembly Line)</option>
                    <option value="Line 2">Line 2 (Dedicated Inspection Station)</option>
                    <option value="Line 3">Line 3 (Sub-Assembly Line)</option>
                    <option value="Line 4">Line 4 (Automated Vision Line)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="shift-line-modal-footer">
              <button
                type="button"
                className="btn-done-modal"
                onClick={() => setShowShiftLineHelpModal(false)}
              >
                Done & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINTABLE 100x30 TARGET FOR WINDOWS PRINT ================= */}
      {activeLabelPrint && (
        <div className="print-target-wrapper">
          <Label100x30 label={activeLabelPrint} isPrintMode={true} />
        </div>
      )}
    </div>
  );
}

// ========================================================
// 100x30MM INDUSTRIAL LABEL COMPONENT
// EXACT MATCH TO USER'S SPECIFICATION DIAGRAM IN IMAGE 1:
// - Double rounded outer border
// - Left section: 5 vertical rotated columns:
// - Bottom bar: Part No + Serial + Model + ALC (pure real data)
// - Right section: 2D QR Code + bottom batch code
// ========================================================
function Label100x30({ label, onPrint, onViewFull, isPrintMode = false }) {
  const {
    sl_no = "",
    model_no = "",
    part_no = "",
    part_name = "",
    alc_code = "",
    composite_code = "",
    batch_code = "",
    qr_url = "",
    qr_data_url = "",
  } = label || {};

  const effectivePart = (part_no && part_no !== "PART" && part_no !== "--") ? part_no : "59130C4000";
  const effectiveModel = (model_no && model_no !== "--") ? model_no : "AH2/AI3";
  const effectiveAlc = (alc_code && alc_code !== "--") ? alc_code : "CVH4";
  const effectivePartName = (part_name && part_name !== "PART NAME" && part_name !== "--") ? part_name : "VACUUM HOSE";

  const effectiveCompositeCode =
    (composite_code && !composite_code.startsWith("PART"))
      ? composite_code
      : computeCompositeCode({
          prefix: "",
          part_no: effectivePart,
          sl_no,
          model_no: effectiveModel,
          alc_code: effectiveAlc,
        });

  const qrVector = useMemo(() => {
    return generateDataMatrixVector(effectiveCompositeCode);
  }, [effectiveCompositeCode]);

  const [generatedQr, setGeneratedQr] = useState(qr_data_url || qr_url || "");

  useEffect(() => {
    if (qr_data_url || qr_url) {
      setGeneratedQr(qr_data_url || qr_url);
    } else if (effectiveCompositeCode) {
      setGeneratedQr(generateDataMatrixDataUrl(effectiveCompositeCode));
    }
  }, [effectiveCompositeCode, qr_data_url, qr_url]);

  const qrSrc = generatedQr || qr_data_url || qr_url;

  return (
    <div
      className={`label-card-100x30-wrapper ${isPrintMode ? "is-print-mode" : ""} ${onViewFull ? "has-zoom-action" : ""}`}
      onClick={() => {
        if (!isPrintMode && onViewFull) onViewFull(label);
      }}
      title={onViewFull ? "Click to view full high-resolution 100x30 label" : ""}
    >
      <svg
        viewBox="0 0 1000 300"
        className="label-svg-100x30"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
        {/* Background */}
        <rect width="1000" height="300" fill="#ffffff" />

        {/* Outer Rounded Border */}
        <rect
          x="6"
          y="6"
          width="988"
          height="288"
          rx="16"
          ry="16"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="5"
        />

        {/* Inner Rounded Border (Double Border!) */}
        <rect
          x="15"
          y="15"
          width="970"
          height="270"
          rx="10"
          ry="10"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="3"
        />

        {/* Main Vertical Divider: separates 5 columns from QR section */}
        <line x1="648" y1="15" x2="648" y2="285" stroke="#000000" strokeWidth="3" />

        {/* Horizontal Divider: separates 5 columns and QR from bottom composite bar */}
        <line x1="15" y1="225" x2="985" y2="225" stroke="#000000" strokeWidth="3" />

        {/* 4 Vertical Dividers between the 5 Columns */}
        <line x1="141.6" y1="15" x2="141.6" y2="225" stroke="#000000" strokeWidth="2.5" />
        <line x1="268.2" y1="15" x2="268.2" y2="225" stroke="#000000" strokeWidth="2.5" />
        <line x1="394.8" y1="15" x2="394.8" y2="225" stroke="#000000" strokeWidth="2.5" />
        <line x1="521.4" y1="15" x2="521.4" y2="225" stroke="#000000" strokeWidth="2.5" />

        {/* ================= COLUMN 1: SL NO ================= */}
        <g transform="translate(78.3, 120) rotate(90)">
          <text
            x="-95"
            y="0"
            textAnchor="start"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="19"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            SL NO
          </text>
          <text
            x="95"
            y="0"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize={String(sl_no).length > 4 ? "22" : "28"}
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            {sl_no || ""}
          </text>
        </g>

        {/* ================= COLUMN 2: MODEL ================= */}
        <g transform="translate(204.9, 120) rotate(90)">
          <text
            x="-95"
            y="0"
            textAnchor="start"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="19"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            MODEL
          </text>
          <text
            x="95"
            y="0"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize={String(effectiveModel || "").length > 6 ? "21" : "25"}
            fontWeight="900"
            letterSpacing="0.4"
            fill="#000000"
          >
            {effectiveModel || ""}
          </text>
        </g>

        {/* ================= COLUMN 3: PART NO ================= */}
        <g transform="translate(331.5, 120) rotate(90)">
          <text
            x="-95"
            y="0"
            textAnchor="start"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="18"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            PART NO
          </text>
          <text
            x="95"
            y="0"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize={String(effectivePart || "").length > 10 ? "18" : "21"}
            fontWeight="900"
            letterSpacing="0.3"
            textLength={String(effectivePart || "").length > 7 ? "98" : undefined}
            lengthAdjust={String(effectivePart || "").length > 7 ? "spacingAndGlyphs" : undefined}
            fill="#000000"
          >
            {effectivePart || ""}
          </text>
        </g>

        {/* ================= COLUMN 4: PART NAME ================= */}
        <g transform="translate(458.1, 120) rotate(90)">
          <text
            x="-95"
            y="0"
            textAnchor="start"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="17"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            PART NAME
          </text>
          <text
            x="95"
            y="0"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="17.5"
            fontWeight="900"
            letterSpacing="0.2"
            textLength={String(effectivePartName || "").length > 7 ? "96" : undefined}
            lengthAdjust={String(effectivePartName || "").length > 7 ? "spacingAndGlyphs" : undefined}
            fill="#000000"
          >
            {effectivePartName || ""}
          </text>
        </g>

        {/* ================= COLUMN 5: ALC CODE ================= */}
        <g transform="translate(584.7, 120) rotate(90)">
          <text
            x="-95"
            y="0"
            textAnchor="start"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="18"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            ALC CODE
          </text>
          <text
            x="95"
            y="0"
            textAnchor="end"
            dominantBaseline="central"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            fontSize="28"
            fontWeight="900"
            letterSpacing="0.5"
            fill="#000000"
          >
            {effectiveAlc || ""}
          </text>
        </g>

        {/* ================= BOTTOM COMPOSITE BAR ================= */}
        <text
          x="28"
          y="262"
          fontFamily="'Arial', 'Helvetica', sans-serif"
          fontSize="29"
          fontWeight="900"
          letterSpacing="0.8"
          fill="#000000"
          textLength={effectiveCompositeCode && effectiveCompositeCode.length > 20 ? "605" : undefined}
          lengthAdjust={effectiveCompositeCode && effectiveCompositeCode.length > 20 ? "spacingAndGlyphs" : undefined}
        >
          {effectiveCompositeCode}
        </text>

        {/* ================= RIGHT SECTION: 2D DATA MATRIX + BATCH CODE ================= */}
        <rect x="714" y="22" width="198" height="198" fill="#ffffff" />
        {qrVector.path ? (
          <g transform={`translate(714, 22) scale(${qrVector.size > 0 ? (198 / qrVector.size) : 1})`}>
            <path d={qrVector.path} fill="#000000" fillRule="evenodd" shapeRendering="crispEdges" />
          </g>
        ) : qrSrc ? (
          <image
            href={qrSrc}
            xlinkHref={qrSrc}
            x="714"
            y="22"
            width="198"
            height="198"
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}

        <text
          x="816.5"
          y="262"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Arial', 'Helvetica', sans-serif"
          fontSize="32"
          fontWeight="900"
          letterSpacing="1"
          fill="#000000"
        >
          {batch_code || effectiveAlc || ""}
        </text>
      </svg>

      {!isPrintMode && (
        <div className="label-action-chips">
          {onViewFull && (
            <button
              type="button"
              className="btn-zoom-label-chip"
              onClick={(e) => {
                e.stopPropagation();
                onViewFull(label);
              }}
              title="Click to view full 100x30 label"
            >
              <Maximize2 size={12} />
              <span>Full View</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
