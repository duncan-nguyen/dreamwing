import { RIASECKey, HollandQuestion } from './types';

export const RIASEC_LABELS: Record<RIASECKey, string> = {
  R: 'Realistic (Kỹ thuật)',
  I: 'Investigative (Nghiên cứu)',
  A: 'Artistic (Nghệ thuật)',
  S: 'Social (Xã hội)',
  E: 'Enterprising (Quản lý)',
  C: 'Conventional (Nghiệp vụ)',
};

export const HOLLAND_QUESTIONS: HollandQuestion[] = [
  // Realistic
  { id: 1, text: 'Tôi thích sửa chữa các đồ vật trong nhà.', category: 'R' },
  { id: 2, text: 'Tôi thích làm việc với máy móc, công cụ.', category: 'R' },
  { id: 3, text: 'Tôi thích các hoạt động ngoài trời.', category: 'R' },
  // Investigative
  { id: 4, text: 'Tôi thích giải các bài toán khó.', category: 'I' },
  { id: 5, text: 'Tôi thích tìm hiểu cách thức hoạt động của mọi thứ.', category: 'I' },
  { id: 6, text: 'Tôi thích thực hiện các thí nghiệm khoa học.', category: 'I' },
  // Artistic
  { id: 7, text: 'Tôi thích vẽ, điêu khắc hoặc thiết kế.', category: 'A' },
  { id: 8, text: 'Tôi thích viết lách, làm thơ hoặc viết truyện.', category: 'A' },
  { id: 9, text: 'Tôi thích biểu diễn âm nhạc hoặc kịch.', category: 'A' },
  // Social
  { id: 10, text: 'Tôi thích giúp đỡ mọi người giải quyết vấn đề của họ.', category: 'S' },
  { id: 11, text: 'Tôi thích giảng dạy hoặc hướng dẫn người khác.', category: 'S' },
  { id: 12, text: 'Tôi thích làm việc trong các nhóm tình nguyện.', category: 'S' },
  // Enterprising
  { id: 13, text: 'Tôi thích thuyết phục người khác làm theo ý mình.', category: 'E' },
  { id: 14, text: 'Tôi thích lãnh đạo một nhóm hoặc tổ chức.', category: 'E' },
  { id: 15, text: 'Tôi thích kinh doanh hoặc bán hàng.', category: 'E' },
  // Conventional
  { id: 16, text: 'Tôi thích sắp xếp hồ sơ, dữ liệu ngăn nắp.', category: 'C' },
  { id: 17, text: 'Tôi thích làm việc với các con số và bảng tính.', category: 'C' },
  { id: 18, text: 'Tôi thích tuân theo các quy trình rõ ràng.', category: 'C' },
];

export const SUBJECT_GROUPS = {
  A00: ['Toán', 'Vật lí', 'Hóa học'],
  A01: ['Toán', 'Vật lí', 'Tiếng Anh'],
  B00: ['Toán', 'Hóa học', 'Sinh học'],
  C00: ['Ngữ văn', 'Lịch sử', 'Địa lí'],
  D01: ['Toán', 'Ngữ văn', 'Tiếng Anh'],
};

export const PROVINCES = [
  "Toàn quốc", "Miền Bắc", "Miền Trung", "Miền Nam",
  "Hà Nội", "TP Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
  "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
  "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
  "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
  "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
  "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
  "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
  "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
  "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
  "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
  "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
  "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
];
