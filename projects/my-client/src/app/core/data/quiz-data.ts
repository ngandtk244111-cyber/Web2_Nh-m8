import { QuizQuestion, StyleResult } from '../models/quiz.model';

// Bản dự phòng khi chưa tải được bộ câu hỏi từ server (/api/style-quiz) — trùng server/seed/default-style-quiz.js.
export const STYLE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: 'Khi bước vào một căn phòng, điều đầu tiên bạn muốn cảm nhận là gì?',
    options: [
      { id: 'a', label: 'Sự gọn gàng, thoáng đãng, không một chi tiết thừa', tag: 'minimalist' },
      { id: 'b', label: 'Màu sắc, hoạ tiết và nhiều câu chuyện để ngắm', tag: 'bohemian' },
      { id: 'c', label: 'Ánh sáng tự nhiên ấm áp và mùi gỗ dễ chịu', tag: 'scandinavian' },
      { id: 'd', label: 'Chất liệu thô mộc, kim loại và cá tính mạnh', tag: 'industrial' },
    ],
  },
  {
    id: 2,
    text: 'Bảng màu nào bạn muốn thấy mỗi ngày ở nhà?',
    options: [
      { id: 'a', label: 'Trắng kem, be nhạt, gỗ sồi sáng', tag: 'scandinavian' },
      { id: 'b', label: 'Đen than, xám bê tông, nâu gỉ sét', tag: 'industrial' },
      { id: 'c', label: 'Trắng – đen – xám, đơn sắc thanh lịch', tag: 'minimalist' },
      { id: 'd', label: 'Cam đất, xanh ngọc, vàng nghệ', tag: 'bohemian' },
    ],
  },
  {
    id: 3,
    text: 'Một buổi sáng cuối tuần lý tưởng của bạn trông như thế nào?',
    options: [
      { id: 'a', label: 'Đi chợ phiên đồ cũ, mang về vài món lạ mắt', tag: 'bohemian' },
      { id: 'b', label: 'Pha cà phê bên cửa sổ, nắng rọi lên bàn gỗ', tag: 'scandinavian' },
      { id: 'c', label: 'Ngồi đọc sách trong phòng trống trải, thật yên tĩnh', tag: 'minimalist' },
      { id: 'd', label: 'Ghé một quán cà phê kiểu nhà xưởng, tường gạch trần', tag: 'industrial' },
    ],
  },
  {
    id: 4,
    text: 'Chọn một chất liệu bạn thích chạm vào nhất:',
    options: [
      { id: 'a', label: 'Kim loại sơn đen, sắt rèn', tag: 'industrial' },
      { id: 'b', label: 'Mây tre đan, len dệt tay', tag: 'bohemian' },
      { id: 'c', label: 'Gỗ sáng màu, bề mặt mộc', tag: 'scandinavian' },
      { id: 'd', label: 'Đá, gốm men mờ, bề mặt nhẵn lì', tag: 'minimalist' },
    ],
  },
  {
    id: 5,
    text: 'Chiếc sofa trong mơ của bạn là:',
    options: [
      { id: 'a', label: 'Sofa vải nỉ xám nhạt, chân gỗ, kèm chăn len', tag: 'scandinavian' },
      { id: 'b', label: 'Sofa thấp, đường thẳng, một màu trơn', tag: 'minimalist' },
      { id: 'c', label: 'Sofa da nâu bò sáp, khung kim loại', tag: 'industrial' },
      { id: 'd', label: 'Sofa nhung màu nổi, phủ đầy gối hoạ tiết', tag: 'bohemian' },
    ],
  },
  {
    id: 6,
    text: 'Bạn muốn chiếu sáng phòng khách bằng gì?',
    options: [
      { id: 'a', label: 'Đèn thả bóng tròn, ánh vàng dịu', tag: 'scandinavian' },
      { id: 'b', label: 'Đèn ẩn trần, ánh sáng đều, không thấy bóng đèn', tag: 'minimalist' },
      { id: 'c', label: 'Chụp đèn mây đan và dây đèn đom đóm', tag: 'bohemian' },
      { id: 'd', label: 'Bóng Edison dây tóc treo trên ống kim loại', tag: 'industrial' },
    ],
  },
  {
    id: 7,
    text: 'Cây xanh trong nhà bạn sẽ là:',
    options: [
      { id: 'a', label: 'Thật nhiều chậu, cây leo rủ khắp kệ', tag: 'bohemian' },
      { id: 'b', label: 'Một chậu duy nhất, dáng đẹp, đặt đúng chỗ', tag: 'minimalist' },
      { id: 'c', label: 'Xương rồng, sen đá trong chậu xi măng', tag: 'industrial' },
      { id: 'd', label: 'Vài chậu lá xanh nhạt trong giỏ cói', tag: 'scandinavian' },
    ],
  },
  {
    id: 8,
    text: 'Bức tường phòng khách của bạn nên:',
    options: [
      { id: 'a', label: 'Gạch trần hoặc bê tông mài, giữ nguyên vẻ thô', tag: 'industrial' },
      { id: 'b', label: 'Phủ kín tranh, thảm treo và đồ thủ công', tag: 'bohemian' },
      { id: 'c', label: 'Trống trơn, hoặc chỉ một bức tranh lớn', tag: 'minimalist' },
      { id: 'd', label: 'Sơn trắng, treo vài khung ảnh gỗ mảnh', tag: 'scandinavian' },
    ],
  },
  {
    id: 9,
    text: 'Khi đi du lịch, bạn hay mang về món quà lưu niệm nào?',
    options: [
      { id: 'a', label: 'Không mua gì — chỉ giữ lại ảnh và trải nghiệm', tag: 'minimalist' },
      { id: 'b', label: 'Một chiếc cốc gốm thủ công để dùng hằng ngày', tag: 'scandinavian' },
      { id: 'c', label: 'Khăn, thảm, đồ dệt hoạ tiết đặc trưng nơi đó', tag: 'bohemian' },
      { id: 'd', label: 'Một món đồ cổ bằng kim loại, biển hiệu cũ', tag: 'industrial' },
    ],
  },
  {
    id: 10,
    text: 'Góc làm việc tại nhà của bạn sẽ có:',
    options: [
      { id: 'a', label: 'Bàn gỗ sồi, đèn bàn, một chậu cây nhỏ', tag: 'scandinavian' },
      { id: 'b', label: 'Bàn khung sắt mặt gỗ thô, kệ ống nước', tag: 'industrial' },
      { id: 'c', label: 'Bàn trắng trơn, dây điện giấu kín, chỉ có laptop', tag: 'minimalist' },
      { id: 'd', label: 'Bàn cũ sơn lại, ghế mây, đầy sổ tay và ảnh dán', tag: 'bohemian' },
    ],
  },
  {
    id: 11,
    text: 'Phòng ngủ của bạn dùng bộ chăn ga như thế nào?',
    options: [
      { id: 'a', label: 'Nhiều lớp, nhiều màu, gối tua rua', tag: 'bohemian' },
      { id: 'b', label: 'Linen màu yến mạch, kèm chăn len dày', tag: 'scandinavian' },
      { id: 'c', label: 'Cotton trắng tinh, phẳng phiu', tag: 'minimalist' },
      { id: 'd', label: 'Xám đậm hoặc xanh than, đầu giường da', tag: 'industrial' },
    ],
  },
  {
    id: 12,
    text: 'Bạn chọn đồng hồ treo tường nào?',
    options: [
      { id: 'a', label: 'Mặt số lớn kiểu nhà ga, khung kim loại', tag: 'industrial' },
      { id: 'b', label: 'Không số, chỉ có hai kim mảnh', tag: 'minimalist' },
      { id: 'c', label: 'Khung mây hoặc gỗ chạm hoa văn', tag: 'bohemian' },
      { id: 'd', label: 'Mặt gỗ tròn, kim đen, số in nhỏ', tag: 'scandinavian' },
    ],
  },
  {
    id: 13,
    text: 'Mùi hương bạn muốn ngửi thấy khi về nhà:',
    options: [
      { id: 'a', label: 'Gỗ tuyết tùng và bánh quế mới nướng', tag: 'scandinavian' },
      { id: 'b', label: 'Trầm hương, hoa nhài, tinh dầu phương Đông', tag: 'bohemian' },
      { id: 'c', label: 'Không mùi gì — chỉ cần không khí sạch', tag: 'minimalist' },
      { id: 'd', label: 'Da thuộc, cà phê rang và khói gỗ', tag: 'industrial' },
    ],
  },
  {
    id: 14,
    text: 'Nếu tuỳ biến màu cho một sản phẩm in 3D, bạn sẽ chọn:',
    options: [
      { id: 'a', label: 'Nhiều màu phối cùng lúc, càng nổi càng thích', tag: 'bohemian' },
      { id: 'b', label: 'Xám xi măng hoặc nâu terracotta', tag: 'industrial' },
      { id: 'c', label: 'Be, kem hoặc pastel nhẹ', tag: 'scandinavian' },
      { id: 'd', label: 'Trắng mờ hoặc đen tuyền, bề mặt nhẵn', tag: 'minimalist' },
    ],
  },
  {
    id: 15,
    text: 'Bạn muốn khách đến chơi nói gì về nhà mình?',
    options: [
      { id: 'a', label: '"Ở đây dễ chịu quá, chẳng muốn về"', tag: 'scandinavian' },
      { id: 'b', label: '"Ngầu thật, giống studio nghệ thuật"', tag: 'industrial' },
      { id: 'c', label: '"Món nào cũng có câu chuyện, xem mãi không chán"', tag: 'bohemian' },
      { id: 'd', label: '"Gọn gàng thật, cái gì cũng đúng chỗ"', tag: 'minimalist' },
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
    traits: ['Đường nét thẳng, bề mặt trơn, gần như không hoa văn', 'Tông trung tính: trắng, xám, đen, be', 'Ít đồ nhưng món nào cũng có công năng rõ ràng', 'Đồ lưu trữ kín để mặt bàn, mặt kệ luôn trống'],
    tips: ['Giữ quy tắc 80/20: 80% màu trung tính, 20% một màu nhấn duy nhất', 'Chọn sofa, bàn chân thấp để phòng trông rộng và thoáng', 'Mỗi mặt phẳng chỉ đặt 1–3 món decor, chừa khoảng trống để không gian "thở"', 'Dùng đèn ánh trắng ấm 3000–4000K và giấu gọn dây điện'],
    avoid: ['Gối, thảm nhiều hoạ tiết sặc sỡ', 'Kệ mở bày quá nhiều đồ lưu niệm', 'Nội thất chạm trổ cầu kỳ'],
    productStyles: ['Minimalist', 'Modern', 'Japanese'],
    comboCategories: ['sofa', 'side_table', 'pendant_lamp', 'vase', 'clock'],
  },
  {
    tag: 'scandinavian',
    title: 'Phong Cách Bắc Âu (Scandinavian)',
    description:
      'Bạn thích sự ấm áp, gần gũi và ánh sáng tự nhiên. Gỗ sáng màu, tông be/kem và các món đồ có chức năng rõ ràng chính là "gu" của bạn.',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['lamp', 'bookshelf', 'organizer'],
    paletteHex: ['#F2CC8F', '#FDFBF7', '#81B29A'],
    traits: ['Gỗ sáng màu: sồi, tần bì, thông', 'Vải tự nhiên: linen, len, cotton', 'Nhiều ánh sáng tự nhiên, rèm mỏng nhẹ', 'Cây xanh và đồ thủ công mộc mạc'],
    tips: ['Nền tường trắng/kem, thêm điểm xanh lá từ cây hoặc gối tựa', 'Chồng lớp chăn len, thảm lông để có cảm giác "hygge" ấm áp', 'Kết hợp nhiều nguồn sáng: đèn thả, đèn bàn, nến', 'Ưu tiên đồ chân gỗ thanh mảnh, bo góc mềm'],
    avoid: ['Kim loại bóng loáng, kính màu', 'Sơn tối kín cả mảng tường lớn', 'Nội thất quá to, nặng nề'],
    productStyles: ['Scandinavian', 'Japanese', 'Minimalist'],
    comboCategories: ['sofa', 'table', 'desk_lamp', 'plant_pot', 'bookshelf'],
  },
  {
    tag: 'industrial',
    title: 'Phong Cách Công Nghiệp (Industrial)',
    description:
      'Bạn bị thu hút bởi chất liệu thô, kim loại và cá tính mạnh. Không gian của bạn cần điểm nhấn táo bạo, phá cách thay vì an toàn, êm dịu.',
    image: 'https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['side_table', 'bookend', 'tray'],
    paletteHex: ['#4A4E69', '#2B2B2B', '#8D8D8D'],
    traits: ['Kim loại sơn đen, sắt, thép', 'Gỗ thô, gạch trần, bê tông', 'Đèn bóng dây tóc Edison', 'Da thuộc nâu bò, tông màu trầm'],
    tips: ['Phối gỗ thô với khung kim loại đen cho cảm giác nhà xưởng', 'Dùng đèn thả bóng dây tóc ánh vàng để cân lại vẻ lạnh của kim loại', 'Thêm một mảng cây xanh để không gian bớt cứng', 'Kệ mở khung sắt vừa để đồ vừa làm điểm nhấn'],
    avoid: ['Màu pastel ngọt ngào', 'Nhựa bóng, đồ bóng loáng', 'Rèm ren, hoạ tiết hoa nhỏ'],
    productStyles: ['Vintage', 'Retro', 'Modern'],
    comboCategories: ['sofa', 'side_table', 'pendant_lamp', 'bookshelf', 'bookend'],
  },
  {
    tag: 'bohemian',
    title: 'Phong Cách Bohemian',
    description:
      'Bạn là người tự do, thích pha trộn màu sắc và hoạ tiết để kể câu chuyện riêng của mình. Không gian sống với bạn càng nhiều cá tính càng cuốn hút.',
    image: 'https://images.unsplash.com/photo-1522444195799-478538b28823?auto=format&fit=crop&w=900&q=80',
    suggestedCategories: ['plant_pot', 'frame', 'candle_holder'],
    paletteHex: ['#E07A5F', '#F2CC8F', '#3D5A80'],
    traits: ['Màu ấm và rực: cam đất, xanh ngọc, vàng nghệ', 'Hoạ tiết dệt, thổ cẩm, tua rua', 'Mây tre đan, gỗ, gốm thủ công', 'Thật nhiều cây xanh và đồ sưu tầm'],
    tips: ['Phối 3–4 hoạ tiết cùng tông màu để "lộn xộn có chủ đích"', 'Trang trí tường bằng khung ảnh, thảm treo, đĩa gốm', 'Dùng ghế thấp, gối sàn để góc ngồi thật thoải mái', 'Đặt cây ở nhiều độ cao: cây sàn, chậu trên kệ, cây treo'],
    avoid: ['Không gian trống trơn, đơn sắc', 'Nội thất kim loại lạnh, góc cạnh', 'Bộ đồ đồng bộ y hệt nhau'],
    productStyles: ['Vintage', 'Cute/Kawaii', 'Retro'],
    comboCategories: ['chair', 'plant_pot', 'frame', 'candle_holder', 'night_lamp'],
  },
];
