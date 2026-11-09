// Bộ trắc nghiệm phong cách mặc định — nạp vào MongoDB lần đầu (khi collection còn rỗng), sau đó
// nhân viên sửa ở my-admin (trang Trắc nghiệm phong cách). Trùng với bản dự phòng
// my-client/core/data/quiz-data.ts. Mỗi lựa chọn cộng 1 điểm cho 1 trong 4 phong cách (tag);
// thứ tự lựa chọn được xáo để khách không đoán được quy luật.
const q = (text, options) => ({ text, options: options.map(([label, tag], i) => ({ id: 'abcdef'[i], label, tag })) });

const QUESTIONS = [
  q('Khi bước vào một căn phòng, điều đầu tiên bạn muốn cảm nhận là gì?', [
    ['Sự gọn gàng, thoáng đãng, không một chi tiết thừa', 'minimalist'],
    ['Màu sắc, hoạ tiết và nhiều câu chuyện để ngắm', 'bohemian'],
    ['Ánh sáng tự nhiên ấm áp và mùi gỗ dễ chịu', 'scandinavian'],
    ['Chất liệu thô mộc, kim loại và cá tính mạnh', 'industrial'],
  ]),
  q('Bảng màu nào bạn muốn thấy mỗi ngày ở nhà?', [
    ['Trắng kem, be nhạt, gỗ sồi sáng', 'scandinavian'],
    ['Đen than, xám bê tông, nâu gỉ sét', 'industrial'],
    ['Trắng – đen – xám, đơn sắc thanh lịch', 'minimalist'],
    ['Cam đất, xanh ngọc, vàng nghệ', 'bohemian'],
  ]),
  q('Một buổi sáng cuối tuần lý tưởng của bạn trông như thế nào?', [
    ['Đi chợ phiên đồ cũ, mang về vài món lạ mắt', 'bohemian'],
    ['Pha cà phê bên cửa sổ, nắng rọi lên bàn gỗ', 'scandinavian'],
    ['Ngồi đọc sách trong phòng trống trải, thật yên tĩnh', 'minimalist'],
    ['Ghé một quán cà phê kiểu nhà xưởng, tường gạch trần', 'industrial'],
  ]),
  q('Chọn một chất liệu bạn thích chạm vào nhất:', [
    ['Kim loại sơn đen, sắt rèn', 'industrial'],
    ['Mây tre đan, len dệt tay', 'bohemian'],
    ['Gỗ sáng màu, bề mặt mộc', 'scandinavian'],
    ['Đá, gốm men mờ, bề mặt nhẵn lì', 'minimalist'],
  ]),
  q('Chiếc sofa trong mơ của bạn là:', [
    ['Sofa vải nỉ xám nhạt, chân gỗ, kèm chăn len', 'scandinavian'],
    ['Sofa thấp, đường thẳng, một màu trơn', 'minimalist'],
    ['Sofa da nâu bò sáp, khung kim loại', 'industrial'],
    ['Sofa nhung màu nổi, phủ đầy gối hoạ tiết', 'bohemian'],
  ]),
  q('Bạn muốn chiếu sáng phòng khách bằng gì?', [
    ['Đèn thả bóng tròn, ánh vàng dịu', 'scandinavian'],
    ['Đèn ẩn trần, ánh sáng đều, không thấy bóng đèn', 'minimalist'],
    ['Chụp đèn mây đan và dây đèn đom đóm', 'bohemian'],
    ['Bóng Edison dây tóc treo trên ống kim loại', 'industrial'],
  ]),
  q('Cây xanh trong nhà bạn sẽ là:', [
    ['Thật nhiều chậu, cây leo rủ khắp kệ', 'bohemian'],
    ['Một chậu duy nhất, dáng đẹp, đặt đúng chỗ', 'minimalist'],
    ['Xương rồng, sen đá trong chậu xi măng', 'industrial'],
    ['Vài chậu lá xanh nhạt trong giỏ cói', 'scandinavian'],
  ]),
  q('Bức tường phòng khách của bạn nên:', [
    ['Gạch trần hoặc bê tông mài, giữ nguyên vẻ thô', 'industrial'],
    ['Phủ kín tranh, thảm treo và đồ thủ công', 'bohemian'],
    ['Trống trơn, hoặc chỉ một bức tranh lớn', 'minimalist'],
    ['Sơn trắng, treo vài khung ảnh gỗ mảnh', 'scandinavian'],
  ]),
  q('Khi đi du lịch, bạn hay mang về món quà lưu niệm nào?', [
    ['Không mua gì — chỉ giữ lại ảnh và trải nghiệm', 'minimalist'],
    ['Một chiếc cốc gốm thủ công để dùng hằng ngày', 'scandinavian'],
    ['Khăn, thảm, đồ dệt hoạ tiết đặc trưng nơi đó', 'bohemian'],
    ['Một món đồ cổ bằng kim loại, biển hiệu cũ', 'industrial'],
  ]),
  q('Góc làm việc tại nhà của bạn sẽ có:', [
    ['Bàn gỗ sồi, đèn bàn, một chậu cây nhỏ', 'scandinavian'],
    ['Bàn khung sắt mặt gỗ thô, kệ ống nước', 'industrial'],
    ['Bàn trắng trơn, dây điện giấu kín, chỉ có laptop', 'minimalist'],
    ['Bàn cũ sơn lại, ghế mây, đầy sổ tay và ảnh dán', 'bohemian'],
  ]),
  q('Phòng ngủ của bạn dùng bộ chăn ga như thế nào?', [
    ['Nhiều lớp, nhiều màu, gối tua rua', 'bohemian'],
    ['Linen màu yến mạch, kèm chăn len dày', 'scandinavian'],
    ['Cotton trắng tinh, phẳng phiu', 'minimalist'],
    ['Xám đậm hoặc xanh than, đầu giường da', 'industrial'],
  ]),
  q('Bạn chọn đồng hồ treo tường nào?', [
    ['Mặt số lớn kiểu nhà ga, khung kim loại', 'industrial'],
    ['Không số, chỉ có hai kim mảnh', 'minimalist'],
    ['Khung mây hoặc gỗ chạm hoa văn', 'bohemian'],
    ['Mặt gỗ tròn, kim đen, số in nhỏ', 'scandinavian'],
  ]),
  q('Mùi hương bạn muốn ngửi thấy khi về nhà:', [
    ['Gỗ tuyết tùng và bánh quế mới nướng', 'scandinavian'],
    ['Trầm hương, hoa nhài, tinh dầu phương Đông', 'bohemian'],
    ['Không mùi gì — chỉ cần không khí sạch', 'minimalist'],
    ['Da thuộc, cà phê rang và khói gỗ', 'industrial'],
  ]),
  q('Nếu tuỳ biến màu cho một sản phẩm in 3D, bạn sẽ chọn:', [
    ['Nhiều màu phối cùng lúc, càng nổi càng thích', 'bohemian'],
    ['Xám xi măng hoặc nâu terracotta', 'industrial'],
    ['Be, kem hoặc pastel nhẹ', 'scandinavian'],
    ['Trắng mờ hoặc đen tuyền, bề mặt nhẵn', 'minimalist'],
  ]),
  q('Bạn muốn khách đến chơi nói gì về nhà mình?', [
    ['"Ở đây dễ chịu quá, chẳng muốn về"', 'scandinavian'],
    ['"Ngầu thật, giống studio nghệ thuật"', 'industrial'],
    ['"Món nào cũng có câu chuyện, xem mãi không chán"', 'bohemian'],
    ['"Gọn gàng thật, cái gì cũng đúng chỗ"', 'minimalist'],
  ]),
].map((question, i) => ({ id: i + 1, order: i + 1, active: true, ...question }));

const RESULTS = [
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

module.exports = { QUESTIONS, RESULTS };
