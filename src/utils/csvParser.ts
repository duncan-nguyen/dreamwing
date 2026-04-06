import Papa from 'papaparse';
import { Student, Level, Grade } from '../types';

export function parseVneduCsv(files: File[], level: Level): Promise<Student[]> {
  const studentsMap: Record<string, Student> = {};

  const parseFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);
        
        let headerIndex = -1;
        let academicYear = 'Unknown';

        // Try to find academic year in the first few lines
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const line = lines[i];
          const yearMatch = line.match(/NĂM HỌC (\d{4}\s?-\s?\d{4})/i);
          if (yearMatch) {
            academicYear = yearMatch[1].replace(/\s/g, '');
            break;
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line.includes('stt') && (line.includes('họ và tên') || line.includes('mã học sinh'))) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          resolve(); // Skip this file if no header found
          return;
        }

        const validCsvContent = lines.slice(headerIndex).join('\n');

        Papa.parse(validCsvContent, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            const data = results.data as any[];

            data.forEach((row, index) => {
              const normalizedRow: Record<string, any> = {};
              Object.keys(row).forEach(k => {
                normalizedRow[k.trim().toLowerCase()] = row[k];
              });

              const name = row['Họ và tên'] || row['Họ tên'] || row['Full Name'] || row['Name'] || 
                           normalizedRow['họ tên'] || normalizedRow['họ và tên'] || normalizedRow['name'];
              
              const className = row['Lớp'] || row['Class'] || normalizedRow['lớp'] || normalizedRow['class'] || 'Unknown';
              
              const studentId = row['Mã học sinh'] || row['Mã HS'] || row['Student ID'] || 
                                normalizedRow['mã học sinh'] || normalizedRow['mã hs'] || `student-${index}`;

              if (!name || String(name).trim() === '' || String(name).includes('Danh sách này có')) return;
              if (!studentId || String(studentId).trim() === '') return;

              const id = String(studentId).trim();

              if (!studentsMap[id]) {
                studentsMap[id] = {
                  id,
                  name: String(name).trim(),
                  class: String(className).trim(),
                  level,
                  grades: [],
                };
              }

              Object.keys(row).forEach(key => {
                const val = row[key];
                if (!val || String(val).trim() === '') return;
                
                const trimmedVal = String(val).trim();
                const scoreStr = trimmedVal.replace(',', '.');
                const scoreNum = parseFloat(scoreStr);
                const finalScore = isNaN(scoreNum) ? trimmedVal : scoreNum;
                
                if (isSubject(key)) {
                  // Avoid duplicate grades for the same subject/year/semester
                  const exists = studentsMap[id].grades.some(g => 
                    g.subject === key.trim() && g.year === academicYear
                  );
                  
                  if (!exists) {
                    studentsMap[id].grades.push({
                      subject: key.trim(),
                      score: finalScore,
                      year: academicYear,
                      semester: 'CN',
                    });
                  }
                }
              });
            });
            resolve();
          },
          error: (error) => reject(error),
        });
      };
      reader.onerror = () => reject(new Error("Lỗi khi đọc tệp."));
      reader.readAsText(file);
    });
  };

  return Promise.all(files.map(f => parseFile(f))).then(() => {
    const result = Object.values(studentsMap);
    // Sort grades by year for each student
    result.forEach(s => {
      s.grades.sort((a, b) => a.year.localeCompare(b.year));
    });
    return result;
  });
}

function isSubject(name: string): boolean {
  const commonSubjects = [
    'Toán', 'Vật lí', 'Vật lý', 'Hóa học', 'Ngữ văn', 'Tiếng Anh', 'Sinh học', 
    'Lịch sử', 'Địa lí', 'Địa lý', 'GDCD', 'Công nghệ', 'Tin học', 'Thể dục', 
    'Âm nhạc', 'Mỹ thuật', 'Ngoại ngữ', 'KHTN', 'LS&ĐL', 'GDĐP', 'HĐTN',
    'Tin', 'Văn', 'Ng.ngữ', 'C.nghệ', 'GDTC', 'Nghệ thuật', 'NDGDCĐP', 'HĐTN&HN'
  ];
  const normalizedName = name.trim().toLowerCase();
  return commonSubjects.some(s => {
    const normalizedS = s.toLowerCase();
    return normalizedName.includes(normalizedS) || normalizedS.includes(normalizedName);
  });
}
