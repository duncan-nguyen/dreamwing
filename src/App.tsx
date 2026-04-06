import React, { useState, useMemo, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Users, 
  BarChart3, 
  ClipboardCheck, 
  FileText, 
  ChevronRight, 
  GraduationCap,
  BrainCircuit,
  Settings,
  Download,
  Moon,
  Sun
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Student, Level, RIASECKey } from './types';
import { parseVneduCsv } from './utils/csvParser';
import { HOLLAND_QUESTIONS, RIASEC_LABELS, PROVINCES } from './constants';
import { generateCareerAdviceStream } from './services/geminiService';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'import' | 'students' | 'dashboard' | 'holland' | 'report';

const EXAM_GROUPS: Record<string, string[]> = {
  'A00': ['Toán', 'Vật lí', 'Hóa học'],
  'A01': ['Toán', 'Vật lí', 'Tiếng Anh'],
  'A02': ['Toán', 'Vật lí', 'Sinh học'],
  'B00': ['Toán', 'Hóa học', 'Sinh học'],
  'B08': ['Toán', 'Sinh học', 'Tiếng Anh'],
  'C00': ['Ngữ văn', 'Lịch sử', 'Địa lí'],
  'C01': ['Ngữ văn', 'Toán', 'Vật lí'],
  'C02': ['Ngữ văn', 'Toán', 'Hóa học'],
  'D01': ['Toán', 'Ngữ văn', 'Tiếng Anh'],
  'D07': ['Toán', 'Hóa học', 'Tiếng Anh'],
  'D08': ['Toán', 'Sinh học', 'Tiếng Anh'],
  'D09': ['Toán', 'Lịch sử', 'Tiếng Anh'],
  'D10': ['Toán', 'Địa lí', 'Tiếng Anh'],
  'D14': ['Ngữ văn', 'Lịch sử', 'Tiếng Anh'],
  'D15': ['Ngữ văn', 'Địa lí', 'Tiếng Anh'],
};

