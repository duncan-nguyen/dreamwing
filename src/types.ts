export enum Level {
  THCS = 'THCS',
  THPT = 'THPT',
}

export interface Grade {
  subject: string;
  score: number | string;
  year: string;
  semester: '1' | '2' | 'CN';
}

export interface Student {
  id: string;
  name: string;
  class: string;
  level: Level;
  grades: Grade[];
  hollandCode?: string;
  hollandScores?: Record<string, number>;
}

export interface CareerSuggestion {
  career: string;
  reason: string;
  subjects: string[];
  universities?: string[];
  salaryRange?: string;
}

export interface AnalysisReport {
  studentId: string;
  academicSummary: {
    strongSubjects: string[];
    weakSubjects: string[];
    stability: string;
    trend: string;
  };
  hollandAnalysis: {
    code: string;
    traits: string[];
  };
  recommendations: CareerSuggestion[];
}

export type RIASECKey = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export interface HollandQuestion {
  id: number;
  text: string;
  category: RIASECKey;
}
