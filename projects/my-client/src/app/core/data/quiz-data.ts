import { QuizQuestion, StyleResult } from '../models/quiz.model';

export const STYLE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: 'Khi bước vào một căn phòng, điều đầu tiên bạn muốn cảm nhận là gì?',
    options: [
      { id: 'a', label: 'Sự gọn gàng, tối giản, không dư thừa chi tiết', tag: 'minimalist' },
      { id: 'b', label: 'Ánh sáng tự nhiên ấm áp, gỗ sáng màu và cảm giác dễ chịu', tag: 'scandinavian' },
      { id: 'c', label: 'Chất liệu thô mộc, kim loại và cá tính mạnh mẽ', tag: 'industrial' },
      { id: 'd', label: 'Màu sắc rực rỡ, hoạ tiết đa dạng và nhiều lớp trang trí', tag: 'bohemian' },
    ],
  },
  {
    id: 2,
    text: 'Bạn thích bảng màu nào nhất cho không gian sống của mình?',
    options: [
      { id: 'a', label: 'Đen - trắng - xám, đơn sắc thanh lịch', tag: 'minimalist' },
      { id: 'b', label: 'Trắng kem, be nhạt, gỗ thông sáng', tag: 'scandinavian' },
      { id: 'c', label: 'Nâu gỉ sét, đen than, xám bê tông', tag: 'industrial' },
      { id: 'd', label: 'Cam đất, xanh ngọc, vàng nghệ, họa tiết thổ cẩm', tag: 'bohemian' },
    ],
  },
  {
    id: 3,
    text: 'Món đồ decor nào khiến bạn "phải lòng" ngay khi nhìn thấy?',
    options: [
      { id: 'a', label: 'Một chiếc bình hình học đơn sắc, đường nét sắc sảo', tag: 'minimalist' },
      { id: 'b', label: 'Đèn bàn gỗ tự nhiên với ánh sáng vàng dịu', tag: 'scandinavian' },
      { id: 'c', label: 'Giá đỡ sách dáng ống kim loại kiểu xưởng máy', tag: 'industrial' },
      { id: 'd', label: 'Chậu cây in hoạ tiết thủ công nhiều màu', tag: 'bohemian' },
    ],
  },
  {
    id: 4,
    text: 'Bạn muốn khách đến nhà cảm nhận điều gì về gu thẩm mỹ của mình?',
    options: [
      { id: 'a', label: '"Ít nhưng chất" — mọi thứ đều có chủ đích', tag: 'minimalist' },
      { id: 'b', label: '"Ấm áp, dễ chịu" — như một buổi chiều Bắc Âu', tag: 'scandinavian' },
      { id: 'c', label: '"Cá tính, phóng khoáng" — như một studio nghệ thuật', tag: 'industrial' },
      { id: 'd', label: '"Tự do, đầy màu sắc" — như một chuyến du mục', tag: 'bohemian' },
    ],
  },
  {
    id: 5,
    text: 'Nếu được tuỳ biến màu cho một sản phẩm in 3D, bạn sẽ chọn gì?',
    options: [
      { id: 'a', label: 'Trắng mờ hoặc đen tuyền, bề mặt nhẵn mịn', tag: 'minimalist' },
      { id: 'b', label: 'Be, kem hoặc pastel nhẹ nhàng', tag: 'scandinavian' },
      { id: 'c', label: 'Xám xi măng hoặc nâu terracotta thô', tag: 'industrial' },
      { id: 'd', label: 'Nhiều màu phối cùng lúc, càng nổi bật càng thích', tag: 'bohemian' },
    ],
  },
];

export const STYLE_QUIZ_RESULTS: StyleResult[] = [
  {
    tag: 'minimalist',
    title: 'Phong Cách Tối Giản (Minimalist)',
    description:
      'Bạn yêu sự tinh gọn, đường nét sạch sẽ và không gian "thở". Với bạn, mỗi món đồ decor đều cần có lý do để tồn tại — không dư thừa, không phô trương.',
    image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['vase', 'sculpture', 'clock'],
    paletteHex: ['#111111', '#F5F5F0', '#B0B0B0'],
  },
  {
    tag: 'scandinavian',
    title: 'Phong Cách Bắc Âu (Scandinavian)',
    description:
      'Bạn thích sự ấm áp, gần gũi và ánh sáng tự nhiên. Gỗ sáng màu, tông be/kem và các món đồ có chức năng rõ ràng chính là "gu" của bạn.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['lamp', 'bookshelf', 'organizer'],
    paletteHex: ['#F2CC8F', '#FDFBF7', '#81B29A'],
  },
  {
    tag: 'industrial',
    title: 'Phong Cách Công Nghiệp (Industrial)',
    description:
      'Bạn bị thu hút bởi chất liệu thô, kim loại và cá tính mạnh. Không gian của bạn cần điểm nhấn táo bạo, phá cách thay vì an toàn, êm dịu.',
    image: 'https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['side_table', 'bookend', 'tray'],
    paletteHex: ['#4A4E69', '#2B2B2B', '#8D8D8D'],
  },
  {
    tag: 'bohemian',
    title: 'Phong Cách Bohemian',
    description:
      'Bạn là người tự do, thích pha trộn màu sắc và hoạ tiết để kể câu chuyện riêng của mình. Không gian sống với bạn càng nhiều cá tính càng cuốn hút.',
    image: 'https://images.unsplash.com/photo-1522444195799-478538b28823?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['plant_pot', 'frame', 'candle_holder'],
    paletteHex: ['#E07A5F', '#F2CC8F', '#3D5A80'],
  },
];
