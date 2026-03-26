import { useState, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ── Color Tokens ──
const C = {
  bg: "#0B0F1A",
  surface: "#131825",
  surfaceHover: "#1A2035",
  card: "#171D2E",
  cardAlt: "#1E2540",
  border: "#2A3352",
  borderLight: "#3A4572",
  text: "#E8ECF4",
  textMuted: "#8892AB",
  textDim: "#5A6480",
  accent: "#6C8CFF",
  accentLight: "#8BA6FF",
  accentDim: "rgba(108,140,255,0.12)",
  accentGlow: "rgba(108,140,255,0.25)",
  green: "#4ADE80",
  greenDim: "rgba(74,222,128,0.12)",
  amber: "#FBBF24",
  amberDim: "rgba(251,191,36,0.12)",
  red: "#F87171",
  redDim: "rgba(248,113,113,0.12)",
  pink: "#F472B6",
  purple: "#A78BFA",
  cyan: "#22D3EE",
};

const PIE_COLORS = [C.accent, C.green, C.amber, C.pink, C.purple, C.cyan, C.red];

// ── DB helpers (localStorage) ──
const DB_KEY = "kyuyo_records";
const loadRecords = () => { try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { return []; } };
const saveRecords = (r) => localStorage.setItem(DB_KEY, JSON.stringify(r));

// ── Number formatting ──
const yen = (n) => "¥" + Math.round(n).toLocaleString();
const pct = (n) => n.toFixed(1) + "%";
const hrs = (n) => n.toFixed(1) + "h";

// ── Shared styles ──
const pill = (active) => ({
  padding: "6px 16px",
  borderRadius: 20,
  border: `1px solid ${active ? C.accent : C.border}`,
  background: active ? C.accentDim : "transparent",
  color: active ? C.accentLight : C.textMuted,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all .2s",
});

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .2s",
};

const btnPrimary = {
  padding: "12px 28px",
  borderRadius: 12,
  border: "none",
  background: `linear-gradient(135deg, ${C.accent}, #8B6CFF)`,
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform .15s, box-shadow .2s",
  boxShadow: `0 4px 20px ${C.accentGlow}`,
};

const btnSecondary = {
  padding: "10px 20px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.textMuted,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all .2s",
};