const getSubjectGroups = (subject: string) => {
  return Object.entries(EXAM_GROUPS)
    .filter(([_, subjects]) => subjects.some(s => subject.includes(s) || s.includes(subject)))
    .map(([group]) => group);
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
          <h3 className="font-bold mb-2">Đã xảy ra lỗi hiển thị báo cáo</h3>
          <p className="text-sm">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const hollandSectionRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('import');
  const [level, setLevel] = useState<Level>(Level.THCS);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [tuitionBudget, setTuitionBudget] = useState<'low' | 'medium' | 'high' | ''>('');
  const [schoolType, setSchoolType] = useState<string>('');
  const [region, setRegion] = useState<string>('');

  const selectedStudent = useMemo(() => 
    students.find(s => s.id === selectedStudentId), 
    [students, selectedStudentId]
  );

  const uniqueSubjects = useMemo<string[]>(() => {
    if (!selectedStudent) return [];
    const subjects = selectedStudent.grades.map(g => g.subject);
    return Array.from(new Set(subjects));
  }, [selectedStudent]);

  const hollandCode = useMemo(() => {
    if (!selectedStudent?.hollandScores) return null;
    return Object.entries(selectedStudent.hollandScores)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([key]) => key)
      .join('');
  }, [selectedStudent]);

  const academicStats = useMemo(() => {
    if (!selectedStudent?.grades || selectedStudent.grades.length === 0) return null;
    
    const numericGrades = selectedStudent.grades.filter(g => typeof g.score === 'number') as any[];
    if (numericGrades.length === 0) return null;

    // Get latest year grades for strengths/weaknesses
    const years = Array.from(new Set(selectedStudent.grades.map(g => g.year))).sort();
    const latestYear = years[years.length - 1];
    const latestNumericGrades = numericGrades.filter(g => g.year === latestYear);
    
    // Top 3 strongest subjects from latest year
    const top3Strongest = [...latestNumericGrades]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(g => ({
        ...g,
        groups: getSubjectGroups(g.subject)
      }));

    if (top3Strongest.length === 0) return null;

    const strongSubjects = latestNumericGrades
      .filter(g => g.score >= 8.0)
      .sort((a, b) => b.score - a.score)
      .map(g => ({ ...g, groups: getSubjectGroups(g.subject) }));
      
    const weakSubjects = latestNumericGrades
      .filter(g => g.score < 6.5)
      .sort((a, b) => a.score - b.score);

    // Combined trend data for top 3 subjects
    const top3TrendData = years.map(year => {
      const data: any = { year };
      top3Strongest.forEach(s => {
        const grade = numericGrades.find(g => g.year === year && g.subject === s.subject);
        data[s.subject] = grade ? grade.score : null;
      });
      return data;
    });

    // Calculate potential group based on the top 3 strongest subjects
    const top3Subjects = top3Strongest.map(g => g.subject);
    let potentialGroup = 'Khối Thế Mạnh';
    let potentialGroupSubjects = top3Subjects;

    // Try to find an exact matching standard exam group
    for (const [group, subjects] of Object.entries(EXAM_GROUPS)) {
      const isMatch = subjects.every(s => top3Subjects.some(ts => ts.includes(s) || s.includes(ts))) && 
                      top3Subjects.every(ts => subjects.some(s => ts.includes(s) || s.includes(ts)));
      if (isMatch) {
        potentialGroup = group;
        potentialGroupSubjects = subjects;
        break;
      }
    }

    // If no exact match, let's find the group with the highest average score as a fallback
    if (potentialGroup === 'Khối Thế Mạnh') {
      let maxGroupScore = -1;
      let bestFallbackGroup = '';
      let bestFallbackSubjects: string[] = [];

      Object.entries(EXAM_GROUPS).forEach(([group, groupSubjects]) => {
        let totalScore = 0;
        let count = 0;
        groupSubjects.forEach(subject => {
          const grade = latestNumericGrades.find(g => g.subject.includes(subject) || subject.includes(g.subject));
          if (grade) {
            totalScore += grade.score;
            count++;
          }
        });
        if (count === 3) {
          const avgScore = totalScore / 3;
          if (avgScore > maxGroupScore) {
            maxGroupScore = avgScore;
            bestFallbackGroup = group;
            bestFallbackSubjects = groupSubjects;
          }
        }
      });

      if (maxGroupScore !== -1) {
        potentialGroup = bestFallbackGroup;
        potentialGroupSubjects = bestFallbackSubjects;
      }
    }

    return {
      top3Strongest,
      potentialGroup,
      potentialGroupSubjects,
      strongSubjects,
      weakSubjects,
      top3TrendData,
      latestYear,
      years
    };
  }, [selectedStudent]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    const maxFiles = level === Level.THCS ? 4 : 3;
    
    if (fileList.length > maxFiles) {
      alert(`Cấp ${level} chỉ nên nạp tối đa ${maxFiles} năm học.`);
    }

    try {
      const parsed = await parseVneduCsv(fileList, level);
      if (parsed.length === 0) {
        alert('Không tìm thấy dữ liệu học sinh trong tệp. Vui lòng kiểm tra lại định dạng tệp VNEDU.');
        return;
      }
      setStudents(parsed);
      setView('students');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const loadDemoData = () => {
    const demoStudents: Student[] = [
      {
        id: 'HS001',
        name: 'Nguyễn Văn An',
        class: '12A1',
        level: Level.THPT,
        grades: [
          { subject: 'Toán', score: 8.5, year: '2021-2022', semester: 'CN' },
          { subject: 'Toán', score: 8.8, year: '2022-2023', semester: 'CN' },
          { subject: 'Toán', score: 9.2, year: '2023-2024', semester: 'CN' },
          { subject: 'Vật lí', score: 8.0, year: '2021-2022', semester: 'CN' },
          { subject: 'Vật lí', score: 8.4, year: '2022-2023', semester: 'CN' },
          { subject: 'Vật lí', score: 8.8, year: '2023-2024', semester: 'CN' },
          { subject: 'Tiếng Anh', score: 9.0, year: '2021-2022', semester: 'CN' },
          { subject: 'Tiếng Anh', score: 9.2, year: '2022-2023', semester: 'CN' },
          { subject: 'Tiếng Anh', score: 9.5, year: '2023-2024', semester: 'CN' },
        ],
        hollandScores: { R: 12, I: 15, A: 8, S: 10, E: 14, C: 9 }
      }
    ];
    setStudents(demoStudents);
    setView('students');
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setView('dashboard');
    setAiReport(null);
  };

  const handleHollandSubmit = (scores: Record<RIASECKey, number>) => {
    if (!selectedStudent) return;
    const updatedStudents = students.map(s => 
      s.id === selectedStudent.id ? { ...s, hollandScores: scores } : s
    );
    setStudents(updatedStudents);
    setView('dashboard');
    setTimeout(() => {
      hollandSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const generateReport = async () => {
    if (!selectedStudent) return;
    
    if (!schoolType || !tuitionBudget || !region) {
      const missing = [];
      if (!region) missing.push("Nơi ở hiện tại");
      if (!tuitionBudget) missing.push("Ngân sách học phí");
      if (!schoolType) missing.push("Loại hình trường học");
      alert(`Vui lòng chọn đầy đủ thông tin trước khi xem tư vấn:\n- ${missing.join('\n- ')}`);
      return;
    }

    setIsGeneratingReport(true);
    setAiReport(' '); // Initialize with space to trigger view
    setView('report');
    
    // Scroll to top smoothly when switching to report view
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      await generateCareerAdviceStream(selectedStudent, tuitionBudget, region, schoolType, (chunk) => {
        setAiReport(prev => (prev === ' ' ? chunk : (prev || '') + chunk));
      });
    } catch (err) {
      alert('Không thể tạo báo cáo AI.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const copyReport = async () => {
    const proseElement = document.querySelector('#report-content .prose');
    if (!proseElement) {
      alert("Không tìm thấy nội dung báo cáo.");
      return;
    }
    
    try {
      // Create a clean HTML version for Word
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000;">
          <h1 style="color: #059669; text-align: center; font-size: 24pt; margin-bottom: 5px;">BÁO CÁO TƯ VẤN HƯỚNG NGHIỆP</h1>
          <h2 style="text-align: center; color: #333; font-size: 16pt; margin-top: 0; margin-bottom: 20px;">Học sinh: ${selectedStudent?.name}</h2>
          <hr style="border: 1px solid #ccc; margin-bottom: 20px;" />
          ${proseElement.innerHTML}
        </div>
      `;
      
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([proseElement.textContent || ''], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
      alert("Đã sao chép bản định dạng chuẩn! Bạn hãy mở Word và dán (Ctrl+V / Cmd+V) trực tiếp.");
    } catch (err) {
      console.error(err);
      alert("Trình duyệt không hỗ trợ sao chép định dạng. Vui lòng bôi đen và copy thủ công.");
    }
  };

  const openPrintView = () => {
    const element = document.getElementById('report-content');
    const proseElement = element?.querySelector('.prose');
    if (!proseElement) return;
    
    const studentName = selectedStudent?.name || 'Học sinh';
    const studentClass = selectedStudent?.class && !selectedStudent.class.toLowerCase().includes('unknown') ? `Lớp: ${selectedStudent.class}` : '';
    const studentLevel = selectedStudent?.level || '';
    const dateStr = new Date().toLocaleDateString('vi-VN');
      
    const html = `
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8">
          <title>Báo cáo tư vấn - ${studentName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            :root { 
              --primary: #064e3b; /* Deep Emerald */
              --accent: #b45309;  /* Elegant Gold */
              --text: #1f2937;
            }
            @page {
              size: A4;
              margin: 20mm;
            }
            body { 
              background: white !important; 
              color: var(--text) !important; 
              font-family: 'Montserrat', sans-serif;
              font-size: 11pt;
              line-height: 1.7;
              max-width: 210mm;
              margin: 0 auto;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* Luxurious Header */
            .cover-header {
              text-align: center;
              padding: 20px 0 15px;
              margin-bottom: 25px;
              border-bottom: 2px solid var(--primary) !important;
              position: relative;
            }
            .cover-header::after {
              content: '';
              position: absolute;
              bottom: -6px;
              left: 10%;
              right: 10%;
              height: 1px;
              background: var(--primary) !important;
              opacity: 0.5;
            }
            .brand-name {
              font-family: 'Montserrat', sans-serif;
              font-size: 9pt;
              font-weight: 700;
              color: var(--accent) !important;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin-bottom: 10px;
            }
            .report-title {
              font-family: 'Cormorant Garamond', serif;
              font-size: 24pt;
              font-weight: 700;
              color: var(--primary) !important;
              margin: 0 0 10px 0;
              line-height: 1.1;
            }
            .student-name {
              font-family: 'Cormorant Garamond', serif;
              font-size: 20pt;
              font-weight: 600;
              color: var(--text) !important;
              margin: 0 0 15px 0;
              font-style: italic;
            }
            .tags {
              display: flex;
              justify-content: center;
              gap: 10px;
            }
            .tag {
              background: #f3f4f6 !important;
              color: var(--primary) !important;
              padding: 4px 12px;
              border-radius: 15px;
              font-size: 8pt;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              border: 1px solid #e5e7eb !important;
            }

            /* Content Typography */
            .content {
              padding: 0 10px;
            }
            .content h1 {
              font-family: 'Cormorant Garamond', serif;
              font-size: 20pt;
              color: var(--primary) !important;
              border-bottom: 1px solid #e5e7eb !important;
              padding-bottom: 5px;
              margin: 25px 0 15px;
              page-break-after: avoid;
            }
            .content h2 {
              font-family: 'Cormorant Garamond', serif;
              font-size: 16pt;
              color: var(--primary) !important;
              margin: 20px 0 10px;
              page-break-after: avoid;
            }
            .content h3 {
              font-family: 'Montserrat', sans-serif;
              font-size: 11pt;
              font-weight: 700;
              color: var(--text) !important;
              margin: 15px 0 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              page-break-after: avoid;
            }
            .content p {
              margin-bottom: 10px;
              text-align: justify;
            }
            .content ul {
              margin-bottom: 15px;
              padding-left: 20px;
            }
            .content li {
              margin-bottom: 6px;
              text-align: justify;
            }
            .content li::marker {
              color: var(--accent) !important;
              font-size: 1.2em;
            }
            .content strong {
              color: var(--primary) !important;
              font-weight: 700;
            }
            
            /* Footer */
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb !important;
              text-align: center;
              font-size: 9pt;
              color: #6b7280 !important;
              font-family: 'Montserrat', sans-serif;
              page-break-inside: avoid;
            }
            .footer strong {
              color: var(--primary) !important;
            }
          </style>
        </head>
        <body>
          <div class="cover-header">
            <div class="brand-name">DreamWing AI</div>
            <h1 class="report-title">Báo Cáo Tư Vấn<br>Hướng Nghiệp</h1>
            <div class="student-name">${studentName}</div>
            <div class="tags">
              ${studentClass ? `<span class="tag">${studentClass}</span>` : ''}
              <span class="tag">${studentLevel}</span>
              <span class="tag">Ngày: ${dateStr}</span>
            </div>
          </div>
          
          <div class="content">
            ${proseElement.innerHTML}
          </div>

          <div class="footer">
            <p>Báo cáo được phân tích và cá nhân hóa bởi hệ thống chuyên gia <strong>DreamWing AI</strong>.</p>
            <p>Tài liệu lưu hành nội bộ - Dành riêng cho học sinh và phụ huynh.</p>
          </div>
          
          <script>
            window.onload = () => {
              setTimeout(() => window.print(), 800);
            };
          </script>
        </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans selection:bg-emerald-500/30 selection:text-emerald-900 print:bg-white print:text-black",
      isDarkMode ? "bg-black text-white" : "bg-white text-black"
    )}>
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className={cn(
          "absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse",
          isDarkMode ? "bg-emerald-500/20" : "bg-emerald-500/30"
        )} />
        <div className={cn(
          "absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-10",
          isDarkMode ? "bg-blue-500/20" : "bg-blue-500/20"
        )} />
        <div className={cn(
          "absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-10",
          isDarkMode ? "bg-purple-500/20" : "bg-purple-500/10"
        )} />
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-72 transition-all duration-500 z-50 print:hidden",
        isDarkMode ? "bg-zinc-900/80 border-r border-white/10 backdrop-blur-3xl" : "bg-white/80 border-r border-black/10 backdrop-blur-3xl shadow-2xl"
      )}>
        <div className="p-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 transform -rotate-6 hover:rotate-0 transition-transform duration-300">
            <BrainCircuit size={28} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight leading-none">DreamWing AI</h1>
            <p className="text-xs uppercase tracking-[0.1em] text-red-500 font-bold mt-1.5 text-center">Tư vấn<br/>hướng nghiệp số</p>
          </div>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          <NavItem 
            icon={<Upload size={18} />} 
            label="Nhập dữ liệu" 
            active={view === 'import'} 
            onClick={() => setView('import')}
            isDarkMode={isDarkMode}
          />
          <NavItem 
            icon={<Users size={18} />} 
            label="Danh sách học sinh" 
            active={view === 'students'} 
            onClick={() => setView('students')}
            disabled={students.length === 0}
            isDarkMode={isDarkMode}
          />
          <NavItem 
            icon={<BarChart3 size={18} />} 
            label="Phân tích năng lực" 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')}
            disabled={!selectedStudentId}
            isDarkMode={isDarkMode}
          />
          <NavItem 
            icon={<ClipboardCheck size={18} />} 
            label="Trắc nghiệm Holland" 
            active={view === 'holland'} 
            onClick={() => setView('holland')}
            disabled={!selectedStudentId}
            isDarkMode={isDarkMode}
          />
          <NavItem 
            icon={<FileText size={18} />} 
            label="Báo cáo tư vấn" 
            active={view === 'report'} 
            onClick={() => setView('report')}
            disabled={!aiReport}
            isDarkMode={isDarkMode}
          />
        </nav>

        <div className="absolute bottom-6 left-0 w-full px-6 space-y-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "flex items-center gap-3 w-full p-3 rounded-xl transition-all",
              isDarkMode ? "hover:bg-zinc-800 text-red-500" : "hover:bg-zinc-100 text-red-500"
            )}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className="text-sm font-bold">{isDarkMode ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>
          <div className={cn(
            "p-4 rounded-2xl border",
            isDarkMode ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-50 border-zinc-200"
          )}>
            <p className="text-xs font-medium opacity-60 mb-2">Học sinh đang chọn:</p>
            <p className="text-sm font-bold truncate">
              {selectedStudent ? selectedStudent.name : 'Chưa chọn'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-72 min-h-screen relative z-10 print:pl-0 print:bg-white print:text-black">
        <header className={cn(
          "h-20 flex items-center justify-between px-10 sticky top-0 z-40 backdrop-blur-3xl border-b transition-all duration-300 print:hidden",
          isDarkMode ? "bg-black/80 border-white/10" : "bg-white/80 border-black/10 shadow-sm"
        )}>
          <div className="flex items-center gap-3 text-sm font-black tracking-widest uppercase">
            <span className="opacity-40 text-zinc-500 dark:text-zinc-400">Hệ thống</span>
            <ChevronRight size={14} className="opacity-20" />
            <span className="gradient-text">{view.charAt(0).toUpperCase() + view.slice(1)}</span>
          </div>
          <div className="flex items-center gap-4">
            {selectedStudent && (
              <button 
                onClick={generateReport}
                disabled={isGeneratingReport}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={(!schoolType || !tuitionBudget || !region) ? "Vui lòng chọn đầy đủ nguyện vọng bên dưới trước khi xem tư vấn" : ""}
              >
                {isGeneratingReport ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <BrainCircuit size={16} />
                )}
                Tư vấn AI
              </button>
            )}
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto print:p-0 print:max-w-none">
          <AnimatePresence mode="wait">
            {view === 'import' && (
              <motion.div 
                key="import"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="space-y-12"
              >
                <div className="text-center max-w-3xl mx-auto space-y-6 py-16">
                  <h2 className="text-7xl font-display font-black tracking-tighter leading-none text-black dark:text-white">
                    Khám phá tương lai <br />
                    <span className="gradient-text">cùng DreamWing AI</span>
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 text-2xl font-black max-w-2xl mx-auto leading-relaxed">
                    Phân tích chân dung học tập dựa trên dữ liệu VNEDU và trắc nghiệm Holland<br/>để tìm ra lộ trình sự nghiệp tối ưu.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className={cn(
                    "p-10 rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center gap-8 transition-all group relative overflow-hidden",
                    isDarkMode ? "border-white/20 bg-zinc-900 hover:border-emerald-500" : "border-black/10 bg-white hover:border-emerald-500 shadow-2xl"
                  )}>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-20 h-20 bg-emerald-500 text-white rounded-[28px] flex items-center justify-center shadow-2xl shadow-emerald-500/40 group-hover:scale-110 transition-transform duration-500">
                      <Upload size={36} />
                    </div>
                    <div className="text-center relative z-10">
                      <h3 className="font-display font-bold text-2xl mb-3">Tải lên dữ liệu VNEDU</h3>
                      <p className="text-zinc-500 font-medium">
                        {level === Level.THCS 
                          ? "Hỗ trợ tối đa 4 tệp CSV (Khối 6 - 9)" 
                          : "Hỗ trợ tối đa 3 tệp CSV (Khối 10 - 12)"}
                      </p>
                    </div>
                    <input 
                      type="file" 
                      accept=".csv" 
                      multiple
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="csv-upload" 
                    />
                    <label 
                      htmlFor="csv-upload"
                      className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-10 py-4 rounded-2xl font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-xl relative z-10"
                    >
                      Bắt đầu tải lên
                    </label>
                    <button 
                      onClick={loadDemoData}
                      className="text-sm font-bold opacity-40 hover:opacity-100 transition-opacity relative z-10"
                    >
                      Sử dụng dữ liệu mẫu để trải nghiệm
                    </button>
                  </div>

                  <div className={cn(
                    "p-10 rounded-[40px] border flex flex-col gap-8 relative overflow-hidden",
                    isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-2xl"
                  )}>
                    <div className="relative z-10">
                      <h3 className="font-display font-black text-3xl mb-2 text-black dark:text-white">Cấu hình cấp học</h3>
                      <p className="text-zinc-600 dark:text-zinc-400 text-base font-black">Chọn cấp học để hệ thống tối ưu hóa thuật toán phân tích.</p>
                    </div>
                    <div className="space-y-4 relative z-10">
                      <button 
                        onClick={() => setLevel(Level.THCS)}
                        className={cn(
                          "w-full p-6 rounded-3xl border-2 flex items-center justify-between transition-all group",
                          level === Level.THCS 
                            ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10" 
                            : isDarkMode ? "border-white/5 hover:border-white/10" : "border-black/5 hover:border-black/10"
                        )}
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                            level === Level.THCS ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                          )}>
                            <GraduationCap size={28} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-lg">Trung học Cơ sở</p>
                            <p className="text-xs font-medium opacity-50">Dành cho học sinh Khối 6 - Khối 9</p>
                          </div>
                        </div>
                        {level === Level.THCS && <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20"><ChevronRight size={16} /></div>}
                      </button>

                      <button 
                        onClick={() => setLevel(Level.THPT)}
                        className={cn(
                          "w-full p-6 rounded-3xl border-2 flex items-center justify-between transition-all group",
                          level === Level.THPT 
                            ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10" 
                            : isDarkMode ? "border-white/5 hover:border-white/10" : "border-black/5 hover:border-black/10"
                        )}
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                            level === Level.THPT ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                          )}>
                            <GraduationCap size={28} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-lg">Trung học Phổ thông</p>
                            <p className="text-xs font-medium opacity-50">Dành cho học sinh Khối 10 - Khối 12</p>
                          </div>
                        </div>
                        {level === Level.THPT && <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20"><ChevronRight size={16} /></div>}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold">Danh sách học sinh</h2>
                    <p className="text-zinc-500 font-medium">Quản lý và chọn học sinh để bắt đầu phân tích.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                      {students.length} Học sinh
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {students.map(student => (
                      <button
                        key={student.id}
                        onClick={() => handleSelectStudent(student.id)}
                        className={cn(
                          "p-8 rounded-[32px] border text-left transition-all duration-500 group relative overflow-hidden",
                          selectedStudentId === student.id 
                            ? "border-emerald-500 bg-emerald-500/10 shadow-2xl shadow-emerald-500/40 scale-[1.02]" 
                            : isDarkMode ? "bg-zinc-900 border-white/10 hover:border-white/20" : "bg-white border-black/10 hover:border-black/20 shadow-xl"
                        )}
                      >
                      <div className="flex items-center justify-between mb-6">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold transition-transform duration-500 group-hover:scale-110",
                          selectedStudentId === student.id ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800"
                        )}>
                          {student.name.charAt(0)}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full opacity-60">
                          Lớp {student.class}
                        </div>
                      </div>
                      <h3 className="font-display font-bold text-xl mb-1 group-hover:text-emerald-500 transition-colors">{student.name}</h3>
                      <p className="text-xs font-medium opacity-40 mb-6 tracking-wide">Mã định danh: {student.id}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {student.hollandScores ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Đã có Holland
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                              Chưa có Holland
                            </div>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'dashboard' && selectedStudent && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[28px] flex items-center justify-center text-white text-3xl font-display font-bold shadow-2xl shadow-emerald-500/20">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-4xl font-display font-bold tracking-tight">{selectedStudent.name}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-widest opacity-60">Lớp {selectedStudent.class}</span>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">{selectedStudent.level}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setView('holland')}
                      className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-xl"
                    >
                      Làm trắc nghiệm Holland
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className={cn(
                    "p-10 rounded-[40px] border relative overflow-hidden",
                    isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
                  )}>
                    <div className="flex items-center justify-between mb-10">
                      <div className="space-y-1">
                        <h3 className="font-display font-black text-3xl text-black dark:text-white">Xu hướng Top 3 môn thế mạnh</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">So sánh điểm số qua các năm học</p>
                      </div>
                      <div className="flex gap-4">
                        {academicStats?.top3Strongest.map((s, idx) => (
                          <div key={s.subject} className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", idx === 0 ? "bg-emerald-500" : idx === 1 ? "bg-blue-500" : "bg-amber-500")} />
                            <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{s.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={academicStats?.top3TrendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                          <XAxis dataKey="year" stroke={isDarkMode ? '#fff' : '#000'} fontSize={12} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} />
                          <YAxis domain={[0, 10]} stroke={isDarkMode ? '#fff' : '#000'} fontSize={12} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: isDarkMode ? '#000' : '#fff', 
                              border: '2px solid rgba(16, 185, 129, 0.5)', 
                              borderRadius: '24px',
                              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.8)',
                              padding: '20px'
                            }} 
                            itemStyle={{ fontSize: '14px', fontWeight: '900' }}
                          />
                          {academicStats?.top3Strongest.map((s, idx) => (
                            <Line 
                              key={s.subject}
                              type="monotone" 
                              dataKey={s.subject} 
                              stroke={idx === 0 ? "#059669" : idx === 1 ? "#2563eb" : "#d97706"} 
                              strokeWidth={6} 
                              dot={{ r: 8, fill: idx === 0 ? "#059669" : idx === 1 ? "#2563eb" : "#d97706", strokeWidth: 4, stroke: isDarkMode ? '#000' : '#fff' }} 
                              activeDot={{ r: 10, strokeWidth: 0 }} 
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-10" ref={hollandSectionRef}>
                    <div className={cn(
                      "p-10 rounded-[40px] border flex flex-col relative overflow-hidden",
                      isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
                    )}>
                      <div className="flex items-center justify-between mb-10">
                        <h3 className="font-display font-black text-3xl text-black dark:text-white">Mật mã Holland</h3>
                        {hollandCode && (
                          <div className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xl tracking-[0.3em] shadow-lg shadow-emerald-500/20">
                            {hollandCode}
                          </div>
                        )}
                      </div>
                      {selectedStudent.hollandScores ? (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={Object.entries(selectedStudent.hollandScores).map(([key, value]) => ({ subject: key, A: value }))}>
                              <PolarGrid stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#888' }} />
                              <Radar name="Holland" dataKey="A" stroke="#10b981" strokeWidth={3} fill="#10b981" fillOpacity={0.4} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[250px] text-center gap-6">
                          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 animate-pulse">
                            <ClipboardCheck size={40} />
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-display font-bold text-xl">Bắt buộc thực hiện</h4>
                            <p className="text-sm font-medium opacity-60 max-w-[280px]">Bạn cần hoàn thành trắc nghiệm Holland để AI có thể phân tích và tư vấn chính xác nhất.</p>
                          </div>
                          <button 
                            onClick={() => setView('holland')}
                            className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all active:scale-95"
                          >
                            Làm trắc nghiệm ngay
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedStudent.hollandScores && (
                      <div className={cn(
                        "p-10 rounded-[40px] border flex flex-col relative overflow-hidden",
                        isDarkMode ? "bg-red-950/40 border-red-800/50" : "bg-red-50 border-red-200 shadow-xl"
                      )}>
                        <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                          <h4 className="font-display font-bold text-xl text-red-600 dark:text-red-400 mb-2">Bắt buộc: Khảo sát nguyện vọng</h4>
                          <p className="text-sm text-red-800/70 dark:text-red-200/70 font-medium">Vui lòng chọn đầy đủ 3 thông tin bên dưới để AI có thể tư vấn chính xác nhất.</p>
                        </div>

                        <label className="text-base font-bold uppercase tracking-[0.2em] text-red-800 dark:text-red-300 mb-4 block">
                          Loại hình trường học
                        </label>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          {(level === Level.THCS 
                            ? ['THPT Công lập', 'THPT Dân lập', 'TT GDTX', 'Trung cấp nghề']
                            : ['Đại học', 'Cao đẳng', 'Trung cấp nghề']
                          ).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSchoolType(type)}
                              className={cn(
                                "px-4 py-5 rounded-2xl text-sm font-bold border transition-all relative z-10",
                                schoolType === type 
                                  ? "bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/30 scale-105" 
                                  : "bg-white dark:bg-zinc-900 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-100 hover:border-red-500/50"
                              )}
                            >
                              <div className="uppercase tracking-widest">{type}</div>
                            </button>
                          ))}
                        </div>

                        <label className="text-base font-bold uppercase tracking-[0.2em] text-red-800 dark:text-red-300 mb-4 block">
                          Ngân sách học phí
                        </label>
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          {[
                            { id: 'low', label: 'Thấp', desc: '< 20tr' },
                            { id: 'medium', label: 'Trung', desc: '20-50tr' },
                            { id: 'high', label: 'Cao', desc: '> 50tr' }
                          ].map((b) => (
                            <button
                              key={b.id}
                              onClick={() => setTuitionBudget(b.id as any)}
                              className={cn(
                                "px-4 py-5 rounded-2xl text-sm font-bold border transition-all relative z-10",
                                tuitionBudget === b.id 
                                  ? "bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/30 scale-105" 
                                  : "bg-white dark:bg-zinc-900 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-100 hover:border-red-500/50"
                              )}
                            >
                              <div className="uppercase tracking-widest mb-1">{b.label}</div>
                              <div className="font-medium opacity-70 text-xs">{b.desc}</div>
                            </button>
                          ))}
                        </div>

                        <label className="text-base font-bold uppercase tracking-[0.2em] text-red-800 dark:text-red-300 mb-4 block">
                          Nơi ở hiện tại / Mong muốn tìm trường ở địa chỉ
                        </label>
                        <div className="mb-10 relative z-10 space-y-3">
                          <input
                            type="text"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="Nhập tên Xã, Tỉnh (theo tên mới sau khi gộp)..."
                            className="w-full px-6 py-5 rounded-2xl text-lg font-bold border bg-white dark:bg-zinc-900 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm placeholder:text-red-900/30 dark:placeholder:text-red-100/30"
                          />
                          <p className="text-xs text-red-700/70 dark:text-red-300/70 italic font-medium px-2">
                            * Do hệ thống hành chính vừa gộp Tỉnh và Xã, vui lòng nhập trực tiếp tên địa giới hành chính mới nhất của bạn (VD: Xã An Bình, Tỉnh Bình Dương).
                          </p>
                        </div>

                        <button 
                          onClick={generateReport}
                          disabled={isGeneratingReport}
                          className={cn(
                            "w-full py-6 rounded-[24px] font-display font-bold text-xl transition-all flex items-center justify-center gap-3 relative z-10",
                            isGeneratingReport
                              ? "bg-red-200 dark:bg-red-900/50 text-red-600 dark:text-red-500 cursor-not-allowed opacity-50"
                              : "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-2xl shadow-red-600/30 hover:scale-[1.02] active:scale-95"
                          )}
                        >
                          {isGeneratingReport ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BrainCircuit size={24} />}
                          {(!schoolType || !tuitionBudget || !region) ? "Vui lòng chọn đủ thông tin để xem tư vấn" : "Xem phân tích chuyên sâu"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={cn(
                    "lg:col-span-2 p-8 rounded-[40px] border flex flex-col justify-center relative overflow-hidden",
                    isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
                  )}>
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-6 block">
                      Top 3 môn mạnh nhất & Khối thi
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {academicStats?.top3Strongest.map((s, idx) => (
                        <div key={s.subject} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg",
                              idx === 0 ? "bg-emerald-500 shadow-emerald-500/20" : idx === 1 ? "bg-blue-500 shadow-blue-500/20" : "bg-purple-500 shadow-purple-500/20"
                            )}>
                              {s.score}
                            </div>
                            <div>
                              <div className="text-sm font-black tracking-tight">{s.subject}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.groups.map(g => (
                                  <span key={g} className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[8px] font-black uppercase tracking-tighter opacity-60">{g}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <StatCard 
                    label="Khối tiềm năng" 
                    value={academicStats?.potentialGroup || 'Chưa xác định'} 
                    subValue={academicStats?.potentialGroupSubjects.join(', ') || 'Đang cập nhật'}
                    isDarkMode={isDarkMode}
                  />
                </div>

                <div className="pt-10 space-y-10">
                  <h3 className="text-3xl font-display font-bold tracking-tight flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                      <BarChart3 size={24} />
                    </div>
                    Hồ sơ năng lực học tập
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className={cn(
                      "p-10 rounded-[40px] border relative overflow-hidden",
                      isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
                    )}>
                      <h3 className="font-display font-black text-3xl mb-10 text-black dark:text-white">Lộ trình Điểm trung bình tổng quát</h3>
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={academicStats?.years.map(year => {
                            const yearGrades = selectedStudent.grades.filter(g => g.year === year && typeof g.score === 'number');
                            const avg = yearGrades.reduce((acc, curr) => acc + (curr.score as number), 0) / yearGrades.length;
                            return { year, avg: avg.toFixed(2) };
                          })}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                            <XAxis dataKey="year" stroke={isDarkMode ? '#fff' : '#000'} fontSize={12} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} />
                            <YAxis domain={[0, 10]} stroke={isDarkMode ? '#fff' : '#000'} fontSize={12} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: isDarkMode ? '#000' : '#fff', 
                                border: '2px solid rgba(59, 130, 246, 0.5)', 
                                borderRadius: '24px',
                                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.8)',
                                padding: '20px'
                              }} 
                            />
                            <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={6} dot={{ r: 8, fill: '#2563eb', strokeWidth: 4, stroke: isDarkMode ? '#000' : '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className={cn(
                      "p-10 rounded-[40px] border relative overflow-hidden",
                      isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
                    )}>
                      <h3 className="font-display font-black text-3xl mb-10 text-black dark:text-white">Thế mạnh & Điểm yếu ({academicStats?.latestYear})</h3>
                      <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Môn thế mạnh
                          </h4>
                          <div className="space-y-3">
                            {academicStats?.strongSubjects.length ? academicStats.strongSubjects.map(s => (
                              <div key={s.subject} className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 group hover:bg-emerald-500/10 transition-colors">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">{s.subject}</span>
                                  <div className="flex gap-1 mt-1">
                                    {s.groups.map(g => (
                                      <span key={g} className="text-[8px] font-black uppercase tracking-tighter opacity-40">{g}</span>
                                    ))}
                                  </div>
                                </div>
                                <span className="text-sm font-black text-emerald-500">{s.score}</span>
                              </div>
                            )) : <p className="text-xs font-medium opacity-40 italic">Chưa có môn đạt điểm giỏi (≥ 8.0)</p>}
                          </div>
                        </div>
                        <div className="space-y-6">
                          <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            Cần cải thiện
                          </h4>
                          <div className="space-y-3">
                            {academicStats?.weakSubjects.length ? academicStats.weakSubjects.map(s => (
                              <div key={s.subject} className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 group hover:bg-rose-500/10 transition-colors">
                                <span className="text-sm font-bold">{s.subject}</span>
                                <span className="text-sm font-black text-rose-500">{s.score}</span>
                              </div>
                            )) : <p className="text-xs font-medium opacity-40 italic">Không có môn điểm thấp (&lt; 6.5)</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "p-10 rounded-[40px] border relative overflow-hidden",
                    isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-white/40 border-black/5 shadow-sm"
                  )}>
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="font-display font-bold text-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                          <ClipboardCheck size={24} />
                        </div>
                        Bảng điểm tổng hợp
                      </h3>
                    </div>
                    <div className="overflow-x-auto -mx-10 px-10">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black/5 dark:border-white/5">
                            <th className="py-6 px-4 text-xl font-bold uppercase tracking-[0.2em] opacity-40">Môn học</th>
                            {Array.from(new Set(selectedStudent.grades.map(g => g.year))).sort().map(year => (
                              <th key={year} className="py-6 px-4 text-xl font-bold uppercase tracking-[0.2em] opacity-40 text-center">
                                {year}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueSubjects.sort().map(subject => (
                            <tr key={subject} className="border-b border-black/[0.02] dark:border-white/[0.02] last:border-0 hover:bg-emerald-500/[0.02] transition-colors group">
                              <td className="py-6 px-4 font-bold text-2xl group-hover:text-emerald-500 transition-colors">{subject}</td>
                              {Array.from(new Set(selectedStudent.grades.map(g => g.year))).sort().map(year => {
                                const grade = selectedStudent.grades.find(g => g.subject === subject && g.year === year);
                                return (
                                  <td key={year} className="py-6 px-4 text-center">
                                    {grade ? (
                                      <span className={cn(
                                        "font-black text-2xl",
                                        typeof grade.score === 'number' && grade.score >= 8.0 ? "text-emerald-500" : 
                                        typeof grade.score === 'number' && grade.score < 6.5 ? "text-rose-500" : "opacity-60"
                                      )}>
                                        {grade.score}
                                      </span>
                                    ) : (
                                      <span className="opacity-10 font-bold text-2xl">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}

            {view === 'holland' && selectedStudent && (
              <motion.div 
                key="holland"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-12 py-10"
              >
                <div className="text-center space-y-6">
                  <h2 className="text-5xl font-display font-extrabold tracking-tight">Trắc nghiệm Holland</h2>
                  <p className="text-zinc-500 text-lg font-medium max-w-2xl mx-auto">
                    Hãy đánh giá mức độ phù hợp của bạn với các mô tả dưới đây để DreamWing AI có thể thấu hiểu thiên hướng nghề nghiệp của bạn.
                  </p>
                  <div className="flex items-center justify-center gap-8 pt-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40">
                      <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      1: Không đúng
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      5: Rất đúng
                    </div>
                  </div>
                </div>

                <HollandForm onSubmit={handleHollandSubmit} isDarkMode={isDarkMode} />
              </motion.div>
            )}

            {view === 'report' && aiReport && (
              <motion.div 
                key="report"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between print:hidden">
                  <div>
                    <h2 className="text-3xl font-display font-bold tracking-tight">Báo cáo tư vấn</h2>
                    <p className="text-zinc-500 font-medium">Báo cáo được cá nhân hóa bởi DreamWing AI</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={copyReport}
                      disabled={isGeneratingReport}
                      className={cn(
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all",
                        isGeneratingReport ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                      )}
                    >
                      <ClipboardCheck size={18} />
                      Sao chép
                    </button>
                    <button 
                      onClick={openPrintView}
                      disabled={isGeneratingReport}
                      className={cn(
                        "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-xl transition-all",
                        isGeneratingReport ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                      )}
                    >
                      <FileText size={18} />
                      Bản in / PDF
                    </button>
                  </div>
                </div>

                <div 
                  id="report-content"
                  className={cn(
                    "p-10 md:p-16 rounded-[40px] md:rounded-[60px] border relative overflow-hidden print:p-0 print:border-none print:shadow-none print:bg-transparent",
                    isDarkMode ? "bg-zinc-900/80 border-white/10 backdrop-blur-3xl" : "bg-white border-black/10 shadow-2xl"
                  )}
                >
                  {/* Header Section */}
                  <div className="flex flex-col md:flex-row items-center gap-8 mb-12 border-b border-black/10 dark:border-white/10 pb-12">
                    <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[40px] flex items-center justify-center text-white text-6xl font-display font-black shadow-2xl shadow-emerald-500/30 transform -rotate-3">
                      {selectedStudent?.name.charAt(0)}
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="text-4xl md:text-5xl font-display font-black tracking-tight mb-4 text-black dark:text-white">
                        {selectedStudent?.name}
                      </h3>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        {selectedStudent?.class && !selectedStudent.class.toLowerCase().includes('unknown') && (
                          <span className="px-5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                            Lớp {selectedStudent.class}
                          </span>
                        )}
                        <span className="px-5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold uppercase tracking-widest">
                          {selectedStudent?.level}
                        </span>
                        <span className="px-5 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-bold uppercase tracking-widest">
                          Ngân sách: {tuitionBudget === 'low' ? 'Thấp' : tuitionBudget === 'medium' ? 'Trung bình' : 'Cao'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-sm font-bold opacity-40 uppercase tracking-widest mb-1">Ngày xuất báo cáo</div>
                      <div className="text-xl font-display font-bold text-emerald-600 dark:text-emerald-400">
                        {new Date().toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  {/* AI Content Section */}
                  <div className="relative">
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full opacity-20 hidden md:block"></div>
                    <div className="md:pl-8 prose prose-lg md:prose-xl prose-zinc dark:prose-invert max-w-none 
                      prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight
                      prose-h1:text-4xl prose-h1:text-emerald-600 dark:prose-h1:text-emerald-400 prose-h1:mb-8
                      prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-black dark:prose-h2:text-white
                      prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
                      prose-p:font-medium prose-p:leading-relaxed prose-p:text-zinc-700 dark:prose-p:text-zinc-300
                      prose-li:font-medium prose-li:text-zinc-700 dark:prose-li:text-zinc-300
                      prose-strong:text-black dark:prose-strong:text-white prose-strong:font-black
                      prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-zinc-300 dark:prose-th:border-zinc-700 prose-th:p-3 prose-th:bg-zinc-100 dark:prose-th:bg-zinc-800
                      prose-td:border prose-td:border-zinc-300 dark:prose-td:border-zinc-700 prose-td:p-3
                      print:prose-p:text-black print:prose-headings:text-black print:prose-li:text-black print:prose-strong:text-black"
                    >
                      {aiReport === ' ' ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                          <span className="ml-4 text-zinc-500 font-medium">Đang phân tích dữ liệu...</span>
                        </div>
                      ) : (
                        <ErrorBoundary>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiReport}</ReactMarkdown>
                          {(!aiReport || aiReport.trim() === '') && (
                            <div className="text-red-500 font-bold py-4">
                              Lỗi: Báo cáo trống. Nội dung nhận được: "{aiReport}"
                            </div>
                          )}
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-20 pt-8 border-t border-black/10 dark:border-white/10 text-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                      Báo cáo được phân tích và tạo tự động bởi <span className="text-emerald-500">DreamWing AI</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, disabled, isDarkMode }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  disabled?: boolean,
  isDarkMode: boolean
}) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 w-full p-4 rounded-2xl transition-all font-black text-sm uppercase tracking-widest",
        active 
          ? "bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 scale-[1.02]" 
          : disabled 
            ? "opacity-20 cursor-not-allowed" 
            : isDarkMode ? "text-zinc-500 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, subValue, isDarkMode }: { label: string, value: string, subValue: string, isDarkMode: boolean }) {
  return (
    <div className={cn(
      "p-8 rounded-[32px] border transition-all duration-500 hover:scale-[1.02] group",
      isDarkMode ? "bg-zinc-900 border-white/20" : "bg-white border-black/10 shadow-xl"
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-6 group-hover:text-emerald-500 transition-colors">{label}</p>
      <p className="text-4xl font-display font-black mb-3 tracking-tighter text-black dark:text-white">{value}</p>
      <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{subValue}</p>
    </div>
  );
}

function HollandForm({ onSubmit, isDarkMode }: { onSubmit: (scores: Record<RIASECKey, number>) => void, isDarkMode: boolean }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scores: Record<RIASECKey, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    HOLLAND_QUESTIONS.forEach(q => {
      scores[q.category] += answers[q.id] || 0;
    });
    onSubmit(scores);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <div className="space-y-6">
        {HOLLAND_QUESTIONS.map(q => (
          <div 
            key={q.id} 
            className={cn(
              "p-10 rounded-[40px] border flex flex-col md:flex-row md:items-center justify-between gap-8 transition-all duration-500",
              isDarkMode ? "bg-zinc-900 border-white/10" : "bg-white border-black/10 shadow-md"
            )}
          >
            <p className="font-black text-xl max-w-xl leading-relaxed text-black dark:text-white">{q.text}</p>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                  className={cn(
                    "w-14 h-14 rounded-2xl border-2 font-black text-lg transition-all transform active:scale-90",
                    answers[q.id] === val 
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20 scale-110" 
                      : isDarkMode ? "border-white/5 bg-zinc-800/50 hover:border-white/20" : "border-black/5 bg-zinc-50 hover:border-black/10"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button 
        type="submit"
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-6 rounded-[32px] font-display font-extrabold text-xl shadow-2xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95 mt-12"
      >
        Hoàn thành & Xem kết quả phân tích
      </button>
    </form>
  );
}
