import { GoogleGenAI } from "@google/genai";
import { Student, AnalysisReport, RIASECKey } from "../types";
import { RIASEC_LABELS } from "../constants";

export async function generateCareerAdviceStream(
  student: Student, 
  tuitionBudget: 'low' | 'medium' | 'high', 
  region: string,
  schoolType: string,
  onChunk: (text: string) => void
): Promise<void> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      onChunk("Lỗi: Không tìm thấy API Key của Gemini. Vui lòng kiểm tra cấu hình.");
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const academicData = student.grades.map(g => `${g.subject} (${g.year} - HK${g.semester}): ${g.score}`).join('\n');
    const hollandData = student.hollandScores 
      ? Object.entries(student.hollandScores)
          .map(([key, score]) => `${RIASEC_LABELS[key as RIASECKey]}: ${score}`)
          .join('\n')
      : "Chưa có dữ liệu trắc nghiệm Holland.";

    const budgetText = tuitionBudget === 'low' ? "Thấp (ưu tiên trường công lập, học phí < 20tr/năm)" : 
                       tuitionBudget === 'medium' ? "Trung bình (trường công lập tự chủ hoặc tư thục vừa phải, 20-50tr/năm)" : 
                       "Cao (trường tư thục chất lượng cao, quốc tế, > 50tr/năm)";

    const strongSubjects = student.grades.filter(g => typeof g.score === 'number' && g.score >= 8.0).map(g => g.subject).join(', ');
    const weakSubjects = student.grades.filter(g => typeof g.score === 'number' && g.score < 6.5).map(g => g.subject).join(', ');

    const prompt = `
      Bạn là một chuyên gia tư vấn hướng nghiệp cao cấp (DreamWing AI).
      Hãy phân tích dữ liệu của học sinh sau đây và đưa ra báo cáo tư vấn chi tiết.
      
      THÔNG TIN HỌC SINH:
      - Tên: ${student.name}
      - Cấp học: ${student.level}
      - Lớp: ${student.class}
      - Ngân sách học phí mong muốn: ${budgetText}
      - Khu vực ưu tiên chọn trường: ${region}
      - Loại hình trường học mong muốn: ${schoolType}
      
      DỮ LIỆU ĐIỂM SỐ (ĐA NĂM):
      ${academicData}
      
      CÁC MÔN THẾ MẠNH (>= 8.0): ${strongSubjects || "Không có"}
      CÁC MÔN CẦN CẢI THIỆN (< 6.5): ${weakSubjects || "Không có"}
      
      DỮ LIỆU TRẮC NGHIỆM HOLLAND:
      ${hollandData}
      
      HƯỚNG DẪN TƯ VẤN CHUYÊN SÂU & THỰC TẾ (BẮT BUỘC TUÂN THỦ):
      1. Đánh giá học lực thực tế & Chuyển hướng (NẾU CẦN):
         - Hãy nhìn thẳng vào điểm số của học sinh. Nếu học lực YẾU hoặc TRUNG BÌNH (điểm trung bình các môn chính < 6.5):
           + Đối với học sinh THCS: Khả năng đỗ THPT Công lập là rất thấp. Hãy tư vấn chân thành, khuyên học sinh nên chọn THPT Dân lập, Trung tâm Giáo dục thường xuyên (TT GDTX), hoặc Trung cấp nghề.
           + Đối với học sinh THPT: Khả năng đỗ Đại học là rất thấp. Hãy tư vấn chân thành, khuyên học sinh nên chọn trường Cao đẳng hoặc trường Nghề.
         - Nếu học sinh chọn mục tiêu là "${schoolType}" nhưng học lực KHÔNG ĐỦ đáp ứng (ví dụ: học lực yếu nhưng chọn Đại học/THPT Công lập), hãy nhẹ nhàng phân tích thực tế và khuyên họ chuyển hướng sang loại hình phù hợp hơn.
      2. Gợi ý trường học:
         - Tập trung gợi ý các trường thuộc loại hình "${schoolType}" (hoặc loại hình bạn vừa khuyên chuyển hướng) tại khu vực "${region}".
         - Đảm bảo các trường này phù hợp với mức học phí: ${budgetText}.
      
      YÊU CẦU BÁO CÁO:
      1. Phân tích xu hướng học tập: Dựa trên dữ liệu nhiều năm, hãy nhận xét về sự tiến bộ hoặc sụt giảm của học sinh ở các môn học then chốt.
      2. Tóm tắt năng lực học tập: Xác định các môn mạnh nhất, môn cần cải thiện, và độ ổn định qua các năm.
      3. Đối chiếu Holland: Kết nối mật mã Holland với năng lực học tập thực tế và xu hướng phát triển.
         - QUAN TRỌNG: Ở TẤT CẢ các phần có nhắc đến ký hiệu Holland (S, E, R, I, A, C), BẮT BUỘC phải ghi chú rõ nghĩa của nó ngay bên cạnh.
         - Ví dụ: S (Xã hội), E (Quản lý/Khởi nghiệp), R (Thực tế), I (Nghiên cứu), A (Nghệ thuật), C (Nghiệp vụ).
      4. Phân tích thị trường lao động:
         - Nhu cầu thị trường năm nay cho các ngành liên quan.
         - Dự báo xu hướng trong 5-10 năm tới.
      5. Gợi ý nghề nghiệp cụ thể: Đề xuất ít nhất 3 nghề nghiệp có tên gọi cụ thể, giải thích lý do.
      6. Gợi ý trường học:
         - Liệt kê các trường tiêu biểu cho từng nghề nghiệp gợi ý bằng GẠCH ĐẦU DÒNG (Bullet points).
         - TUYỆT ĐỐI KHÔNG SỬ DỤNG BẢNG (TABLE) để tránh lỗi hiển thị trên thiết bị di động.
         - Cung cấp thông tin học phí dự kiến cho từng trường để phụ huynh tham khảo.
      7. Lộ trình hành động: Các bước cụ thể học sinh nên làm tiếp theo.
      
      LƯU Ý QUAN TRỌNG VỀ NGÔN NGỮ & ĐỐI TƯỢNG:
      - SỬ DỤNG NGÔN NGỮ BÌNH DÂN, GẦN GŨI, DỄ HIỂU. Tránh tuyệt đối các từ ngữ quá hàn lâm, phức tạp. Viết sao cho phụ huynh ở mọi trình độ đều có thể đọc hiểu ngay lập tức.
      - Định dạng: Sử dụng Markdown để trình bày đẹp mắt.
    `;

    console.log("Calling Gemini API with generateContentStream...");
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });
    
    let hasContent = false;
    let accumulatedText = "";
    let lastUpdateTime = Date.now();

    for await (const chunk of responseStream) {
      if (chunk.text) {
        hasContent = true;
        accumulatedText += chunk.text;
        
        // Throttle updates to UI to every 150ms to prevent React rendering crashes but keep it fast
        if (Date.now() - lastUpdateTime > 150) {
          onChunk(accumulatedText);
          accumulatedText = "";
          lastUpdateTime = Date.now();
        }
      }
    }
    
    // Send any remaining text
    if (accumulatedText) {
      onChunk(accumulatedText);
    }
    
    if (!hasContent) {
      onChunk("Không nhận được phản hồi từ AI. Vui lòng thử lại.");
    }
  } catch (error: any) {
    console.error("Error generating career advice:", error);
    onChunk(`\n\nĐã xảy ra lỗi khi kết nối với AI: ${error.message || error}. Vui lòng thử lại sau.`);
  }
}