// ── Stat card component ──
function StatCard({ label, value, sub, color = C.accent, icon }) {
  return (
    <div style={{
      background: C.card,
      borderRadius: 16,
      padding: "20px",
      border: `1px solid ${C.border}`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: color, opacity: 0.06,
      }} />
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [screen, setScreen] = useState("home"); // home | confirm | batchResult | dashboard | trend | settings
  const [records, setRecords] = useState(loadRecords);
  const [currentData, setCurrentData] = useState(null);
  const [inputMode, setInputMode] = useState("upload"); // upload | manual
  const [files, setFiles] = useState([]); // [{file, preview, status, parsed, error}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [trendFilter, setTrendFilter] = useState("all"); // all | salary | bonus
  const [trendYear, setTrendYear] = useState(null); // selected year for annual estimate
  const [trendSelectedYM, setTrendSelectedYM] = useState(null); // clicked month for inline summary
  const [trendYearCompare, setTrendYearCompare] = useState(false); // yearly comparison mode
  const [showStickyFilter, setShowStickyFilter] = useState(true); // toggle sticky filter visibility
  const [prevScreen, setPrevScreen] = useState(null); // track where we came from
  const fileRef = useRef();

  // Form state for manual / confirm
  const [form, setForm] = useState({
    yearMonth: new Date().toISOString().slice(0, 7),
    grossPay: "",
    netPay: "",
    totalHours: "",
    overtimeHours: "",
    overtimePay: "",
    deductions: "",
    workStyle: "weekdays", // weekdays | sat_work | shift | short_time
    customDaysOff: "",     // for shift: number of days off per month
    dailyHours: "8",       // standard daily work hours
    weeklyDays: "5",       // days per week (for short_time)
    payType: "salary",     // salary | bonus
    dayCountMode: "scheduled", // scheduled | attendance
  });

  useEffect(() => { saveRecords(records); }, [records]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  // ── File handling (multi) ──
  const validateFile = (f) => {
    const allowed = ["application/pdf"];
    if (!allowed.includes(f.type)) return "PDF形式のみ対応しています";
    if (f.size > 10 * 1024 * 1024) return "10MB超過";
    return null;
  };

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    const items = [];
    let hasError = false;
    for (const f of arr) {
      const err = validateFile(f);
      if (err) { hasError = true; continue; }
      // Avoid duplicates by name+size
      if (files.some(x => x.file.name === f.name && x.file.size === f.size)) continue;
      const item = { id: Date.now() + Math.random(), file: f, preview: null, status: "pending", parsed: null, error: null };
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles(prev => prev.map(x => x.id === item.id ? { ...x, preview: e.target.result } : x));
        };
        reader.readAsDataURL(f);
      }
      items.push(item);
    }
    if (hasError) setError("一部のファイルは非対応のため追加されませんでした。");
    if (items.length > 0) {
      setFiles(prev => [...prev, ...items]);
      setError(null);
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(x => x.id !== id));
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [files]);

  // ── Parse payslip text to extract fields ──
  const parsePayslipText = (text) => {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const allText = lines.join(" ");

    const findAmount = (keywords) => {
      for (const kw of keywords) {
        const patterns = [
          new RegExp(kw + "[\\s:：]*[¥￥]?\\s*([\\d,]+\\.?\\d*)", "i"),
          new RegExp(kw + "[^\\d]*([\\d,]{3,})", "i"),
        ];
        for (const pat of patterns) {
          const m = allText.match(pat);
          if (m) {
            const val = parseFloat(m[1].replace(/,/g, ""));
            if (val > 0) return val;
          }
        }
      }
      return 0;
    };

    const findHours = (keywords) => {
      for (const kw of keywords) {
        const patterns = [
          new RegExp(kw + "[\\s:：]*([\\d]+\\.?\\d*)\\s*[時hH]", "i"),
          new RegExp(kw + "[\\s:：]*([\\d]+\\.?\\d*)", "i"),
        ];
        for (const pat of patterns) {
          const m = allText.match(pat);
          if (m) {
            const val = parseFloat(m[1]);
            if (val > 0 && val < 744) return val;
          }
        }
      }
      return 0;
    };

    let yearMonth = "";
    const ymPatterns = [
      /(\d{4})[年\/\-](\d{1,2})[月]?/,
      /令和\s*(\d{1,2})[年](\d{1,2})[月]/,
      /[Rr]\s*(\d{1,2})[\.\/](\d{1,2})/,
    ];
    for (const pat of ymPatterns) {
      const m = allText.match(pat);
      if (m) {
        let year = parseInt(m[1]);
        const month = parseInt(m[2]);
        if (year < 100) year += 2018;
        if (year >= 2000 && year <= 2099 && month >= 1 && month <= 12) {
          yearMonth = `${year}-${String(month).padStart(2, "0")}`;
          break;
        }
      }
    }

    const grossPay = findAmount(["総支給", "支給額合計", "支給合計", "総額", "給与総額", "額面"]);
    const netPay = findAmount(["差引支給", "手取", "振込額", "差引", "銀行振込", "口座振込", "実支給"]);
    const deductions = findAmount(["控除合計", "控除額合計", "控除計"]);
    const totalHours = findHours(["総労働", "勤務時間", "所定.*時間", "出勤.*時間", "労働時間", "就業時間", "総時間"]);
    const overtimeHours = findHours(["残業", "時間外", "超過"]);
    const overtimePay = findAmount(["残業手当", "時間外手当", "超過勤務"]);

    // Extract scheduled days (所定日数) and attendance days (出勤日数)
    let scheduledDays = 0;
    let attendanceDays = 0;
    const sdPatterns = [/所定日数[\s:：]*(\d+)\s*日?/, /所定[\s:：]*(\d+)\s*日/];
    for (const pat of sdPatterns) {
      const m = allText.match(pat);
      if (m) { scheduledDays = parseInt(m[1]); break; }
    }
    const adPatterns = [/出勤日数[\s:：]*(\d+)\s*日?/, /出勤[\s:：]*(\d+)\s*日/];
    for (const pat of adPatterns) {
      const m = allText.match(pat);
      if (m) { attendanceDays = parseInt(m[1]); break; }
    }

    const deductionItems = [];
    const deductionKeywords = [
      { keywords: ["健康保険", "健保"], name: "健康保険" },
      { keywords: ["厚生年金", "年金"], name: "厚生年金" },
      { keywords: ["雇用保険"], name: "雇用保険" },
      { keywords: ["所得税", "源泉"], name: "所得税" },
      { keywords: ["住民税", "市民税", "県民税", "市県民税"], name: "住民税" },
      { keywords: ["介護保険"], name: "介護保険" },
    ];
    for (const dk of deductionKeywords) {
      const amt = findAmount(dk.keywords);
      if (amt > 0) deductionItems.push({ name: dk.name, amount: amt });
    }

    return {
      yearMonth, grossPay, netPay, totalHours, overtimeHours, overtimePay,
      scheduledDays, attendanceDays,
      deductions: deductions || deductionItems.reduce((s, d) => s + d.amount, 0),
      deductionItems,
      _rawText: allText,
    };
  };

  // ── Load PDF.js dynamically ──
  const pdfjsLoaded = useRef(false);
  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      if (pdfjsLoaded.current) {
        const poll = setInterval(() => {
          if (window.pdfjsLib) { clearInterval(poll); resolve(window.pdfjsLib); }
        }, 200);
        setTimeout(() => { clearInterval(poll); reject(new Error("PDF.js load timeout")); }, 20000);
        return;
      }
      pdfjsLoaded.current = true;
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "";
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("PDF.js の初期化に失敗しました"));
        }
      };
      script.onerror = () => reject(new Error("PDF.js の読み込みに失敗しました"));
      document.head.appendChild(script);
    });
  };

  // ── Extract text from PDF using PDF.js ──
  const extractPdfText = async (file) => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    const numPages = Math.min(pdf.numPages, 3); // First 3 pages max
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  // ── Resize image and get base64 for Claude API ──
  const imageToSmallBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          // Aggressively resize to keep payload small
          const maxDim = 800;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          resolve(dataUrl.split(",")[1]);
        };
        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });
  };

  // ── Extract year-month from filename ──
  const extractYearMonthFromFilename = (filename) => {
    if (!filename) return "";
    // Patterns: 2025-12, 2025_12, 202512, 2025年12月, R7-12, R07
    const patterns = [
      /(\d{4})[-_\/](\d{1,2})/,                    // 2025-12, 2025_12
      /(\d{4})年(\d{1,2})月/,                       // 2025年12月
      /(\d{4})(\d{2})(?![\d])/,                     // 202512 (not followed by more digits)
      /[Rr令和][\s]*(\d{1,2})[-_年\/.](\d{1,2})/,   // R7-12, 令和7年12月
    ];
    for (const pat of patterns) {
      const m = filename.match(pat);
      if (m) {
        let year = parseInt(m[1]);
        const month = parseInt(m[2]);
        if (year < 100) year += 2018; // Reiwa conversion
        if (year >= 2000 && year <= 2099 && month >= 1 && month <= 12) {
          return `${year}-${String(month).padStart(2, "0")}`;
        }
      }
    }
    return "";
  };

  // ── Process a single file ──
  const processOneFile = async (f) => {
    let parsed;
    if (f.type !== "application/pdf") {
      throw new Error("公開版はPDF形式のみ対応しています");
    }
    const pdfText = await extractPdfText(f);
    if (!pdfText || pdfText.trim().length < 20) {
      throw new Error("テキストが埋め込まれていないPDFです");
    }
    parsed = parsePayslipText(pdfText);

    // Fallback: if yearMonth not found in content, try filename
    if (!parsed.yearMonth) {
      parsed.yearMonth = extractYearMonthFromFilename(f.name);
    }

    // Auto-detect payType from filename and content
    parsed.payType = detectPayType(f.name, parsed._rawText || "");

    return parsed;
  };

  // ── Detect salary vs bonus from filename and text content ──
  const detectPayType = (filename, textContent) => {
    const combined = `${filename} ${textContent}`.toLowerCase();
    const bonusKeywords = [
      "賞与", "ボーナス", "bonus", "一時金", "期末手当", "勤勉手当",
      "特別手当", "年末手当", "夏季手当", "冬季手当", "決算賞与",
    ];
    for (const kw of bonusKeywords) {
      if (combined.includes(kw)) return "bonus";
    }
    return "salary";
  };

  // ── Batch processing ──
  const [ocrProgress, setOcrProgress] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0); // which file is being processed

  const runBatchOCR = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setOcrProgress(0);
    setBatchIndex(0);

    const updated = [...files];
    for (let i = 0; i < updated.length; i++) {
      setBatchIndex(i);
      setOcrProgress(Math.round(((i) / updated.length) * 100));
      updated[i] = { ...updated[i], status: "processing" };
      setFiles([...updated]);

      try {
        const parsed = await processOneFile(updated[i].file);
        updated[i] = { ...updated[i], status: "done", parsed, error: null };
      } catch (err) {
        updated[i] = { ...updated[i], status: "error", error: err.message, parsed: null };
      }
      setFiles([...updated]);
    }

    setOcrProgress(100);
    setLoading(false);

    // If only 1 file, go directly to confirm
    const doneFiles = updated.filter(f => f.status === "done");
    if (updated.length === 1 && doneFiles.length === 1) {
      const p = doneFiles[0].parsed;
      setForm(prev => ({
        ...prev,
        yearMonth: p.yearMonth || new Date().toISOString().slice(0, 7),
        grossPay: String(p.grossPay || ""),
        netPay: String(p.netPay || ""),
        totalHours: String(p.totalHours || ""),
        overtimeHours: String(p.overtimeHours || "0"),
        overtimePay: String(p.overtimePay || "0"),
        deductions: String(p.deductions || "0"),
      }));
      setCurrentData({ ...p, _deductionItems: p.deductionItems || [] });
      setScreen("confirm");
    } else if (doneFiles.length > 0) {
      setScreen("batchResult");
    } else {
      setError("すべてのファイルの読み取りに失敗しました。手入力をお試しください。");
    }
    setOcrProgress(0);
  };

  // ── Save a single batch result ──
  const [editingBatchId, setEditingBatchId] = useState(null);

  const saveBatchItem = (item) => {
    const p = item.savedRecord || item.parsed;
    setEditingBatchId(item.id);
    setForm(prev => ({
      ...prev,
      yearMonth: p.yearMonth || new Date().toISOString().slice(0, 7),
      payType: p.payType || prev.payType || "salary",
      grossPay: String(p.grossPay || ""),
      netPay: String(p.netPay || ""),
      totalHours: String(p.totalHours || ""),
      overtimeHours: String(p.overtimeHours || "0"),
      overtimePay: String(p.overtimePay || "0"),
      deductions: String(p.deductions || "0"),
    }));
    setCurrentData({ ...p, _deductionItems: p.deductionItems || [] });
    setScreen("confirm");
  };

  // ── Calculate work days for a given month & work style ──
  const calcWorkDays = (yearMonth, workStyle, customDaysOff, weeklyDays) => {
    const [y, m] = yearMonth.split("-").map(Number);
    if (!y || !m) return { workDays: 20, totalDays: 30, holidays: 10 };
    
    const totalDays = new Date(y, m, 0).getDate();
    let holidays = 0;
    
    if (workStyle === "short_time") {
      const wd = parseInt(weeklyDays) || 5;
      const totalWeeks = totalDays / 7;
      const workDays = Math.round(totalWeeks * wd);
      return { workDays, totalDays, holidays: totalDays - workDays };
    }

    for (let d = 1; d <= totalDays; d++) {
      const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
      if (workStyle === "weekdays") {
        if (dow === 0 || dow === 6) holidays++;
      } else if (workStyle === "sat_work") {
        if (dow === 0) holidays++;
      }
    }

    if (workStyle === "shift") {
      holidays = parseInt(customDaysOff) || 8;
    }

    const workDays = totalDays - holidays;
    return { workDays, totalDays, holidays };
  };

  // ── Build a record from parsed data + form settings ──
  const buildRecord = (parsed, formSettings) => {
    const g = parseFloat(parsed.grossPay) || 0;
    const n = parseFloat(parsed.netPay) || 0;
    const h = parseFloat(parsed.totalHours) || 0;
    const oh = parseFloat(parsed.overtimeHours) || 0;
    const op = parseFloat(parsed.overtimePay) || 0;
    const d = parseFloat(parsed.deductions) || 0;
    const dailyH = parseFloat(formSettings.dailyHours) || 8;

    if (g <= 0) return null;

    // Use days from PDF if available, otherwise estimate from work style
    const parsedScheduledDays = parseInt(parsed.scheduledDays) || 0;
    const parsedAttendanceDays = parseInt(parsed.attendanceDays) || 0;
    const dayMode = formSettings.dayCountMode || "scheduled";
    const parsedDays = dayMode === "attendance" ? (parsedAttendanceDays || parsedScheduledDays) : (parsedScheduledDays || parsedAttendanceDays);

    const { workDays: estimatedWorkDays, totalDays, holidays } = calcWorkDays(
      parsed.yearMonth || formSettings.yearMonth,
      formSettings.workStyle, formSettings.customDaysOff, formSettings.weeklyDays
    );
    const workDays = parsedDays > 0 ? parsedDays : estimatedWorkDays;
    const scheduledHours = Math.round(workDays * dailyH * 10) / 10;
    const actualHours = h > 0 ? h : scheduledHours;
    const netPay = n || g - d;

    return {
      id: Date.now() + Math.random(),
      yearMonth: parsed.yearMonth || formSettings.yearMonth,
      payType: parsed.payType || formSettings.payType || "salary",
      grossPay: g, netPay, totalHours: actualHours,
      overtimeHours: oh, overtimePay: op, deductions: d,
      workStyle: formSettings.workStyle,
      dailyHours: dailyH,
      weeklyDays: parseInt(formSettings.weeklyDays) || 5,
      workDays, holidays, scheduledHours,
      scheduledDays: parsedScheduledDays, attendanceDays: parsedAttendanceDays, dayCountMode: dayMode,
      grossHourly: g / actualHours,
      netHourly: netPay / actualHours,
      baseHourly: oh > 0 && actualHours > oh ? (g - op) / (actualHours - oh) : g / actualHours,
      takeHomeRate: n > 0 ? (n / g) * 100 : ((g - d) / g) * 100,
      grossDaily: g / workDays,
      netDaily: netPay / workDays,
      deductionItems: parsed.deductionItems || [],
    };
  };

  // ── Confirm & save (single) ──
  const confirmData = () => {
    const parsed = {
      yearMonth: form.yearMonth,
      payType: form.payType,
      grossPay: form.grossPay, netPay: form.netPay,
      totalHours: form.totalHours, overtimeHours: form.overtimeHours,
      overtimePay: form.overtimePay, deductions: form.deductions,
      deductionItems: currentData?._deductionItems || [],
    };
    const record = buildRecord(parsed, form);
    if (!record) {
      setError("総支給額は必須です。");
      return;
    }

    const existing = records.findIndex(r => r.yearMonth === record.yearMonth && r.payType === record.payType);
    let updated;
    if (existing >= 0) {
      updated = [...records];
      updated[existing] = record;
    } else {
      updated = [...records, record].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }
    setRecords(updated);
    setCurrentData(record);
    setError(null);

    // If we came from batch, mark item saved and return to batch list
    const isBatch = files.filter(f => f.status === "done" || f.status === "saved").length > 1;
    if (editingBatchId && isBatch) {
      setFiles(prev => prev.map(f => f.id === editingBatchId ? { ...f, status: "saved", savedRecord: record } : f));
      setEditingBatchId(null);
      setScreen("batchResult");
    } else {
      setEditingBatchId(null);
      setDashboardYM(record.yearMonth);
      setDashboardPayFilter("all");
      setScreen("dashboard");
    }
  };

  // ── Bulk save all unsaved items ──
  const bulkSaveAll = () => {
    const unsaved = files.filter(f => f.status === "done" && f.parsed);
    if (unsaved.length === 0) return;

    let allRecords = [...records];
    let savedCount = 0;
    let skippedCount = 0;
    const updatedFiles = [...files];

    for (const item of unsaved) {
      const p = item.parsed;
      const record = buildRecord(p, form);
      if (!record || !p.yearMonth) {
        skippedCount++;
        continue;
      }

      // Upsert into records
      const existing = allRecords.findIndex(r => r.yearMonth === record.yearMonth && r.payType === record.payType);
      if (existing >= 0) {
        allRecords[existing] = record;
      } else {
        allRecords.push(record);
      }

      // Mark file as saved
      const fileIdx = updatedFiles.findIndex(f => f.id === item.id);
      if (fileIdx >= 0) {
        updatedFiles[fileIdx] = { ...updatedFiles[fileIdx], status: "saved", savedRecord: record };
      }
      savedCount++;
    }

    allRecords.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    setRecords(allRecords);
    setFiles(updatedFiles);

    if (skippedCount > 0) {
      setError(`${savedCount}件を保存しました。${skippedCount}件は年月または総支給額が未設定のためスキップされました。`);
    } else {
      setError(null);
    }
  };

  // ── Navigate helpers ──
  const goHome = () => {
    setScreen("home");
    setFiles([]);
    setError(null);
    setCurrentData(null);
    setForm({
      yearMonth: new Date().toISOString().slice(0, 7),
      grossPay: "", netPay: "", totalHours: "",
      overtimeHours: "", overtimePay: "", deductions: "",
      workStyle: "weekdays", customDaysOff: "", dailyHours: "8", weeklyDays: "5", payType: "salary", dayCountMode: "scheduled",
    });
  };

  const viewRecord = (rec) => {
    setPrevScreen(screen);
    setDashboardYM(rec.yearMonth);
    setDashboardPayFilter(rec.payType === "bonus" ? "bonus" : "all");
    setCurrentData(rec);
    setScreen("dashboard");
  };

  // ── Chart click: navigate to dashboard for clicked month ──
  const [dashboardYM, setDashboardYM] = useState(null);
  const [dashboardPayFilter, setDashboardPayFilter] = useState("all"); // all | salary | bonus

  const handleChartClick = (data) => {
    if (!data?.activePayload?.[0]?.payload?.yearMonth) return;
    const ym = data.activePayload[0].payload.yearMonth;
    setPrevScreen("trend");
    setDashboardYM(ym);
    setDashboardPayFilter("all");
    setScreen("dashboard");
  };

  // ── Export / Import ──
  const exportData = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyuyo_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          setRecords(imported.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)));
          alert("データをインポートしました。");
        }
      } catch { alert("無効なファイルです。"); }
    };
    reader.readAsText(f);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const clearAll = () => {
    setShowDeleteConfirm(true);
  };

  const confirmClearAll = () => {
    setRecords([]);
    localStorage.removeItem(DB_KEY);
    setShowDeleteConfirm(false);
    goHome();
  };

  // ── Render ──
  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'Noto Sans JP', 'SF Pro Display', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: ${C.accent} !important; }
        button:hover { opacity: 0.88; }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .fade-up { animation: fadeUp .4s ease both; }
        .fade-up-1 { animation-delay: .05s; }
        .fade-up-2 { animation-delay: .1s; }
        .fade-up-3 { animation-delay: .15s; }
        .fade-up-4 { animation-delay: .2s; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(11,15,26,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={goHome}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent}, #A78BFA)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700,
          }}>¥</div>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>時給チェッカー</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {records.length > 0 && screen !== "trend" && (
            <button onClick={() => setScreen("trend")} style={btnSecondary}>📊 推移</button>
          )}
          <button onClick={() => setScreen("settings")} style={btnSecondary}>⚙️</button>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 100px" }}>

        {/* ══════════════════════════ HOME ══════════════════════════ */}
        {screen === "home" && (
          <div className="fade-up">
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{
                fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em",
                background: `linear-gradient(135deg, ${C.text}, ${C.accentLight})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 8,
              }}>
                あなたの1時間の価値は？
              </h1>
              <p style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
                給与明細PDFをアップロードするだけで<br />実質時給を自動計算します
              </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
              <button onClick={() => setInputMode("upload")} style={pill(inputMode === "upload")}>📄 アップロード</button>
              <button onClick={() => setInputMode("manual")} style={pill(inputMode === "manual")}>✏️ 手入力</button>
            </div>

            {inputMode === "upload" ? (
              <div className="fade-up">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? C.accent : C.border}`,
                    borderRadius: 16,
                    padding: 32,
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragOver ? C.accentDim : C.surface,
                    transition: "all .25s",
                    marginBottom: 12,
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                    給与明細PDFを選択（複数可）
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>
                    PDF に対応 — 10MBまで/ファイル
                  </div>
                </div>

                {/* Top read button (between drop zone and file list) */}
                {files.length > 0 && !loading && (
                  <button onClick={runBatchOCR} style={{
                    ...btnPrimary, width: "100%", marginBottom: 12,
                  }}>
                    {`${files.length}件を読み取り開始`}
                  </button>
                )}

                {/* File list */}
                {files.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {files.map((item) => (
                      <div key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 10,
                        background: item.status === "done" ? C.greenDim :
                                    item.status === "error" ? C.redDim :
                                    item.status === "processing" ? C.amberDim : C.surface,
                        border: `1px solid ${
                          item.status === "done" ? "rgba(74,222,128,0.3)" :
                          item.status === "error" ? "rgba(248,113,113,0.3)" :
                          item.status === "processing" ? "rgba(251,191,36,0.3)" : C.border
                        }`,
                        transition: "all .2s",
                      }}>
                        {item.preview ? (
                          <img src={item.preview} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                            {item.file.type === "application/pdf" ? "📄" : "🖼"}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.file.name}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>
                            {(item.file.size / 1024).toFixed(0)} KB
                            {item.status === "done" && item.parsed?.yearMonth && ` — ${item.parsed.yearMonth}`}
                            {item.status === "error" && ` — ${item.error}`}
                            {item.status === "processing" && " — 処理中..."}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {item.status === "done" && <span style={{ color: C.green, fontSize: 16 }}>✓</span>}
                          {item.status === "error" && <span style={{ color: C.red, fontSize: 16 }}>✗</span>}
                          {item.status === "processing" && <span style={{ animation: "pulse 1s infinite", fontSize: 14 }}>⏳</span>}
                          {!loading && (
                            <button onClick={(e) => { e.stopPropagation(); removeFile(item.id); }} style={{
                              background: "none", border: "none", color: C.textDim,
                              cursor: "pointer", fontSize: 16, padding: 4,
                            }}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => fileRef.current?.click()} style={{
                      ...btnSecondary, fontSize: 12, padding: "6px 12px", alignSelf: "flex-start",
                    }}>＋ ファイルを追加</button>
                  </div>
                )}

                {files.length > 0 && (
                  <button onClick={runBatchOCR} disabled={loading} style={{
                    ...btnPrimary,
                    width: "100%",
                    opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? (
                      <span style={{ animation: "pulse 1.5s infinite" }}>
                        🔍 読み取り中 ({batchIndex + 1}/{files.length})...
                      </span>
                    ) : `${files.length}件を読み取り開始`}
                  </button>
                )}
                {loading && ocrProgress > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: C.surface, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${ocrProgress}%`,
                        background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, textAlign: "center" }}>
                      {files.length}件中{batchIndex + 1}件目を処理中...
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Manual input ── */
              <div className="fade-up">
                <ManualForm form={form} setForm={setForm} />
                <button onClick={() => {
                  setCurrentData({ _deductionItems: [] });
                  setScreen("confirm");
                }} style={{ ...btnPrimary, width: "100%", marginTop: 16 }}>
                  計算する
                </button>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: C.redDim, border: `1px solid rgba(248,113,113,0.3)`,
                color: C.red, fontSize: 13,
              }}>{error}</div>
            )}

            {/* Recent records */}
            {records.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 14, color: C.textMuted, marginBottom: 12, fontWeight: 500 }}>📋 過去のデータ</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {records.slice().reverse().map((r) => (
                    <div key={r.id} onClick={() => viewRecord(r)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px", borderRadius: 12,
                      background: C.surface, border: `1px solid ${C.border}`,
                      cursor: "pointer", transition: "background .15s",
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {r.yearMonth}
                          {r.payType === "bonus" && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: C.amberDim, color: C.amber, fontSize: 10 }}>賞与</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {yen(r.grossPay)}
                          {r.workStyle && r.payType !== "bonus" && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: C.accentDim, color: C.accentLight, fontSize: 10 }}>
                            {r.workStyle === "weekdays" ? "土日祝休" : r.workStyle === "sat_work" ? "日曜休" : r.workStyle === "shift" ? "シフト" : r.workStyle === "short_time" ? `時短 週${r.weeklyDays || 5}日` : ""}
                          </span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{yen(r.grossHourly)}<span style={{ fontSize: 11, fontWeight: 400 }}>/h</span></div>
                        <div style={{ fontSize: 11, color: C.green }}>手取 {yen(r.netHourly)}/h</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy notice */}
            <div style={{
              marginTop: 32, padding: "12px 16px", borderRadius: 10,
              background: C.accentDim, fontSize: 12, color: C.textMuted,
              lineHeight: 1.6,
            }}>
              🔒 データはこの端末内にのみ保存されます。公開版はPDFのみをブラウザ内で処理し、サーバーへ送信しません。
            </div>
          </div>
        )}

        {/* ══════════════════════════ CONFIRM ══════════════════════════ */}
        {screen === "confirm" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>読み取り結果の確認</h2>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
              内容を確認し、必要に応じて修正してください
            </p>

            <ManualForm form={form} setForm={setForm} />

            {error && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: C.redDim, border: `1px solid rgba(248,113,113,0.3)`,
                color: C.red, fontSize: 13,
              }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => {
                const hasBatch = files.filter(f => f.status === "done" || f.status === "saved").length > 1;
                if (hasBatch) { setEditingBatchId(null); setScreen("batchResult"); }
                else goHome();
              }} style={{ ...btnSecondary, flex: 1 }}>戻る</button>
              <button onClick={confirmData} style={{ ...btnPrimary, flex: 2 }}>確定して保存</button>
            </div>
          </div>
        )}

        {/* ══════════════════════════ BATCH RESULT ══════════════════════════ */}
        {screen === "batchResult" && (() => {
          const savedCount = files.filter(f => f.status === "saved").length;
          const doneCount = files.filter(f => f.status === "done").length;
          const errorCount = files.filter(f => f.status === "error").length;
          const totalActionable = savedCount + doneCount;
          const allSaved = doneCount === 0 && savedCount > 0;
          return (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>読み取り結果</h2>
              <button onClick={goHome} style={btnSecondary}>← 戻る</button>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                <span>保存済み {savedCount} / {totalActionable} 件</span>
                {errorCount > 0 && <span style={{ color: C.red }}>{errorCount}件失敗</span>}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.surface, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: totalActionable > 0 ? `${(savedCount / totalActionable) * 100}%` : "0%",
                  background: allSaved ? C.green : `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>

            {/* ── Bulk work style settings ── */}
            <div style={{
              background: C.card, borderRadius: 14, padding: 16,
              border: `1px solid ${C.border}`, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
                ⚙️ 一括設定（全ファイルに適用）
              </div>

              {/* Pay type */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>種別</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "salary", label: "💼 給与" },
                    { value: "bonus", label: "🎉 賞与" },
                  ].map(pt => (
                    <button key={pt.value} onClick={() => {
                      setForm(prev => ({ ...prev, payType: pt.value }));
                      // Apply to all unsaved files
                      setFiles(prev => prev.map(f => {
                        if (f.status !== "done" || !f.parsed) return f;
                        return { ...f, parsed: { ...f.parsed, payType: pt.value } };
                      }));
                    }} style={{
                      flex: 1, padding: "8px 12px", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 500,
                      border: `1.5px solid ${form.payType === pt.value ? (pt.value === "bonus" ? C.amber : C.accent) : C.border}`,
                      background: form.payType === pt.value ? (pt.value === "bonus" ? C.amberDim : C.accentDim) : "transparent",
                      color: form.payType === pt.value ? (pt.value === "bonus" ? C.amber : C.accentLight) : C.textMuted,
                      cursor: "pointer", transition: "all .2s",
                    }}>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work style */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>勤務形態</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { value: "weekdays", label: "🏢 土日祝休" },
                    { value: "sat_work", label: "🏭 日曜休" },
                    { value: "shift", label: "🔄 シフト" },
                    { value: "short_time", label: "⏰ 時短" },
                  ].map(ws => (
                    <button key={ws.value} onClick={() => setForm(prev => ({ ...prev, workStyle: ws.value }))} style={{
                      padding: "7px 4px", borderRadius: 8, fontSize: 11, fontWeight: 500, textAlign: "center",
                      border: `1.5px solid ${form.workStyle === ws.value ? C.accent : C.border}`,
                      background: form.workStyle === ws.value ? C.accentDim : "transparent",
                      color: form.workStyle === ws.value ? C.accentLight : C.textMuted,
                      cursor: "pointer", transition: "all .2s",
                    }}>
                      {ws.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Short-time: weekly days */}
              {form.workStyle === "short_time" && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>週の出勤日数</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["2", "3", "4", "5", "6"].map(d => (
                      <button key={d} onClick={() => setForm(prev => ({ ...prev, weeklyDays: d }))} style={{
                        ...pill(form.weeklyDays === d),
                        flex: 1, textAlign: "center", padding: "6px 4px", fontSize: 12,
                      }}>
                        {d}日
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shift: days off */}
              {form.workStyle === "shift" && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>月の休日数</div>
                  <input type="number" inputMode="numeric" value={form.customDaysOff}
                    onChange={(e) => setForm(prev => ({ ...prev, customDaysOff: e.target.value }))}
                    placeholder="8" style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }} />
                </div>
              )}

              {/* Daily hours */}
              <div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>1日の所定労働時間</div>
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                  {(form.workStyle === "short_time" || form.workStyle === "shift"
                    ? ["4", "5", "6", "7", "7.5", "8", "9", "10"]
                    : ["7", "7.5", "8", "9", "10"]
                  ).map(h => (
                    <button key={h} onClick={() => setForm(prev => ({ ...prev, dailyHours: h }))} style={{
                      ...pill(form.dailyHours === h),
                      padding: "6px 8px", fontSize: 12, minWidth: 38, textAlign: "center",
                    }}>
                      {h}h
                    </button>
                  ))}
                  <select
                    value={["3","4","5","6","7","7.5","8","9","10","11","12"].includes(form.dailyHours) ? "" : form.dailyHours || ""}
                    onChange={(e) => { if (e.target.value) setForm(prev => ({ ...prev, dailyHours: e.target.value })); }}
                    style={{
                      padding: "6px 4px", borderRadius: 8, fontSize: 11,
                      border: `1px solid ${!["3","4","5","6","7","7.5","8","9","10"].includes(form.dailyHours) && form.dailyHours ? C.accent : C.border}`,
                      background: !["3","4","5","6","7","7.5","8","9","10"].includes(form.dailyHours) && form.dailyHours ? C.accentDim : "transparent",
                      color: !["3","4","5","6","7","7.5","8","9","10"].includes(form.dailyHours) && form.dailyHours ? C.accentLight : C.textMuted,
                      cursor: "pointer", outline: "none", minWidth: 44, textAlign: "center",
                    }}
                  >
                    <option value="">他</option>
                    {["1","1.5","2","2.5","3","3.5","4.5","5.5","6.5","11","12","13","14","15","16"].map(h => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Day count mode */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>日数の基準（明細に記載がある場合）</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "scheduled", label: "📅 所定日数" },
                    { value: "attendance", label: "✅ 出勤日数" },
                  ].map(m => (
                    <button key={m.value} onClick={() => setForm(prev => ({ ...prev, dayCountMode: m.value }))} style={{
                      flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 500, textAlign: "center",
                      border: `1.5px solid ${form.dayCountMode === m.value ? C.accent : C.border}`,
                      background: form.dayCountMode === m.value ? C.accentDim : "transparent",
                      color: form.dayCountMode === m.value ? C.accentLight : C.textMuted,
                      cursor: "pointer", transition: "all .2s",
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {(doneCount > 0 || savedCount > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {doneCount > 0 && (
                  <button onClick={bulkSaveAll} style={{
                    ...btnPrimary, width: "100%",
                  }}>
                    📥 未保存の{doneCount}件を一括保存する
                  </button>
                )}
                {savedCount > 0 && (
                  <button onClick={() => {
                    const lastSaved = files.filter(f => f.status === "saved").pop();
                    if (savedCount >= 2) {
                      setScreen("trend");
                    } else if (lastSaved?.savedRecord) {
                      setCurrentData(lastSaved.savedRecord);
                      setScreen("dashboard");
                    }
                  }} style={{
                    ...btnPrimary, width: "100%",
                    background: allSaved ? `linear-gradient(135deg, ${C.green}, #22C55E)` : `linear-gradient(135deg, ${C.accent}, #8B6CFF)`,
                    boxShadow: allSaved ? "0 4px 20px rgba(74,222,128,0.25)" : `0 4px 20px ${C.accentGlow}`,
                  }}>
                    {savedCount >= 2 ? `📊 ${savedCount}件の推移を見る` : "📊 ダッシュボードを見る"}
                  </button>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...files].sort((a, b) => {
                const ymA = (a.savedRecord?.yearMonth || a.parsed?.yearMonth || "");
                const ymB = (b.savedRecord?.yearMonth || b.parsed?.yearMonth || "");
                return ymB.localeCompare(ymA);
              }).map((item) => {
                const isSaved = item.status === "saved";
                const isDone = item.status === "done";
                const isError = item.status === "error";
                return (
                <div key={item.id} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: isSaved ? C.greenDim : isDone ? C.card : C.surface,
                  border: `1px solid ${isSaved ? "rgba(74,222,128,0.3)" : isDone ? C.border : "rgba(248,113,113,0.3)"}`,
                  transition: "all .25s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: (isDone || isSaved) ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      {item.preview ? (
                        <img src={item.preview} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", opacity: isSaved ? 0.7 : 1 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📄</div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file.name}</div>
                        {isError && <div style={{ fontSize: 11, color: C.red }}>{item.error}</div>}
                        {isSaved && <div style={{ fontSize: 11, color: C.green }}>✓ 保存済み — {item.savedRecord?.yearMonth || item.parsed?.yearMonth}</div>}
                      </div>
                    </div>
                    <div>
                      {isSaved && <span style={{ fontSize: 18, color: C.green }}>✓</span>}
                      {isDone && <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: C.amberDim, color: C.amber }}>未保存</span>}
                      {isError && <span style={{ color: C.red, fontSize: 14 }}>✗</span>}
                    </div>
                  </div>

                  {(isDone || isSaved) && (item.parsed || item.savedRecord) && (() => {
                    const d = isSaved && item.savedRecord ? item.savedRecord : item.parsed;
                    const curYM = d.yearMonth || "";
                    const [curY, curM] = curYM.split("-");
                    const thisYear = new Date().getFullYear();
                    const itemPayType = d.payType || form.payType || "salary";

                    const updateBatchField = (field, value) => {
                      setFiles(prev => prev.map(f => {
                        if (f.id !== item.id) return f;
                        if (f.savedRecord) return { ...f, savedRecord: { ...f.savedRecord, [field]: value } };
                        if (f.parsed) return { ...f, parsed: { ...f.parsed, [field]: value } };
                        return f;
                      }));
                    };

                    const miniSelect = {
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.text,
                      fontSize: 12,
                      outline: "none",
                      cursor: "pointer",
                      width: "100%",
                      appearance: "none",
                      WebkitAppearance: "none",
                      textAlign: "center",
                    };

                    return (
                    <div>
                      {/* Per-file pay type + year-month + amounts */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                        {/* Pay type toggle */}
                        <div style={{ padding: "6px 4px", background: isSaved ? "rgba(74,222,128,0.06)" : C.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4 }}>種別</div>
                          <div style={{ display: "flex", gap: 2 }}>
                            {[
                              { value: "salary", label: "給与", color: C.accent },
                              { value: "bonus", label: "賞与", color: C.amber },
                            ].map(pt => (
                              <button key={pt.value} onClick={() => updateBatchField("payType", pt.value)} style={{
                                flex: 1, padding: "3px 2px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                                border: `1px solid ${itemPayType === pt.value ? pt.color : C.border}`,
                                background: itemPayType === pt.value ? (pt.value === "bonus" ? C.amberDim : C.accentDim) : "transparent",
                                color: itemPayType === pt.value ? pt.color : C.textDim,
                                cursor: "pointer", transition: "all .15s",
                              }}>
                                {pt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Year-month */}
                        <div style={{ padding: "6px 4px", background: isSaved ? "rgba(74,222,128,0.06)" : C.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4 }}>年月</div>
                          <div style={{ display: "flex", gap: 2 }}>
                            <select value={curY || String(thisYear)} onChange={(e) => updateBatchField("yearMonth", `${e.target.value}-${(curM || "01").padStart(2, "0")}`)} style={miniSelect}>
                              {Array.from({ length: 11 }, (_, i) => thisYear - i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select value={curM ? String(parseInt(curM)) : "1"} onChange={(e) => updateBatchField("yearMonth", `${curY || thisYear}-${e.target.value.padStart(2, "0")}`)} style={miniSelect}>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={String(m)}>{m}月</option>)}
                            </select>
                          </div>
                        </div>
                        {/* Gross pay */}
                        <div style={{ padding: "6px 4px", background: isSaved ? "rgba(74,222,128,0.06)" : C.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4 }}>総支給額</div>
                          <input type="number" inputMode="numeric" value={d.grossPay || ""}
                            onChange={(e) => updateBatchField("grossPay", parseFloat(e.target.value) || 0)}
                            style={{ ...miniSelect, fontSize: 12, fontWeight: 600, color: C.accent, border: `1px solid ${C.border}`, background: "transparent" }}
                            placeholder="0"
                          />
                        </div>
                        {/* Net pay */}
                        <div style={{ padding: "6px 4px", background: isSaved ? "rgba(74,222,128,0.06)" : C.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4 }}>手取り</div>
                          <input type="number" inputMode="numeric" value={d.netPay || ""}
                            onChange={(e) => updateBatchField("netPay", parseFloat(e.target.value) || 0)}
                            style={{ ...miniSelect, fontSize: 12, fontWeight: 600, color: C.green, border: `1px solid ${C.border}`, background: "transparent" }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <button onClick={() => saveBatchItem(item)} style={{
                        ...btnSecondary, width: "100%", fontSize: 13,
                        borderColor: isSaved ? C.green : C.accent,
                        color: isSaved ? C.green : C.accentLight,
                      }}>
                        {isSaved ? "再編集する" : "確認・保存する →"}
                      </button>
                    </div>
                    );
                  })()}
                </div>
                );
              })}
            </div>

            {/* Bottom actions */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {savedCount > 0 && (
                <button onClick={() => {
                  const lastSaved = files.filter(f => f.status === "saved").pop();
                  if (savedCount >= 2) {
                    setScreen("trend");
                  } else if (lastSaved?.savedRecord) {
                    setCurrentData(lastSaved.savedRecord);
                    setScreen("dashboard");
                  }
                }} style={{
                  ...btnPrimary, width: "100%",
                  background: allSaved ? `linear-gradient(135deg, ${C.green}, #22C55E)` : `linear-gradient(135deg, ${C.accent}, #8B6CFF)`,
                  boxShadow: allSaved ? "0 4px 20px rgba(74,222,128,0.25)" : `0 4px 20px ${C.accentGlow}`,
                }}>
                  {allSaved
                    ? (savedCount >= 2 ? `📊 ${savedCount}件の推移を見る` : "📊 ダッシュボードを見る")
                    : (savedCount >= 2 ? `📊 保存済み${savedCount}件の推移を見る` : "📊 ダッシュボードを見る")
                  }
                </button>
              )}
              {doneCount > 0 && (
                <div style={{ fontSize: 12, color: C.amber, textAlign: "center" }}>
                  ⚠ 未保存のデータが{doneCount}件あります
                </div>
              )}
              {doneCount > 0 && (
                <button onClick={bulkSaveAll} style={{
                  ...btnPrimary, width: "100%",
                }}>
                  📥 未保存の{doneCount}件を一括保存する
                </button>
              )}
              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: C.amberDim, border: `1px solid rgba(251,191,36,0.3)`,
                  color: C.amber, fontSize: 12,
                }}>{error}</div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ══════════════════════════ DASHBOARD ══════════════════════════ */}
        {screen === "dashboard" && dashboardYM && (() => {
          const ymRecords = records.filter(r => r.yearMonth === dashboardYM);
          const ymSalary = ymRecords.filter(r => r.payType !== "bonus");
          const ymBonus = ymRecords.filter(r => r.payType === "bonus");
          const hasSalary = ymSalary.length > 0;
          const hasBonus = ymBonus.length > 0;
          const hasBoth = hasSalary && hasBonus;

          // Select data based on filter
          const filtered = dashboardPayFilter === "salary" ? ymSalary
            : dashboardPayFilter === "bonus" ? ymBonus
            : ymRecords;

          // Merge filtered records
          // For hours/workDays: use salary record to avoid double-counting
          const salaryRec = ymSalary[0] || {};
          const d = filtered.reduce((acc, r) => ({
            grossPay: acc.grossPay + r.grossPay,
            netPay: acc.netPay + r.netPay,
            overtimePay: acc.overtimePay + (r.overtimePay || 0),
            deductions: acc.deductions + (r.deductions || 0),
            deductionItems: [...acc.deductionItems, ...(r.deductionItems || [])],
            // These are set once from salary, not accumulated
            totalHours: acc.totalHours,
            overtimeHours: acc.overtimeHours,
            workStyle: acc.workStyle,
            dailyHours: acc.dailyHours,
            weeklyDays: acc.weeklyDays,
            workDays: acc.workDays,
            holidays: acc.holidays,
            scheduledHours: acc.scheduledHours,
          }), {
            grossPay: 0, netPay: 0, overtimePay: 0, deductions: 0, deductionItems: [],
            totalHours: salaryRec.totalHours || 0,
            overtimeHours: salaryRec.overtimeHours || 0,
            workStyle: salaryRec.workStyle || "",
            dailyHours: salaryRec.dailyHours || 8,
            weeklyDays: salaryRec.weeklyDays || 5,
            workDays: salaryRec.workDays || 0,
            holidays: salaryRec.holidays || 0,
            scheduledHours: salaryRec.scheduledHours || 0,
          });

          const grossHourly = d.totalHours > 0 ? d.grossPay / d.totalHours : 0;
          const netHourly = d.totalHours > 0 ? d.netPay / d.totalHours : 0;
          const baseHourly = d.overtimeHours > 0 && d.totalHours > d.overtimeHours ? (d.grossPay - d.overtimePay) / (d.totalHours - d.overtimeHours) : grossHourly;
          const takeHomeRate = d.grossPay > 0 ? (d.netPay / d.grossPay) * 100 : 0;
          const grossDaily = d.workDays > 0 ? d.grossPay / d.workDays : 0;
          const netDaily = d.workDays > 0 ? d.netPay / d.workDays : 0;
          const isBonusOnly = dashboardPayFilter === "bonus";
          const filterLabel = dashboardPayFilter === "all" ? "合算" : dashboardPayFilter === "salary" ? "給与" : "賞与";

          // Merge deduction items by name
          const deductionMap = {};
          d.deductionItems.forEach(item => { deductionMap[item.name] = (deductionMap[item.name] || 0) + item.amount; });
          const mergedDeductions = Object.entries(deductionMap).map(([name, amount]) => ({ name, amount }));

          if (filtered.length === 0) return (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
              <p>この月のデータがありません</p>
              <button onClick={goHome} style={{ ...btnSecondary, marginTop: 16 }}>← 戻る</button>
            </div>
          );

          return (
          <div>
            {/* Floating sticky header */}
            <div style={{
              position: "sticky", top: 64, zIndex: 10,
              marginLeft: -20, marginRight: -20,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 20px",
                background: "rgba(11,15,26,0.92)", backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{dashboardYM}</span>
                  {isBonusOnly && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: C.amberDim, color: C.amber }}>賞与</span>}
                  <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 6 }}>{filterLabel}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {prevScreen && (
                    <button onClick={() => { setScreen(prevScreen); setPrevScreen(null); }} style={{
                      ...btnSecondary, fontSize: 11, padding: "4px 10px",
                    }}>
                      ← {prevScreen === "trend" ? "推移" : "戻る"}
                    </button>
                  )}
                  <button onClick={goHome} style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}>＋ 新規</button>
                </div>
              </div>
              {hasBoth && (
              <div style={{
                padding: "6px 20px 8px",
                background: "rgba(11,15,26,0.92)", backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { value: "all", label: "合算" },
                    { value: "salary", label: "💼 給与" },
                    { value: "bonus", label: "🎉 賞与" },
                  ].map(f => (
                    <button key={f.value} onClick={() => setDashboardPayFilter(f.value)} style={{
                      ...pill(dashboardPayFilter === f.value),
                      flex: 1, textAlign: "center", fontSize: 12, padding: "5px 4px",
                    }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>{/* end sticky header */}

            {/* Main stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="fade-up">
              <StatCard icon="💰" label={isBonusOnly ? "賞与額面" : "額面時給"} value={isBonusOnly ? yen(d.grossPay) : yen(grossHourly)} sub={isBonusOnly ? "" : `${yen(d.grossPay)} ÷ ${hrs(d.totalHours)}`} color={C.accent} />
              <StatCard icon="👛" label={isBonusOnly ? "賞与手取" : "手取り時給"} value={isBonusOnly ? yen(d.netPay) : yen(netHourly)} sub={isBonusOnly ? "" : `${yen(d.netPay)} ÷ ${hrs(d.totalHours)}`} color={C.green} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="fade-up fade-up-1">
              <StatCard icon="📊" label="手取り比率" value={pct(takeHomeRate)} sub={`控除 ${yen(d.deductions)}`} color={takeHomeRate >= 80 ? C.green : takeHomeRate >= 70 ? C.amber : C.red} />
              {!isBonusOnly && <StatCard icon="⏱️" label="残業除外時給" value={yen(baseHourly)} sub={d.overtimeHours > 0 ? `残業 ${hrs(d.overtimeHours)}` : "残業なし"} color={C.purple} />}
              {isBonusOnly && <StatCard icon="💰" label="額面" value={yen(d.grossPay)} color={C.accent} />}
            </div>

            {/* Work schedule & daily rate (salary only) */}
            {!isBonusOnly && d.workDays > 0 && (
              <div className="fade-up fade-up-2" style={{
                background: C.card, borderRadius: 16, padding: 16,
                border: `1px solid ${C.border}`, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                  📅 勤務条件：{
                    d.workStyle === "weekdays" ? "土日祝休み" :
                    d.workStyle === "sat_work" ? "日曜のみ休み" :
                    d.workStyle === "shift" ? "シフト勤務" :
                    d.workStyle === "short_time" ? `時短（週${d.weeklyDays || 5}日）` : "—"
                  }（1日{d.dailyHours}h）
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ textAlign: "center", padding: "8px 0", background: C.surface, borderRadius: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{d.workDays}<span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>日</span></div>
                    <div style={{ fontSize: 11, color: C.textDim }}>出勤日数</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "8px 0", background: C.surface, borderRadius: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{yen(grossDaily)}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>額面日給</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "8px 0", background: C.surface, borderRadius: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{yen(netDaily)}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>手取り日給</div>
                  </div>
                </div>
              </div>
            )}

            {/* Take-home bar */}
            <div className="fade-up fade-up-2" style={{
              background: C.card, borderRadius: 16, padding: 20,
              border: `1px solid ${C.border}`, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>額面 → 手取り</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 24, borderRadius: 12,
                    background: C.surface, overflow: "hidden",
                    position: "relative",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 12,
                      width: `${takeHomeRate}%`,
                      background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                      transition: "width 1s ease",
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.green, whiteSpace: "nowrap" }}>
                  {pct(takeHomeRate)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: C.textMuted }}>
                <span>額面 {yen(d.grossPay)}</span>
                <span>手取り {yen(d.netPay)}</span>
              </div>
            </div>

            {/* Deduction breakdown */}
            {mergedDeductions.length > 0 && (
              <div className="fade-up fade-up-3" style={{
                background: C.card, borderRadius: 16, padding: 20,
                border: `1px solid ${C.border}`, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>控除内訳</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <PieChart width={200} height={200}>
                    <Pie data={mergedDeductions} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {mergedDeductions.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => yen(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} itemStyle={{ color: C.text }} />
                  </PieChart>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {mergedDeductions.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span style={{ color: C.textMuted }}>{item.name}</span>
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 500 }}>{yen(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="fade-up fade-up-4" style={{ display: "flex", gap: 10 }}>
              {records.length >= 2 && (
                <button onClick={() => setScreen("trend")} style={{ ...btnSecondary, flex: 1 }}>📊 月次推移を見る</button>
              )}
              <button onClick={goHome} style={{ ...btnSecondary, flex: 1 }}>📄 別の明細を読む</button>
            </div>
          </div>
          );
        })()}

        {/* ══════════════════════════ TREND ══════════════════════════ */}
        {screen === "trend" && (() => {
          const salaryRecords = records.filter(r => r.payType !== "bonus");
          const bonusRecords = records.filter(r => r.payType === "bonus");
          const hasSalary = salaryRecords.length > 0;
          const hasBonus = bonusRecords.length > 0;

          // Merge salary + bonus per yearMonth for "all" view
          // For totalHours/workDays: use salary record only to avoid double-counting
          const mergedMap = {};
          for (const r of records) {
            const ym = r.yearMonth;
            if (!mergedMap[ym]) mergedMap[ym] = { yearMonth: ym, grossPay: 0, netPay: 0, totalHours: 0, _hoursSet: false };
            mergedMap[ym].grossPay += r.grossPay;
            mergedMap[ym].netPay += r.netPay;
            // Only take hours from salary (non-bonus) records
            if (r.payType !== "bonus" && !mergedMap[ym]._hoursSet) {
              mergedMap[ym].totalHours = r.totalHours || 0;
              mergedMap[ym]._hoursSet = true;
            }
          }
          const mergedRecords = Object.values(mergedMap).map(m => ({
            ...m,
            grossHourly: m.totalHours > 0 ? m.grossPay / m.totalHours : 0,
            netHourly: m.totalHours > 0 ? m.netPay / m.totalHours : 0,
            takeHomeRate: m.grossPay > 0 ? (m.netPay / m.grossPay) * 100 : 0,
          })).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

          return (
          <div className="fade-up">
            {/* Floating sticky filter bar */}
            <div style={{
              position: "sticky", top: 64, zIndex: 10,
              marginLeft: -20, marginRight: -20,
              transition: "all .3s ease",
            }}>
              {/* Toggle button - always visible */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 20px",
                background: "rgba(11,15,26,0.92)", backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>月次推移</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={goHome} style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}>← 戻る</button>
                  <button onClick={() => setShowStickyFilter(prev => !prev)} style={{
                    background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.textMuted, cursor: "pointer", fontSize: 11, padding: "4px 8px",
                  }}>
                    {showStickyFilter ? "▲ 閉じる" : "▼ フィルタ"}
                  </button>
                </div>
              </div>
              {showStickyFilter && (
              <div style={{
                padding: "8px 20px 10px",
                background: "rgba(11,15,26,0.92)", backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {[
                    { value: "all", label: "合算", show: true },
                    { value: "salary", label: "💼 給与", show: hasSalary },
                    { value: "bonus", label: "🎉 賞与", show: hasBonus },
                  ].filter(f => f.show).map(f => (
                    <button key={f.value} onClick={() => setTrendFilter(f.value)} style={{
                      ...pill(trendFilter === f.value),
                      flex: 1, textAlign: "center", fontSize: 12, padding: "5px 4px",
                    }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const allYears = [...new Set(records.map(r => r.yearMonth?.slice(0, 4)).filter(Boolean))].sort().reverse();
                  if (allYears.length <= 1) return null;
              return (
                <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                  <button onClick={() => { setTrendYear(null); setTrendYearCompare(false); }} style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${!trendYear && !trendYearCompare ? C.accent : C.border}`,
                    background: !trendYear && !trendYearCompare ? C.accentDim : "transparent",
                    color: !trendYear && !trendYearCompare ? C.accentLight : C.textMuted,
                    cursor: "pointer", transition: "all .2s",
                  }}>
                    通年
                  </button>
                  {allYears.map(y => (
                    <button key={y} onClick={() => { setTrendYear(y); setTrendYearCompare(false); }} style={{
                      padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${trendYear === y && !trendYearCompare ? C.accent : C.border}`,
                      background: trendYear === y && !trendYearCompare ? C.accentDim : "transparent",
                      color: trendYear === y && !trendYearCompare ? C.accentLight : C.textMuted,
                      cursor: "pointer", transition: "all .2s",
                    }}>
                      {y}
                    </button>
                  ))}
                  <button onClick={() => { setTrendYear(null); setTrendYearCompare(true); }} style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${trendYearCompare ? C.amber : C.border}`,
                    background: trendYearCompare ? C.amberDim : "transparent",
                    color: trendYearCompare ? C.amber : C.textMuted,
                    cursor: "pointer", transition: "all .2s",
                  }}>
                    📊 年別比較
                  </button>
                </div>
              );
            })()}
              </div>
              )}
            </div>{/* end sticky filter bar */}

            {/* ── Yearly comparison view ── */}
            {trendYearCompare && (() => {
              const allYears = [...new Set(records.map(r => r.yearMonth?.slice(0, 4)).filter(Boolean))].sort();
              const isBonusOnly = trendFilter === "bonus";

              const yearlyData = allYears.map(year => {
                const yAll = records.filter(r => r.yearMonth?.startsWith(year));
                const ySalary = yAll.filter(r => r.payType !== "bonus");
                const yBonus = yAll.filter(r => r.payType === "bonus");
                const source = trendFilter === "salary" ? ySalary : trendFilter === "bonus" ? yBonus : yAll;

                const grossPay = source.reduce((s, r) => s + r.grossPay, 0);
                const netPay = source.reduce((s, r) => s + r.netPay, 0);
                const months = new Set(source.map(r => r.yearMonth)).size;

                // Work data from salary only
                const workData = {};
                for (const r of ySalary) {
                  if (!workData[r.yearMonth]) workData[r.yearMonth] = { hours: r.totalHours || 0, days: r.workDays || 0 };
                }
                const wv = Object.values(workData);
                const totalHours = wv.reduce((s, d) => s + d.hours, 0);
                const totalDays = wv.reduce((s, d) => s + d.days, 0);

                return {
                  year,
                  grossPay, netPay, months, totalHours, totalDays,
                  avgGross: months > 0 ? grossPay / months : 0,
                  avgNet: months > 0 ? netPay / months : 0,
                  grossHourly: totalHours > 0 ? grossPay / totalHours : 0,
                  netHourly: totalHours > 0 ? netPay / totalHours : 0,
                  takeHomeRate: grossPay > 0 ? (netPay / grossPay) * 100 : 0,
                  bonusTotal: yBonus.reduce((s, r) => s + r.grossPay, 0),
                  bonusCount: yBonus.length,
                };
              });

              return (
              <>
                {/* Yearly gross/net bar chart */}
                {/* Hourly average comparison (moved to top) */}
                {!isBonusOnly && (
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>平均時給の比較</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textMuted, fontSize: 12 }} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `¥${Math.round(v)}`} width={55} />
                      <Tooltip
                        formatter={(v, name) => [yen(v), name === "grossHourly" ? "額面時給" : "手取り時給"]}
                        contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="grossHourly" stroke={C.accent} strokeWidth={2.5} dot={{ r: 5, fill: C.accent }} name="grossHourly" />
                      <Line type="monotone" dataKey="netHourly" stroke={C.green} strokeWidth={2.5} dot={{ r: 5, fill: C.green }} name="netHourly" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: C.accent }}>● 額面時給</span>
                    <span style={{ fontSize: 12, color: C.green }}>● 手取り時給</span>
                  </div>
                </div>
                )}

                {/* Yearly gross/net bar chart */}
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                    {isBonusOnly ? "年間賞与の比較" : "年間収入の比較"}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={yearlyData} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textMuted, fontSize: 12 }} xAxisId="gross" />
                      <XAxis dataKey="year" xAxisId="net" hide />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} width={50} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length < 1) return null;
                          const gross = payload.find(p => p.dataKey === "grossPay")?.value || 0;
                          const net = payload.find(p => p.dataKey === "netPay")?.value || 0;
                          const deduction = gross - net;
                          return (
                            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                              <div style={{ marginBottom: 4, color: C.text, fontWeight: 500 }}>{label}年</div>
                              <div style={{ color: isBonusOnly ? C.amber : C.accent }}>額面合計：{yen(gross)}</div>
                              <div style={{ color: C.green }}>手取り合計：{yen(net)}</div>
                              <div style={{ color: C.red, marginTop: 2, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>控除額：{yen(deduction)}（{gross > 0 ? pct((deduction / gross) * 100) : "0%"}）</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="grossPay" fill={isBonusOnly ? C.amber : C.accent} radius={[4, 4, 0, 0]} name="grossPay" xAxisId="gross" />
                      <Bar dataKey="netPay" fill={C.green} radius={[2, 2, 0, 0]} name="netPay" xAxisId="net" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: isBonusOnly ? C.amber : C.accent }}>● 額面合計</span>
                    <span style={{ fontSize: 12, color: C.green }}>● 手取り合計</span>
                  </div>
                </div>

                {/* Take-home rate comparison */}
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>手取り比率の比較</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{ fill: C.textMuted, fontSize: 12 }} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[40, 100]} width={40} />
                      <Tooltip
                        formatter={(v) => [pct(v), "手取り比率"]}
                        contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="takeHomeRate" stroke={C.amber} strokeWidth={2.5} dot={{ r: 5, fill: C.amber }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Yearly detail table */}
                <div style={{
                  background: C.card, borderRadius: 16, padding: 16,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>年別詳細</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {yearlyData.slice().reverse().map(yd => (
                      <div key={yd.year} style={{
                        padding: 12, borderRadius: 10, background: C.surface,
                        border: `1px solid ${C.border}`,
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{yd.year}年<span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{yd.months}ヶ月分</span></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                          <div style={{ textAlign: "center", padding: "6px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{yen(yd.grossPay)}</div>
                            <div style={{ fontSize: 10, color: C.textDim }}>額面合計</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "6px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{yen(yd.netPay)}</div>
                            <div style={{ fontSize: 10, color: C.textDim }}>手取り合計</div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: !isBonusOnly ? "1fr 1fr 1fr 1fr" : "1fr 1fr", gap: 4 }}>
                          <div style={{ textAlign: "center", padding: "4px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>{yen(yd.avgGross)}</div>
                            <div style={{ fontSize: 9, color: C.textDim }}>月平均額面</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "4px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{yen(yd.avgNet)}</div>
                            <div style={{ fontSize: 9, color: C.textDim }}>月平均手取</div>
                          </div>
                          {!isBonusOnly && (
                          <div style={{ textAlign: "center", padding: "4px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>{yen(yd.grossHourly)}<span style={{ fontSize: 8, color: C.textDim }}>/h</span></div>
                            <div style={{ fontSize: 9, color: C.textDim }}>額面時給</div>
                          </div>
                          )}
                          {!isBonusOnly && (
                          <div style={{ textAlign: "center", padding: "4px 0", background: C.card, borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{yen(yd.netHourly)}<span style={{ fontSize: 8, color: C.textDim }}>/h</span></div>
                            <div style={{ fontSize: 9, color: C.textDim }}>手取時給</div>
                          </div>
                          )}
                        </div>
                        {!isBonusOnly && yd.bonusCount > 0 && (
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
                            賞与: {yen(yd.bonusTotal)}（{yd.bonusCount}回） / 出勤 {yd.totalDays}日 / 労働 {hrs(yd.totalHours)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
              );
            })()}

            {!trendYearCompare && (() => {
              // Apply year filter
              const yearFilterFn = (r) => !trendYear || r.yearMonth?.startsWith(trendYear);
              const filteredSalary = salaryRecords.filter(yearFilterFn);
              const filteredBonus = bonusRecords.filter(yearFilterFn);
              const filteredAll = records.filter(yearFilterFn);

              // Rebuild merged for year-filtered data
              const fMergedMap = {};
              for (const r of filteredAll) {
                const ym = r.yearMonth;
                if (!fMergedMap[ym]) fMergedMap[ym] = { yearMonth: ym, grossPay: 0, netPay: 0, totalHours: 0, _hoursSet: false };
                fMergedMap[ym].grossPay += r.grossPay;
                fMergedMap[ym].netPay += r.netPay;
                if (r.payType !== "bonus" && !fMergedMap[ym]._hoursSet) {
                  fMergedMap[ym].totalHours = r.totalHours || 0;
                  fMergedMap[ym]._hoursSet = true;
                }
              }
              const fMerged = Object.values(fMergedMap).map(m => ({
                ...m,
                grossHourly: m.totalHours > 0 ? m.grossPay / m.totalHours : 0,
                netHourly: m.totalHours > 0 ? m.netPay / m.totalHours : 0,
                takeHomeRate: m.grossPay > 0 ? (m.netPay / m.grossPay) * 100 : 0,
              })).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

              const chartData = trendFilter === "salary" ? filteredSalary
                : trendFilter === "bonus" ? filteredBonus
                : fMerged;
              const isBonusOnly = trendFilter === "bonus";

              if (chartData.length < 1) {
                return (
                  <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{isBonusOnly ? "🎉" : "📈"}</div>
                    <p>{isBonusOnly ? "賞与データがありません" : "データがありません"}</p>
                  </div>
                );
              }

              return (
              <>
                {/* Period summary card */}
                {(() => {
                  // Use filteredAll for the summary based on current trendFilter
                  const sumSource = trendFilter === "salary" ? filteredSalary
                    : trendFilter === "bonus" ? filteredBonus
                    : filteredAll;
                  if (sumSource.length === 0) return null;

                  const totalGross = sumSource.reduce((s, r) => s + r.grossPay, 0);
                  const totalNet = sumSource.reduce((s, r) => s + r.netPay, 0);
                  const totalDeductions = sumSource.reduce((s, r) => s + (r.deductions || 0), 0);

                  // For workDays, hours: use only salary records per month to avoid double-counting with bonus
                  const workDataByMonth = {};
                  for (const r of (trendFilter === "bonus" ? filteredBonus : filteredSalary)) {
                    const ym = r.yearMonth;
                    if (!workDataByMonth[ym] || r.payType !== "bonus") {
                      workDataByMonth[ym] = { workDays: r.workDays || 0, totalHours: r.totalHours || 0 };
                    }
                  }
                  const workDataValues = Object.values(workDataByMonth);
                  const totalWorkDays = workDataValues.reduce((s, d) => s + d.workDays, 0);
                  const totalHours = workDataValues.reduce((s, d) => s + d.totalHours, 0);

                  const monthCount = new Set(sumSource.map(r => r.yearMonth)).size;
                  const avgGross = totalGross / monthCount;
                  const avgNet = totalNet / monthCount;
                  const overallTHR = totalGross > 0 ? (totalNet / totalGross) * 100 : 0;
                  const avgGrossH = totalHours > 0 ? totalGross / totalHours : 0;
                  const avgNetH = totalHours > 0 ? totalNet / totalHours : 0;
                  const periodLabel = trendYear ? `${trendYear}年` : "全期間";
                  const filterLabel = trendFilter === "salary" ? "給与" : trendFilter === "bonus" ? "賞与" : "";

                  return (
                  <div style={{
                    background: C.card, borderRadius: 16, padding: 16,
                    border: `1px solid ${C.border}`, marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                      📊 {periodLabel}{filterLabel && `（${filterLabel}）`}のサマリー — {monthCount}ヶ月分
                    </div>

                    {/* Totals row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <div style={{ padding: "10px 0", background: C.surface, borderRadius: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.textDim }}>額面合計</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{yen(totalGross)}</div>
                      </div>
                      <div style={{ padding: "10px 0", background: C.surface, borderRadius: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.textDim }}>手取り合計</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{yen(totalNet)}</div>
                      </div>
                    </div>

                    {/* Averages row */}
                    <div style={{ display: "grid", gridTemplateColumns: isBonusOnly ? "1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 6 }}>
                      <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{yen(avgGross)}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>月平均額面</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{yen(avgNet)}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>月平均手取</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{pct(overallTHR)}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>手取り比率</div>
                      </div>
                    </div>
                    {!isBonusOnly && totalHours > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                      <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{yen(avgGrossH)}<span style={{ fontSize: 9, color: C.textDim }}>/h</span></div>
                        <div style={{ fontSize: 10, color: C.textDim }}>平均額面時給</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "6px 0", background: C.surface, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>{yen(avgNetH)}<span style={{ fontSize: 9, color: C.textDim }}>/h</span></div>
                        <div style={{ fontSize: 10, color: C.textDim }}>平均手取時給</div>
                      </div>
                    </div>
                    )}

                    {/* Extra stats row */}
                    {!isBonusOnly && (totalWorkDays > 0 || totalHours > 0) && (
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: C.textDim, justifyContent: "center" }}>
                        {totalWorkDays > 0 && <span>出勤 {totalWorkDays}日</span>}
                        {totalHours > 0 && <span>労働 {hrs(totalHours)}</span>}
                        <span>控除 {yen(totalDeductions)}</span>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* Hourly trend (salary & merged only) */}
                {!isBonusOnly && chartData.length >= 2 && (
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>時給の推移</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} onClick={handleChartClick} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="yearMonth" tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `¥${Math.round(v)}`} width={55} />
                      <Tooltip
                        formatter={(v, name) => [yen(v), name === "grossHourly" ? "額面時給" : "手取り時給"]}
                        labelFormatter={(l) => l}
                        contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="grossHourly" stroke={C.accent} strokeWidth={2.5} dot={{ r: 4, fill: C.accent }} name="grossHourly" />
                      <Line type="monotone" dataKey="netHourly" stroke={C.green} strokeWidth={2.5} dot={{ r: 4, fill: C.green }} name="netHourly" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: C.accent }}>● 額面時給</span>
                    <span style={{ fontSize: 12, color: C.green }}>● 手取り時給</span>
                  </div>
                </div>
                )}

                {/* Monthly pay bar chart */}
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                    {isBonusOnly ? "賞与の推移" : "月収の推移"}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} barCategoryGap="15%" onClick={handleChartClick} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="yearMonth" tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => v.slice(5)} xAxisId="gross" />
                      <XAxis dataKey="yearMonth" xAxisId="net" hide />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} width={45} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length < 1) return null;
                          const gross = payload.find(p => p.dataKey === "grossPay")?.value || 0;
                          const net = payload.find(p => p.dataKey === "netPay")?.value || 0;
                          const deduction = gross - net;
                          return (
                            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                              <div style={{ marginBottom: 4, color: C.text, fontWeight: 500 }}>{label}</div>
                              <div style={{ color: isBonusOnly ? C.amber : C.accent }}>{isBonusOnly ? "賞与額面" : "総支給額"}：{yen(gross)}</div>
                              <div style={{ color: C.green }}>{isBonusOnly ? "賞与手取" : "手取り"}：{yen(net)}</div>
                              <div style={{ color: C.red, marginTop: 2, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>控除額：{yen(deduction)}（{gross > 0 ? pct((deduction / gross) * 100) : "0%"}）</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="grossPay" fill={isBonusOnly ? C.amber : C.accent} radius={[4, 4, 0, 0]} name="grossPay" xAxisId="gross" />
                      <Bar dataKey="netPay" fill={C.green} radius={[2, 2, 0, 0]} name="netPay" xAxisId="net" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: isBonusOnly ? C.amber : C.accent }}>● {isBonusOnly ? "賞与額面" : "総支給額"}</span>
                    <span style={{ fontSize: 12, color: C.green }}>● {isBonusOnly ? "賞与手取" : "手取り"}</span>
                  </div>
                </div>

                {/* Take-home rate trend */}
                {chartData.length >= 2 && (
                <div style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1px solid ${C.border}`, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>手取り比率の推移</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} onClick={handleChartClick} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="yearMonth" tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[40, 100]} width={40} />
                      <Tooltip
                        formatter={(v) => [pct(v), "手取り比率"]}
                        contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="takeHomeRate" stroke={C.amber} strokeWidth={2.5} dot={{ r: 4, fill: C.amber }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                )}

                {/* Deduction breakdown trend */}
                {!isBonusOnly && (() => {
                  // Collect deduction data from filtered salary records
                  const sourceRecords = trendFilter === "salary" ? filteredSalary : filteredSalary;
                  const recordsWithDeductions = sourceRecords.filter(r => r.deductionItems && r.deductionItems.length > 0);
                  if (recordsWithDeductions.length === 0) return null;

                  // Collect all deduction category names
                  const catSet = new Set();
                  recordsWithDeductions.forEach(r => r.deductionItems.forEach(d => catSet.add(d.name)));
                  const categories = [...catSet];

                  // Build chart data: [{yearMonth, 健康保険: xxx, 厚生年金: xxx, ...}]
                  const deductionChartData = recordsWithDeductions.map(r => {
                    const row = { yearMonth: r.yearMonth };
                    categories.forEach(cat => { row[cat] = 0; });
                    r.deductionItems.forEach(d => { row[d.name] = (row[d.name] || 0) + d.amount; });
                    return row;
                  }).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

                  // Average deduction for pie
                  const avgDeductions = categories.map(cat => {
                    const total = deductionChartData.reduce((s, row) => s + (row[cat] || 0), 0);
                    return { name: cat, amount: Math.round(total / deductionChartData.length) };
                  }).filter(d => d.amount > 0);

                  return (
                  <div style={{
                    background: C.card, borderRadius: 16, padding: 20,
                    border: `1px solid ${C.border}`, marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>控除内訳の推移</div>

                    {/* Stacked bar chart */}
                    {deductionChartData.length >= 2 && (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={deductionChartData} onClick={handleChartClick} style={{ cursor: "pointer" }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="yearMonth" tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} width={40} />
                          <Tooltip
                            formatter={(v) => yen(v)}
                            contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                          />
                          {categories.map((cat, i) => (
                            <Bar key={cat} dataKey={cat} stackId="deductions" fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 8, marginBottom: 16 }}>
                        {categories.map((cat, i) => (
                          <span key={cat} style={{ fontSize: 11, color: PIE_COLORS[i % PIE_COLORS.length] }}>● {cat}</span>
                        ))}
                      </div>
                    </>
                    )}

                    {/* Average pie */}
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, textAlign: "center" }}>
                      月平均の控除内訳
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      <PieChart width={180} height={180}>
                        <Pie data={avgDeductions} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                          {avgDeductions.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => yen(v)} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} itemStyle={{ color: C.text }} />
                      </PieChart>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {avgDeductions.map((d, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span style={{ color: C.textMuted }}>{d.name}</span>
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 500, fontSize: 12 }}>{yen(d.amount)}/月</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}

                {/* Annual estimate */}
                {(() => {
                  // Collect all years
                  const yearsSet = new Set(records.map(r => r.yearMonth?.slice(0, 4)).filter(Boolean));
                  const years = [...yearsSet].sort().reverse();
                  if (years.length === 0) return null;

                  const selectedYear = trendYear && years.includes(trendYear) ? trendYear : years[0];
                  const yearSalary = salaryRecords.filter(r => r.yearMonth?.startsWith(selectedYear));
                  const yearBonus = bonusRecords.filter(r => r.yearMonth?.startsWith(selectedYear));
                  const yearHasSalary = yearSalary.length > 0;
                  const yearHasBonus = yearBonus.length > 0;

                  const sAvg = yearHasSalary ? yearSalary.reduce((s, r) => s + r.grossPay, 0) / yearSalary.length : 0;
                  const sNetAvg = yearHasSalary ? yearSalary.reduce((s, r) => s + r.netPay, 0) / yearSalary.length : 0;
                  const bTotal = yearBonus.reduce((s, r) => s + r.grossPay, 0);
                  const bNetTotal = yearBonus.reduce((s, r) => s + r.netPay, 0);

                  // If we have all 12 months of salary, use actual sum instead of average * 12
                  const salaryMonths = new Set(yearSalary.map(r => r.yearMonth)).size;
                  const salaryGrossAnnual = salaryMonths >= 12
                    ? yearSalary.reduce((s, r) => s + r.grossPay, 0)
                    : sAvg * 12;
                  const salaryNetAnnual = salaryMonths >= 12
                    ? yearSalary.reduce((s, r) => s + r.netPay, 0)
                    : sNetAvg * 12;

                  const annualGross = salaryGrossAnnual + bTotal;
                  const annualNet = salaryNetAnnual + bNetTotal;

                  return (
                    <div style={{
                      background: C.card, borderRadius: 16, padding: 20,
                      border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ fontSize: 13, color: C.textMuted }}>💡 年収{salaryMonths >= 12 ? "実績" : "予測"}</div>
                        {years.length > 1 && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {years.map(y => (
                              <button key={y} onClick={() => setTrendYear(y)} style={{
                                padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                                border: `1px solid ${selectedYear === y ? C.accent : C.border}`,
                                background: selectedYear === y ? C.accentDim : "transparent",
                                color: selectedYear === y ? C.accentLight : C.textMuted,
                                cursor: "pointer", transition: "all .2s",
                              }}>
                                {y}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>額面年収</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{yen(annualGross)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>手取り年収</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{yen(annualNet)}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                        {yearHasSalary && (
                          <div>給与: {salaryMonths >= 12
                            ? `${salaryMonths}ヶ月分合計 ${yen(salaryGrossAnnual)}`
                            : `月平均 ${yen(sAvg)} × 12 = ${yen(sAvg * 12)}（${salaryMonths}ヶ月分から推計）`
                          }</div>
                        )}
                        {yearHasBonus && <div>賞与: 合計 {yen(bTotal)}（{yearBonus.length}回分）</div>}
                      </div>
                    </div>
                  );
                })()}
              </>
              );
            })()}
          </div>
          );
        })()}

        {/* ══════════════════════════ SETTINGS ══════════════════════════ */}
        {screen === "settings" && (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>設定</h2>
              <button onClick={goHome} style={btnSecondary}>← 戻る</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SettingItem label="データをエクスポート" desc="JSON形式でバックアップ" action="エクスポート" onClick={exportData} />
              <SettingItem label="データをインポート" desc="バックアップから復元">
                <label style={{ ...btnSecondary, display: "inline-block", cursor: "pointer" }}>
                  インポート
                  <input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
                </label>
              </SettingItem>
              <SettingItem label="すべてのデータを削除" desc="端末内のデータを完全消去" action="削除" onClick={clearAll} danger />

              {showDeleteConfirm && (
                <div style={{
                  padding: 20, borderRadius: 14,
                  background: C.redDim, border: `1px solid rgba(248,113,113,0.3)`,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.red, marginBottom: 6 }}>
                    本当に削除しますか？
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>
                    保存されている{records.length}件のデータがすべて削除されます。この操作は取り消せません。
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{ ...btnSecondary, flex: 1 }}>キャンセル</button>
                    <button onClick={confirmClearAll} style={{
                      ...btnPrimary, flex: 1,
                      background: `linear-gradient(135deg, ${C.red}, #DC2626)`,
                      boxShadow: "0 4px 20px rgba(248,113,113,0.25)",
                    }}>すべて削除</button>
                  </div>
                </div>
              )}

              <div style={{
                marginTop: 24, padding: 20, borderRadius: 16,
                background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🔒 プライバシーについて</h3>
                <ul style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8, paddingLeft: 18 }}>
                  <li>給与データは端末内（ブラウザ）にのみ保存されます</li>
                  <li>公開版はPDFのみを対象にし、ブラウザ内で完結して処理します</li>
                  <li>サーバー側に給与データを保存・蓄積することはありません</li>
                  <li>ブラウザのデータ消去、またはアプリ内の「削除」ボタンで完全に削除できます</li>
                </ul>
              </div>

              <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: C.textDim }}>
                時給チェッカー v1.0
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Manual Form Component ──
function ManualForm({ form, setForm }) {
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const set = (obj) => setForm({ ...form, ...obj });

  const workStyles = [
    { value: "weekdays", label: "🏢 土日祝休み", desc: "週5日・平日フル" },
    { value: "sat_work", label: "🏭 日曜のみ休み", desc: "週6日・土曜出勤" },
    { value: "shift", label: "🔄 シフト勤務", desc: "月の休日数で計算" },
    { value: "short_time", label: "⏰ 時短勤務", desc: "日数・時間を自由に設定" },
  ];

  // Preset buttons for short-time / part-time patterns
  const shortTimePresets = [
    { label: "週5×6h", days: "5", hours: "6" },
    { label: "週5×5h", days: "5", hours: "5" },
    { label: "週4×8h", days: "4", hours: "8" },
    { label: "週4×6h", days: "4", hours: "6" },
    { label: "週3×8h", days: "3", hours: "8" },
    { label: "週3×5h", days: "3", hours: "5" },
  ];

  const fields = [
    { key: "grossPay", label: "総支給額（円）", placeholder: "280000", required: true },
    { key: "netPay", label: "差引支給額 / 手取り（円）", placeholder: "223000", required: true },
    { key: "totalHours", label: "総勤務時間（わかれば）", placeholder: "160" },
    { key: "overtimeHours", label: "残業時間", placeholder: "20" },
    { key: "overtimePay", label: "残業手当（円）", placeholder: "43750" },
    { key: "deductions", label: "控除合計額（円）", placeholder: "57000" },
  ];

  // Calculate estimated work days for display
  const calcPreview = () => {
    const [y, m] = (form.yearMonth || "").split("-").map(Number);
    if (!y || !m) return null;
    const totalDays = new Date(y, m, 0).getDate();
    const dailyH = parseFloat(form.dailyHours) || 8;
    const weeklyDays = parseInt(form.weeklyDays) || 5;
    let holidays = 0;

    if (form.workStyle === "weekdays") {
      for (let d = 1; d <= totalDays; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (dow === 0 || dow === 6) holidays++;
      }
    } else if (form.workStyle === "sat_work") {
      for (let d = 1; d <= totalDays; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (dow === 0) holidays++;
      }
    } else if (form.workStyle === "shift") {
      holidays = parseInt(form.customDaysOff) || 8;
    } else if (form.workStyle === "short_time") {
      // Calculate based on weekly days
      const totalWeeks = totalDays / 7;
      const workDays = Math.round(totalWeeks * weeklyDays);
      return { workDays, holidays: totalDays - workDays, scheduledHours: Math.round(workDays * dailyH * 10) / 10 };
    }

    const workDays = totalDays - holidays;
    return { workDays, holidays, scheduledHours: Math.round(workDays * dailyH * 10) / 10 };
  };
  const preview = calcPreview();

  const isShortOrShift = form.workStyle === "short_time" || form.workStyle === "shift";

  // Generate year/month options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 10; y--) yearOptions.push(y);
  const monthOptions = [];
  for (let m = 1; m <= 12; m++) monthOptions.push(m);

  const [ymYear, ymMonth] = (form.yearMonth || "").split("-");

  const selectStyle = {
    ...inputStyle,
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%238892AB' stroke-width='1.5'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 32,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Year-month */}
      <div>
        <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, display: "block" }}>
          対象年月<span style={{ color: C.red, marginLeft: 4 }}>*</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={ymYear || String(currentYear)}
            onChange={(e) => set({ yearMonth: `${e.target.value}-${(ymMonth || "01").padStart(2, "0")}` })}
            style={{ ...selectStyle, flex: 1 }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            value={ymMonth ? String(parseInt(ymMonth)) : "1"}
            onChange={(e) => set({ yearMonth: `${ymYear || currentYear}-${e.target.value.padStart(2, "0")}` })}
            style={{ ...selectStyle, flex: 1 }}
          >
            {monthOptions.map(m => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* Pay type selector */}
      <div>
        <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, display: "block" }}>
          種別<span style={{ color: C.red, marginLeft: 4 }}>*</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { value: "salary", label: "💼 給与" },
            { value: "bonus", label: "🎉 賞与" },
          ].map(pt => (
            <button key={pt.value} onClick={() => set({ payType: pt.value })} style={{
              flex: 1, padding: "10px 12px", borderRadius: 10, textAlign: "center",
              border: `1.5px solid ${form.payType === pt.value ? (pt.value === "bonus" ? C.amber : C.accent) : C.border}`,
              background: form.payType === pt.value ? (pt.value === "bonus" ? C.amberDim : C.accentDim) : C.surface,
              color: form.payType === pt.value ? (pt.value === "bonus" ? C.amber : C.accentLight) : C.textMuted,
              fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .2s",
            }}>
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work style selector */}
      <div>
        <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 8, display: "block" }}>
          勤務形態<span style={{ color: C.red, marginLeft: 4 }}>*</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {workStyles.map(ws => (
            <div
              key={ws.value}
              onClick={() => set({ workStyle: ws.value })}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${form.workStyle === ws.value ? C.accent : C.border}`,
                background: form.workStyle === ws.value ? C.accentDim : C.surface,
                cursor: "pointer",
                transition: "all .2s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: form.workStyle === ws.value ? C.accentLight : C.text }}>
                {ws.label}
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{ws.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Short-time presets */}
      {form.workStyle === "short_time" && (
        <div>
          <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, display: "block" }}>
            よくあるパターン
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {shortTimePresets.map(p => {
              const active = form.weeklyDays === p.days && form.dailyHours === p.hours;
              return (
                <button key={p.label} onClick={() => set({ weeklyDays: p.days, dailyHours: p.hours })} style={{
                  ...pill(active),
                  padding: "6px 12px",
                }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Shift: monthly days off */}
      {form.workStyle === "shift" && (
        <div>
          <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, display: "block" }}>
            月の休日数
          </label>
          <input
            type="number" inputMode="numeric"
            value={form.customDaysOff} onChange={update("customDaysOff")}
            placeholder="8" style={inputStyle}
          />
        </div>
      )}

      {/* Weekly days (for short_time) */}
      {form.workStyle === "short_time" && (
        <div>
          <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, display: "block" }}>
            週の出勤日数
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {["2", "3", "4", "5", "6"].map(d => (
              <button key={d} onClick={() => set({ weeklyDays: d })} style={{
                ...pill(form.weeklyDays === d),
                flex: 1, textAlign: "center", padding: "8px 4px",
              }}>
                {d}日
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daily work hours */}
      <div>
        <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, display: "block" }}>
          1日の所定労働時間
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {(isShortOrShift
            ? ["4", "5", "6", "7", "7.5", "8", "9", "10"]
            : ["7", "7.5", "8", "9", "10"]
          ).map(h => (
            <button key={h} onClick={() => set({ dailyHours: h })} style={{
              ...pill(form.dailyHours === h),
              padding: "8px 10px", minWidth: 44, textAlign: "center",
            }}>
              {h}h
            </button>
          ))}
          <select
            value={(isShortOrShift ? ["4","5","6","7","7.5","8","9","10"] : ["7","7.5","8","9","10"]).includes(form.dailyHours) ? "" : form.dailyHours || ""}
            onChange={(e) => { if (e.target.value) set({ dailyHours: e.target.value }); }}
            style={{
              padding: "8px 6px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${!(isShortOrShift ? ["4","5","6","7","7.5","8","9","10"] : ["7","7.5","8","9","10"]).includes(form.dailyHours) && form.dailyHours ? C.accent : C.border}`,
              background: !(isShortOrShift ? ["4","5","6","7","7.5","8","9","10"] : ["7","7.5","8","9","10"]).includes(form.dailyHours) && form.dailyHours ? C.accentDim : "transparent",
              color: !(isShortOrShift ? ["4","5","6","7","7.5","8","9","10"] : ["7","7.5","8","9","10"]).includes(form.dailyHours) && form.dailyHours ? C.accentLight : C.textMuted,
              cursor: "pointer", outline: "none", minWidth: 44, textAlign: "center",
            }}
          >
            <option value="">他</option>
            {["1","1.5","2","2.5","3","3.5","4.5","5.5","6.5","11","12","13","14","15","16"].map(h => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
        </div>
      </div>

      {/* Day count mode */}
      <div>
        <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, display: "block" }}>
          日数の基準（明細に記載がある場合）
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { value: "scheduled", label: "📅 所定日数" },
            { value: "attendance", label: "✅ 出勤日数" },
          ].map(m => (
            <button key={m.value} onClick={() => set({ dayCountMode: m.value })} style={{
              flex: 1, padding: "8px 12px", borderRadius: 10, textAlign: "center",
              border: `1.5px solid ${form.dayCountMode === m.value ? C.accent : C.border}`,
              background: form.dayCountMode === m.value ? C.accentDim : C.surface,
              color: form.dayCountMode === m.value ? C.accentLight : C.textMuted,
              fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .2s",
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work days preview */}
      {preview && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: C.accentDim, fontSize: 12, color: C.textMuted,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>📅 出勤 {preview.workDays}日 / 休日 {preview.holidays}日</span>
          <span>⏱ 所定 {preview.scheduledHours}h</span>
        </div>
      )}

      {/* Money & hours fields */}
      {fields.map(({ key, label, type, placeholder, required }) => (
        <div key={key}>
          <label style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, display: "block" }}>
            {label}{required && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
            {key === "totalHours" && preview && (
              <span style={{ color: C.textDim, marginLeft: 6, fontSize: 11 }}>
                （未入力なら{preview.scheduledHours}hで計算）
              </span>
            )}
          </label>
          <input
            type={type || "number"}
            inputMode={type ? undefined : "decimal"}
            value={form[key]}
            onChange={update(key)}
            placeholder={key === "totalHours" && preview ? String(preview.scheduledHours) : placeholder}
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  );
}

// ── Setting Item Component ──
function SettingItem({ label, desc, action, onClick, danger, children }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 20px", borderRadius: 14,
      background: C.surface, border: `1px solid ${C.border}`,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{desc}</div>
      </div>
      {children || (
        <button onClick={onClick} style={{
          ...btnSecondary,
          color: danger ? C.red : C.textMuted,
          borderColor: danger ? "rgba(248,113,113,0.3)" : C.border,
        }}>{action}</button>
      )}
    </div>
  );
}
