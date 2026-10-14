// Nội dung mở rộng cho trang chi tiết sản phẩm: mô tả nhiều đoạn, câu chuyện, điểm nổi bật, ảnh không
// gian thực tế và đánh giá khách hàng. Các đoạn cách nhau bằng "\n\n" (FE hiển thị white-space: pre-line).
//
// enrichProduct() GỘP vào sản phẩm sẵn có — không xoá gì: mô tả/câu chuyện chỉ thay khi bản mới dài
// hơn, features/images/reviews nối thêm phần chưa có (theo nội dung / id).
const { img } = require('./helpers');

// Ảnh không gian trung tính (đã dùng trong repo) — làm ảnh "đặt trong phòng" cho gallery & đánh giá.
const SPACE = {
  living: ['photo-1586023492125-27b2c045efd7', 'photo-1616594039964-ae9021a400a0', 'photo-1493663284031-b7e3aefcae8e'],
  cozy: ['photo-1502672260266-1c1ef2d93688', 'photo-1513519245088-0e12902e5a38', 'photo-1505873242700-f289a29e1e0f'],
  desk: ['photo-1518455027359-f3f8164ba6bd', 'photo-1522444195799-478538b28823', 'photo-1502672260266-1c1ef2d93688'],
};
const AVATARS = [
  'photo-1534528741775-53994a69daeb', 'photo-1507003211169-0a1dd7228f2d', 'photo-1494790108377-be9c29b29330',
  'photo-1500648767791-00dcc994a43e', 'photo-1544005313-94ddf0286df2', 'photo-1535713875002-d1d0cf377fde',
].map(id => img(id, 150));

const REVIEWERS = [
  'Thanh Hương', 'Quốc Việt', 'Mỹ Linh', 'Hoàng Phúc', 'Bảo Ngọc', 'Minh Khôi', 'Diệu Anh', 'Trung Hiếu',
  'Phương Thảo', 'Gia Huy', 'Ngọc Trâm', 'Đức Thịnh', 'Hải Yến', 'Tấn Phát', 'Kim Ngân', 'Anh Thư',
  'Văn Toàn', 'Lan Phương', 'Nhật Minh', 'Thùy Dung',
];

// Đánh giá dùng chung theo nhóm sản phẩm: [số sao, nội dung, có ảnh?, phản hồi của shop?]
const REVIEW_POOL = {
  light: [
    [5, 'Ánh sáng vàng ấm rất dịu, bật cả đêm cũng không chói mắt. Phòng ngủ nhìn ấm cúng hẳn.', true],
    [5, 'Đóng gói cực kỹ, hộp có xốp định hình nên đèn về nguyên vẹn. Cắm điện là dùng luôn.'],
    [4, 'Đèn đẹp, ánh sáng ổn. Trừ 1 sao vì dây nguồn hơi ngắn so với vị trí ổ cắm nhà mình.', false, 'Cảm ơn bạn! Shop có bán kèm dây nối 2m cùng tông màu, bạn nhắn shop để được hỗ trợ nhé.'],
    [5, 'Mua tặng em gái, em thích lắm. Chụp ảnh lên rất "ảo", đăng story ai cũng hỏi link.', true],
    [5, 'Mình làm việc khuya nên cần đèn không hắt xanh, cái này đúng ý. Mắt đỡ mỏi hơn hẳn.'],
    [3, 'Sản phẩm ổn nhưng giao chậm hơn dự kiến 2 ngày.', false, 'Luméa xin lỗi vì sự chậm trễ do đơn vị vận chuyển. Shop đã gửi tặng bạn mã giảm giá cho lần mua sau ạ.'],
    [5, 'Hoàn thiện tốt, không có mùi nhựa hay mùi sơn. Đáng tiền.'],
    [4, 'Đẹp và chắc chắn. Mong shop có thêm tuỳ chọn điều khiển từ xa.', true],
  ],
  vase: [
    [5, 'Bình đẹp hơn ảnh, màu men rất sang. Cắm vài cành hoa khô thôi là góc kệ có điểm nhấn liền.', true],
    [5, 'Đã thử cắm hoa tươi 1 tuần, không thấm nước, đáy không đọng ẩm.'],
    [4, 'Dáng bình xinh, nhưng miệng bình hơi nhỏ nên cắm được ít cành.', false, 'Cảm ơn góp ý của bạn! Với miệng bình này shop gợi ý cắm 3–5 cành mảnh để giữ dáng thanh thoát nhất ạ.'],
    [5, 'Mua 2 chiếc đặt hai đầu kệ TV, nhìn rất cân đối và hiện đại.', true],
    [5, 'Đóng gói 3 lớp, giao Hà Nội không sứt mẻ gì. Shop tư vấn nhiệt tình.'],
    [5, 'Đặt cạnh sofa be, phối với cỏ lau nhìn chuẩn tạp chí nội thất luôn.', true],
    [3, 'Màu thực tế đậm hơn ảnh một chút, nhưng vẫn đẹp.', false, 'Do ánh sáng màn hình và men thủ công nên màu có thể chênh nhẹ, bạn có thể đổi màu trong 7 ngày nếu chưa ưng ạ.'],
    [5, 'Lần thứ 2 mua ở Luméa, chất lượng vẫn ổn định như lần đầu.'],
  ],
  print3d: [
    [5, 'Bề mặt in mịn, gần như không thấy vân lớp. Cầm lên thấy chắc tay, không ọp ẹp.', true],
    [5, 'Shop gửi ảnh từng bước sản xuất qua trang theo dõi đơn, cảm giác được làm riêng cho mình.'],
    [4, 'Chi tiết sắc nét. Thời gian sản xuất 3 ngày đúng như cam kết, chỉ giao hơi lâu.', true],
    [5, 'Màu PLA lên đúng như bảng màu trên web, không bị lệch tông.'],
    [5, 'Đặt trên kệ sách cạnh mấy cuốn artbook, bạn bè tới chơi đều tưởng là đồ nhập.', true],
    [3, 'Có một vết support nhỏ ở mặt dưới, không ảnh hưởng nhiều.', false, 'Cảm ơn bạn đã phản hồi! Kỹ thuật viên đã bổ sung bước kiểm tra mặt đáy cho các đơn tiếp theo. Bạn gửi ảnh để shop xử lý lại miễn phí nhé.'],
    [5, 'Nhựa sinh học nên yên tâm để trong phòng bé. Rất ưng.'],
    [5, 'Tuỳ biến màu xong xem trước 3D trên web rồi mới đặt, nhận hàng đúng y như preview.'],
  ],
  plant: [
    [5, 'Cây về tươi, đất khô ráo, chậu không mẻ. Để bàn làm việc nhìn xanh mát hẳn.', true],
    [5, 'Mình hay quên tưới nhưng cây vẫn khoẻ sau 1 tháng. Hợp với người bận rộn.'],
    [4, 'Chậu xinh, cây hơi nhỏ hơn mình tưởng nhưng vẫn ổn.', false, 'Cây được chọn theo kích thước chậu để phát triển tốt nhất. Sau 1–2 tháng cây sẽ đầy chậu hơn bạn nhé!'],
    [5, 'Có kèm thẻ hướng dẫn chăm sóc rất dễ hiểu, cảm ơn shop.', true],
    [5, 'Mua làm quà khai trương cho bạn, gói quà đẹp, có thiệp viết tay.'],
    [5, 'Đĩa lót kín, tưới xong không chảy nước ra bàn gỗ.'],
    [3, 'Một chiếc lá bị dập nhẹ khi vận chuyển, cây vẫn sống tốt.', false, 'Luméa xin lỗi bạn! Shop đã thêm khung giấy cố định cây khi đóng gói để hạn chế va đập ạ.'],
    [5, 'Đặt ở bậu cửa sổ phòng ngủ, sáng nào nhìn cũng thấy vui.', true],
  ],
  desk: [
    [5, 'Bàn làm việc gọn gàng hẳn, mọi thứ đều có chỗ của nó. Đáng từng đồng.', true],
    [5, 'Hoàn thiện kỹ, cạnh bo mịn không xước tay. Nhìn rất "premium".'],
    [4, 'Đẹp, tiện. Mình mong có thêm phiên bản màu tối để hợp setup đen.', false, 'Cảm ơn bạn! Phiên bản màu than chì đang được phát triển, dự kiến ra mắt trong tháng tới ạ.'],
    [5, 'Đặt cạnh laptop và đèn bàn, chụp góc setup lên rất có gu.', true],
    [5, 'Giao nhanh, đóng gói kỹ, có cả thiệp cảm ơn viết tay.'],
    [5, 'Mua 2 bộ cho mình và đồng nghiệp, ai cũng khen.'],
    [3, 'Sản phẩm ổn nhưng hơi nặng hơn mình nghĩ.', false, 'Khối lượng được tính để đế đứng vững, không bị đổ khi va chạm nhẹ. Cảm ơn bạn đã chia sẻ ạ!'],
    [5, 'Chất liệu thật, cầm lên là biết không phải hàng chợ.', true],
  ],
  wall: [
    [5, 'Treo lên mảng tường trống ở phòng khách, nhìn có chiều sâu hẳn.', true],
    [5, 'Kèm đủ vít nở và hướng dẫn, mình tự lắp trong 15 phút.'],
    [4, 'Đẹp, chắc. Trừ 1 sao vì nên kèm thêm thước thăng bằng mini.', false, 'Cảm ơn bạn! Shop sẽ bổ sung thước thăng bằng mini vào hộp từ lô hàng tới ạ.'],
    [5, 'Phối với vài chậu cây nhỏ và sách, góc này giờ là chỗ mình thích nhất nhà.', true],
    [5, 'Gỗ thật, vân đẹp, hoàn thiện mịn.'],
    [5, 'Mua lần 2 để treo phòng ngủ, vẫn chất lượng như lần đầu.'],
    [3, 'Giao hàng hơi chậm do khu mình ở xa.', false, 'Luméa xin lỗi vì thời gian giao lâu hơn mong đợi. Shop luôn ưu tiên an toàn kiện hàng khi giao tỉnh ạ.'],
    [5, 'Màu gỗ ấm, hợp với tường trắng và rèm be.', true],
  ],
  furniture: [
    [5, 'Gỗ thật, chắc tay, vân đẹp. Lắp ráp dễ, có video hướng dẫn quét QR.', true],
    [5, 'Kích thước vừa khít góc phòng nhỏ của mình. Rất đáng tiền.'],
    [4, 'Chất lượng tốt. Màu gỗ đậm hơn ảnh một chút nhưng vẫn đẹp.', false, 'Gỗ tự nhiên có sắc độ khác nhau theo từng lô và ánh sáng chụp. Cảm ơn bạn đã thông cảm ạ!'],
    [5, 'Đội giao hàng lịch sự, đặt đúng vị trí và dọn sạch bao bì.', true],
    [5, 'Dùng 3 tháng rồi vẫn chắc chắn như mới, không ọp ẹp.'],
    [3, 'Có một vết xước nhỏ ở chân, shop đã gửi bút sửa gỗ.', false, 'Cảm ơn bạn đã thông cảm! Nếu vết xước chưa xử lý được, Luméa sẽ đổi chân mới miễn phí cho bạn.'],
    [5, 'Phối cùng thảm và rèm tông be, phòng nhìn ấm áp hẳn.', true],
    [5, 'Mua tặng bố mẹ, ông bà rất thích vì chắc và dễ lau chùi.'],
  ],
  bigFurniture: [
    [5, 'Đội lắp đặt tới đúng giờ, làm việc gọn gàng, xong trong chưa tới 1 tiếng.', true],
    [5, 'Hoàn thiện chắc chắn, đường may và mối nối đều tỉ mỉ. Đúng chuẩn nội thất cao cấp.'],
    [4, 'Sản phẩm rất đẹp, chỉ là thời gian giao tỉnh mất 6 ngày.', false, 'Cảm ơn bạn đã kiên nhẫn! Hàng cồng kềnh liên tỉnh cần xe chuyên dụng nên thời gian giao lâu hơn, Luméa sẽ cải thiện ạ.'],
    [5, 'Ngoài đời đẹp hơn ảnh rất nhiều, màu sắc sang và ấm.', true],
    [5, 'Đã dùng 2 tháng, không có tiếng kêu hay xô lệch gì.'],
    [5, 'Tư vấn viên gửi ảnh thực tế và video trước khi giao, rất yên tâm.', true],
    [3, 'Kiện hàng to, thang máy chung cư hơi khó đưa lên.', false, 'Shop sẽ ghi chú để lần sau đội giao khảo sát lối vận chuyển trước. Cảm ơn bạn đã góp ý ạ!'],
    [5, 'Đáng đầu tư, cả nhà ai cũng thích.'],
  ],
};

// Nội dung riêng từng sản phẩm. reviews: [tác giả, sao, nội dung, có ảnh?] — đánh giá cụ thể về sản phẩm.
const CONTENT = {
  'mock-walnut-side-table': {
    kind: 'furniture', space: 'living',
    description: 'Làm từ gỗ óc chó Bắc Mỹ nguyên khối, bàn phụ Vincent nổi bật với dáng thanh mảnh và các đường cong mềm mại. Đủ gọn để kê cạnh sofa, đầu giường hay góc đọc sách, đủ chắc để dùng hằng ngày suốt nhiều năm.\n\nMặt bàn được bào và chà nhám qua 5 cấp giấy trước khi lau dầu gốc thực vật, nên khi chạm vào bạn cảm nhận rõ thớ gỗ mịn mà không bị bóng nhựa. Thanh giằng ẩn bên dưới giúp mặt bàn luôn phẳng, kể cả khi thời tiết nồm ẩm.\n\nBảo quản: lau bằng khăn ẩm vắt kỹ, tránh đặt trực tiếp ly nóng lên mặt gỗ. 6–12 tháng một lần, thoa một lớp dầu lau mỏng để gỗ giữ độ ấm và chống khô nứt.',
    story: 'Vân gỗ óc chó tự nhiên là điểm nhấn khiến ai ghé nhà cũng phải hỏi. Mỗi mặt bàn mang một đường vân, một mắt gỗ riêng — và càng dùng lâu, màu gỗ càng trầm ấm, đẹp hơn theo từng buổi cà phê sáng.\n\nBộ sưu tập Vincent được xưởng mộc của Luméa ở Bình Dương làm thủ công theo từng lô nhỏ. Người thợ chọn tấm gỗ có vân đẹp nhất cho mặt bàn, phần còn lại dùng cho chân và thanh giằng — không lãng phí một mẩu gỗ nào.\n\nChúng tôi đặt tên Vincent theo người thợ cả đầu tiên của xưởng, người tin rằng một món nội thất tốt là món có thể truyền lại cho thế hệ sau.',
    features: ['Mặt bàn chịu lực 25kg — đặt vừa đèn, chồng sách và chậu cây', 'Chà nhám 5 cấp, bề mặt mịn như lụa', 'Đế chân có đệm nỉ chống trầy sàn gỗ'],
    reviews: [['Hồng Nhung', 5, '03/10/2026', 'Mình mua bản 45cm kê cạnh giường, vừa đủ cho đèn ngủ, sách và ly nước. Gỗ thơm nhẹ, rất thích.', true]],
  },
  'mock-walnut-bookshelf': {
    kind: 'furniture', space: 'living',
    description: 'Kệ sách 5 tầng đồng bộ bộ sưu tập Vincent, khung gỗ óc chó chắc chắn, đợt kệ chịu lực 20kg mỗi tầng.\n\nKhoảng cách giữa các tầng được tính cho cả sách khổ lớn (artbook, tạp chí) lẫn hộp lưu trữ, giỏ mây hay chậu cây nhỏ. Hai tầng dưới cao hơn để đặt đồ nặng, giúp trọng tâm kệ luôn thấp và vững.\n\nKệ đi kèm bộ ke chống đổ gắn tường — chúng tôi khuyên bạn luôn lắp, nhất là khi nhà có trẻ nhỏ hoặc thú cưng. Lắp ráp khoảng 40 phút với 2 người, hoặc để đội Luméa lắp miễn phí ở nội thành TP.HCM.',
    story: 'Một góc đọc sách ấm cúng bắt đầu từ một chiếc kệ đủ đẹp để bạn muốn ngồi lại lâu hơn.\n\nKệ Vincent được thiết kế "mở" ở hai bên hông để ánh sáng đi xuyên qua, không chắn tầm nhìn như tủ kín. Nhờ vậy, kể cả trong căn hộ nhỏ, kệ vẫn tạo cảm giác thoáng — vừa là nơi cất sách, vừa là vách ngăn nhẹ nhàng giữa phòng khách và góc làm việc.',
    features: ['Hai tầng dưới cao 38cm cho sách khổ lớn', 'Hông kệ mở, có thể dùng làm vách ngăn phòng', 'Miễn phí lắp đặt nội thành TP.HCM', 'Veneer óc chó dày 0.6mm, vân liền mạch giữa các tầng'],
    reviews: [['Tuấn Anh', 5, '29/09/2026', 'Kệ chắc, chất đầy sách vẫn không võng. Đội lắp đặt còn cân chỉnh thăng bằng rất kỹ.', true], ['Thảo Vy', 4, '17/09/2026', 'Đẹp nhưng kiện hàng khá nặng, nên để shop lắp.']],
  },
  'mock-walnut-stool': {
    kind: 'furniture', space: 'cozy',
    description: 'Ghế đôn chân gỗ óc chó, mặt nệm vải bouclé kem mềm mại. Dùng làm ghế phụ, ghế trang điểm hoặc để chân.\n\nVải bouclé với những vòng sợi xoăn nhỏ tạo bề mặt có chiều sâu, bắt sáng rất đẹp và che vết bẩn nhẹ tốt hơn vải trơn. Nệm mút D40 đủ êm để ngồi lâu mà vẫn giữ form sau nhiều năm.\n\nBảo quản: hút bụi bề mặt vải hằng tuần, vỏ nệm có khoá kéo ẩn để tháo ra giặt tay bằng nước lạnh. Chân gỗ chỉ cần lau khăn khô.',
    story: 'Chiếc ghế nhỏ nhất trong nhà thường lại là chiếc được dùng nhiều nhất — để ngồi buộc dây giày, để kê chân khi đọc sách, để bạn bè có thêm chỗ ngồi khi ghé chơi.\n\nVới ghế đôn Vincent, chúng tôi muốn món đồ "phụ" ấy cũng đẹp như một tác phẩm: tông kem dịu của vải bouclé đặt cạnh sắc nâu trầm của óc chó, mềm mại mà vẫn có chiều sâu.',
    features: ['Nệm mút D40 giữ form lâu dài', 'Vỏ nệm khoá kéo ẩn, tháo giặt dễ dàng', 'Chân gỗ óc chó nguyên khối, chịu tải 110kg'],
    reviews: [['Mai Chi', 5, '26/09/2026', 'Dùng làm ghế bàn trang điểm, vải bouclé sờ rất thích, màu kem sang.', true]],
  },
  'mock-oak-stool': {
    kind: 'furniture', space: 'cozy',
    description: 'Ghế đôn gỗ sồi sáng màu, dáng tròn tối giản, hợp phong cách Japandi.\n\nMặt ghế được khoét lõm nhẹ theo dáng ngồi nên dù là ghế gỗ cứng, bạn vẫn ngồi thoải mái 20–30 phút. Ba chân vát ra ngoài 8° giúp ghế vững trên mọi mặt sàn, kể cả sàn gạch không phẳng tuyệt đối.\n\nNgoài làm ghế, nhiều khách hàng dùng Ashen như một chiếc bàn phụ mini đặt chậu cây, hoặc đặt cạnh bồn tắm để để khăn và nến thơm.',
    story: 'Ashen là bộ sưu tập gỗ sồi trắng của Luméa — lấy cảm hứng từ những ngôi nhà gỗ Bắc Âu và sự giản dị của không gian Nhật. Không chi tiết thừa, không đinh vít lộ ra ngoài, chỉ có gỗ và đường nét.\n\nGỗ sồi trắng có vân thẳng, màu sáng như tro, đặc biệt hợp với những căn phòng nhiều ánh sáng tự nhiên.',
    features: ['Mặt ghế khoét lõm theo dáng ngồi', 'Chân vát 8° tăng độ vững', 'Đa năng: ghế ngồi, bàn phụ mini, kệ chậu cây', 'Mộng gỗ ẩn, không lộ đinh vít'],
    reviews: [['Khánh Linh', 5, '30/09/2026', 'Mình đặt cạnh bồn tắm để khăn và nến, gỗ sồi sáng nhìn rất spa.', true], ['Văn Đức', 4, '20/09/2026', 'Ghế đẹp, chắc. Ngồi lâu thì nên kèm thêm đệm.']],
  },
  'mock-oak-side-table': {
    kind: 'furniture', space: 'living',
    description: 'Bàn phụ tròn gỗ sồi, chân trụ dày chắc chắn, mặt bàn bo tròn mềm mại.\n\nĐường kính 50cm vừa đủ cho một khay trà, vài cuốn sách và một bình hoa nhỏ — kích thước lý tưởng để đặt cạnh sofa văng hoặc ghế bành. Chân trụ đơn đặt chính giữa giúp bạn kéo bàn sát vào ghế mà không vướng chân.\n\nLớp dầu lau chống thấm nhẹ giúp mặt bàn không bị loang khi lỡ đổ nước; chỉ cần lau khô trong vòng vài phút.',
    story: 'Thiết kế chân trụ của Ashen được phát triển qua 6 bản mẫu để tìm ra tỉ lệ cân bằng nhất giữa độ dày chân và mặt bàn — đủ vững để không rung khi đặt ly nước, đủ thanh để không trông nặng nề.\n\nĐây là chiếc bàn bạn sẽ dùng mỗi ngày: đặt ly cà phê sáng, chiếc điện thoại tối, và cuốn sách đọc dở cuối tuần.',
    features: ['Chân trụ giữa, kéo sát ghế không vướng', 'Đường kính 50cm vừa khay trà và bình hoa', 'Đế trụ có ốc cân bằng chống cập kênh', 'Gỗ sồi trắng vân thẳng, tông sáng'],
    reviews: [['Ngọc Diệp', 5, '24/09/2026', 'Đặt cạnh sofa xám, tông gỗ sáng làm phòng khách nhẹ nhàng hẳn.', true]],
  },
  'prod-1': {
    kind: 'light', space: 'cozy',
    description: 'Chiếc đèn ngủ mặt trăng được in 3D công nghệ cao mô phỏng bề mặt hố thiên thạch chân thực. Khách hàng có thể tùy chọn màu ánh sáng, đế gỗ và khắc laser tên/lời chúc ý nghĩa.\n\nVỏ đèn in từ dữ liệu địa hình thật của Mặt Trăng, độ dày thành 1.2mm được tính toán để ánh sáng tán đều, làm nổi rõ từng miệng hố và dãy núi khi bật đèn. Đèn có 3 chế độ: vàng ấm, trắng trung tính và đổi màu RGB, chạm nhẹ để chuyển.\n\nPin sạc tích hợp dùng 8–10 giờ ở độ sáng trung bình, sạc đầy trong khoảng 2 giờ qua cổng Type-C. Đế gỗ sồi có rãnh định vị nên đèn không lăn khỏi đế.',
    story: 'Lấy cảm hứng từ ánh trăng dịu nhẹ đêm rằm, sản phẩm mang lại cảm giác bình yên, ấm áp cho giấc ngủ sâu sau một ngày làm việc căng thẳng.\n\nMoon Lamp là sản phẩm đầu tiên Luméa in 3D cho khách hàng — từ một đơn đặt làm quà sinh nhật năm 2024. Đến nay đã có hàng nghìn chiếc đèn được khắc tên, ngày kỷ niệm và những lời nhắn riêng, mỗi chiếc là một câu chuyện nhỏ.\n\nMỗi đèn được in riêng sau khi bạn đặt hàng, kỹ thuật viên kiểm tra độ tán sáng và khắc chữ thủ công trước khi đóng gói.',
    features: ['3 chế độ ánh sáng: vàng ấm, trắng, RGB', 'Chạm để đổi màu, giữ để chỉnh độ sáng', 'Đế gỗ sồi có rãnh định vị chống lăn', 'Kiểm tra độ tán sáng từng chiếc trước khi giao'],
    reviews: [['Quỳnh Anh', 5, '05/10/2026', 'Khắc tên hai đứa ở đế, quà kỷ niệm 1 năm mà bạn trai mình xúc động luôn. Ánh sáng vàng rất đẹp.', true], ['Đăng Khoa', 5, '27/09/2026', 'Size 18cm vừa vặn bàn đầu giường. Pin dùng 2 đêm mới sạc lại.']],
  },
  'prod-2': {
    kind: 'vase', space: 'living',
    description: 'Bình hoa gốm thủ công mộc mạc với đường nét uốn lượn phong cách Bắc Âu. Thích hợp cắm cành hoa khô hoặc cỏ lau trang trí bàn học và kệ sách.\n\nLớp men mờ (matte) màu trắng sữa được phủ thủ công rồi nung ở 1.200°C, cho bề mặt mịn như đá cuội và chống thấm hoàn toàn. Dáng bình bất đối xứng nhẹ — mỗi chiếc có độ uốn hơi khác nhau, đúng tinh thần đồ gốm làm tay.\n\nGợi ý cắm: 3–5 cành bông gòn, cỏ lau hoặc một cành lá bạch đàn cho vẻ tối giản; hoa tươi thì chọn tulip hoặc cát tường.',
    story: 'Những chiếc bình Ceramic Abstract được làm tại một lò gốm nhỏ ở Bát Tràng, nơi nghệ nhân vẫn nặn tay và nung bằng lò ga theo từng mẻ 40 chiếc.\n\nChúng tôi yêu cái "không hoàn hảo" của gốm thủ công: một vệt men dày hơn, một đường uốn lệch đi đôi chút. Đó là dấu vết của bàn tay người làm — thứ mà máy móc không sao chép được.',
    features: ['Nung 1.200°C, men mờ chống thấm hoàn toàn', 'Làm tay tại Bát Tràng, mỗi chiếc một dáng riêng', 'Cắm được cả hoa tươi lẫn hoa khô', 'Rửa được bằng nước ấm và xà phòng nhẹ'],
    reviews: [['Bích Phương', 5, '01/10/2026', 'Men mờ sờ rất mịn, cắm bông gòn để kệ sách nhìn y như Pinterest.', true]],
  },
  'prod-3': {
    kind: 'print3d', space: 'living',
    description: 'Bình hoa được tạo hình bằng thuật toán tham số (Parametric Design) với các nếp gập xoắn ốc bắt sáng độc đáo. Tùy biến màu sắc và kích thước theo sở thích.\n\nMỗi nếp gập được sinh ra từ một hàm sóng xoắn, nên khi ánh sáng chiếu nghiêng, bình tạo ra những dải sáng – tối chuyển động như mặt nước. Nhựa PETG có lòng trong kín nước, cắm hoa tươi thoải mái mà không cần ống lót.\n\nBạn có thể xem trước bình với màu và kích thước mình chọn ngay trên trình xem 3D trước khi đặt in.',
    story: 'Wave Vase bắt đầu từ một dòng code: đội thiết kế của Luméa viết thuật toán sinh hình trong Grasshopper, thử hơn 200 biến thể trước khi chọn ra đường sóng cân bằng giữa vẻ đẹp và độ vững.\n\nĐó là cách chúng tôi muốn kể về in 3D — không chỉ là công nghệ, mà là một cách mới để tạo ra những hình khối mà gốm hay thuỷ tinh truyền thống khó làm được.',
    features: ['Thiết kế bằng thuật toán, hơn 200 phiên bản thử nghiệm', 'PETG kín nước, không cần ống lót', 'Xem trước màu & kích thước trên trình 3D', 'In theo đơn trong 2–3 ngày'],
    reviews: [['Minh Thư', 5, '02/10/2026', 'Màu Sage lên ngoài đời rất xinh, ánh đèn chiếu nghiêng thấy rõ các nếp sóng.', true], ['Long Vũ', 4, '19/09/2026', 'Đẹp, nhẹ. Mình sẽ mua thêm bản Lớn 26cm.']],
  },
  'prod-4': {
    kind: 'wall', space: 'living',
    description: 'Kệ treo tường khung sắt sơn tĩnh điện kết hợp đợt gỗ tự nhiên, thiết kế tối giản giúp tối ưu không gian lưu trữ và trang trí mảng tường trống.\n\nKhung thép dẹp 3mm sơn tĩnh điện đen nhám, không bong tróc khi va chạm. Đợt gỗ thông được phủ sáp lau giữ màu gỗ mộc, vân rõ, thích hợp đặt sách, chậu cây nhỏ hay khung ảnh.\n\nKệ có thể lắp theo chiều ngang hoặc ghép nhiều chiếc thành bố cục so le trên tường — bộ vít nở đi kèm phù hợp cả tường gạch lẫn tường bê tông.',
    story: 'Nordic Shelf ra đời từ một vấn đề rất thật: căn hộ nhỏ, sàn chật, nhưng tường thì trống. Chúng tôi muốn một chiếc kệ đủ mảnh để không chiếm chỗ, đủ chắc để chất sách, và đủ đẹp để chính nó là một món decor.\n\nSự kết hợp thép đen – gỗ mộc là "công thức" kinh điển của phong cách Scandinavian công nghiệp, hợp với tường trắng, tường xi măng hay tường sơn màu đất.',
    features: ['Thép dẹp 3mm sơn tĩnh điện đen nhám', 'Lắp ngang hoặc ghép so le nhiều chiếc', 'Vít nở dùng được cho tường gạch và bê tông'],
    reviews: [['Phú Quý', 5, '28/09/2026', 'Ghép 3 chiếc so le trên tường phòng làm việc, nhìn rất nghệ.', true]],
  },
  'prod-5': {
    kind: 'furniture', space: 'cozy',
    description: 'Bàn trà nhỏ kê cạnh giường ngủ hoặc bàn làm việc. Mặt bàn tròn bo góc an toàn, chân bàn gỗ sồi thon gọn thanh lịch.\n\nĐường kính 40cm và chiều cao 48cm được tính để ngang tầm mặt nệm và tay vịn sofa phổ thông, bạn với tay là tới. Bốn chân thon vát dần xuống dưới tạo dáng nhẹ nhàng, không chiếm diện tích thị giác.\n\nChân bàn vặn ren trực tiếp vào mặt — lắp ráp trong 3 phút không cần dụng cụ, tháo ra cũng dễ khi chuyển nhà.',
    story: 'Chiếc bàn nhỏ này là "người bạn" cạnh giường của rất nhiều khách hàng Luméa: chỗ đặt cuốn sách đang đọc, cốc trà gừng buổi tối và chiếc đèn ngủ.\n\nChúng tôi chọn gỗ sồi vì độ cứng cao, ít cong vênh trong khí hậu nồm ẩm của miền Bắc, và vì sắc gỗ sáng giúp phòng ngủ nhỏ trông rộng hơn.',
    features: ['Cao 48cm — ngang tầm mặt nệm và tay vịn sofa', 'Gỗ sồi cứng, ít cong vênh khi nồm ẩm', 'Lắp ráp 3 phút, tháo dễ khi chuyển nhà'],
    reviews: [['Hà My', 5, '25/09/2026', 'Vừa khít cạnh giường, để đèn ngủ và sách. Gỗ sồi sáng rất hợp phòng nhỏ.', true]],
  },
  'prod-6': {
    kind: 'furniture', space: 'cozy',
    description: 'Ghế đôn gỗ uốn cong đa năng, vừa dùng làm ghế ngồi học phụ, vừa làm kệ đặt chậu cây hoặc sách báo.\n\nTấm plywood 9 lớp được ép nóng trong khuôn để tạo đường cong liền mạch, không mối nối — vừa nhẹ vừa có độ đàn hồi nhẹ khi ngồi. Lớp veneer tần bì bên ngoài cho vân gỗ sáng, thẳng và sang.\n\nKhi không dùng, các ghế xếp chồng lên nhau gọn trong một góc. Đế chân có miếng đệm cao su chống trượt và chống trầy sàn.',
    story: 'Kỹ thuật uốn gỗ ép được các nhà thiết kế Bắc Âu thập niên 1930 phát triển để làm nội thất vừa bền vừa nhẹ. Plywood Stool là cách Luméa tưởng nhớ di sản ấy: một tấm gỗ, một đường cong, không chi tiết thừa.\n\nĐây là chiếc ghế dành cho nhà có nhiều thói quen: hôm nay là ghế, mai là kệ cây, cuối tuần là bàn trà mini cho buổi picnic trong phòng.',
    features: ['Plywood 9 lớp ép nóng, đường cong liền khối', 'Veneer tần bì vân thẳng, sáng màu', 'Đệm cao su chống trượt dưới chân'],
    reviews: [['Trọng Nhân', 5, '22/09/2026', 'Mua 3 chiếc xếp chồng ở góc, có khách thì lấy ra ngồi. Chắc hơn mình nghĩ.', true]],
  },
  'prod-7': {
    kind: 'print3d', space: 'desk',
    description: 'Hộp phân chia ngăn bàn làm việc với các hộc chuyên dụng cho bút, thẻ, kẹp giấy, đồng hồ và khe cắm điện thoại nghiêng 60 độ tiện xem thông báo.\n\nThiết kế 3 ngăn (bản 5 ngăn với bàn rộng) được đo theo kích thước đồ dùng thực tế: khe thẻ vừa thẻ ngân hàng và name card, ngăn sâu cho bút cao, khay đáy có nam châm hút ghim kẹp giấy. Khe điện thoại có rãnh luồn dây sạc phía sau.\n\nBạn có thể khắc tên, logo công ty hoặc câu slogan ở mặt trước — rất hợp làm quà tặng đồng nghiệp, đối tác.',
    story: 'Organizer này được thiết kế lại 4 lần dựa trên góp ý của chính khách hàng Luméa: thêm khe luồn dây sạc, mở rộng ngăn thẻ, chỉnh góc nghiêng điện thoại từ 70° xuống 60° cho dễ nhìn khi ngồi.\n\nVới in 3D, mỗi lần cải tiến không cần khuôn mới — chúng tôi chỉ cần sửa file thiết kế, và chiếc tiếp theo bạn nhận được đã tốt hơn chiếc trước.',
    features: ['Khe điện thoại nghiêng 60°, có rãnh luồn dây sạc', 'Ngăn thẻ vừa thẻ ngân hàng và name card', 'Bản Carbon Fiber PLA chịu lực, chống bám vân tay'],
    reviews: [['Hữu Phước', 5, '04/10/2026', 'Khắc "Keep Coding" mặt trước, bàn làm việc gọn hẳn. Khe điện thoại luồn dây sạc tiện.', true], ['Thu Uyên', 5, '21/09/2026', 'Đặt 5 cái khắc tên cho cả team, ai cũng thích.']],
  },
  'prod-8': {
    kind: 'print3d', space: 'living',
    description: 'Tác phẩm nghệ thuật không gian hình dải Möbius vô tận. Chiếc tượng tạo điểm nhấn chiều sâu cho kệ sách hoặc bàn làm việc phong cách gallery.\n\nDải Möbius chỉ có một mặt và một cạnh — đi dọc theo bề mặt, bạn sẽ quay lại điểm xuất phát mà không cần "lật" sang mặt kia. Hình khối này gần như không thể đúc khuôn nguyên khối, nhưng in 3D làm được: tượng được in liền một khối, không có đường ghép.\n\nBản Metallic Silk cho ánh kim đồng thay đổi theo góc nhìn; bản PLA nghệ thuật cho vẻ mộc, trầm như đá.',
    story: 'Möbius Loop là biểu tượng của sự vô tận và tuần hoàn — một ý tưởng toán học đẹp đến mức các nghệ sĩ từ Escher tới các nhà điêu khắc đương đại đều tìm về.\n\nLuméa muốn mang tinh thần ấy vào không gian sống: một món decor khiến bạn dừng lại nhìn lâu hơn một chút, và mỗi góc xoay lại thấy một hình dáng khác.',
    features: ['Hình khối một mặt một cạnh, không thể đúc khuôn', 'Bản Metallic Silk ánh kim đổi theo góc nhìn', 'Đế phẳng có lót nỉ, đặt vững trên kệ kính'],
    reviews: [['Bảo Anh', 5, '29/09/2026', 'Bản trắng marble đặt cạnh sách nghệ thuật, nhìn như tượng trong gallery.', true]],
  },
  'prod-9': {
    kind: 'desk', space: 'desk',
    description: 'Đồng hồ đúc bê tông mỹ thuật nguyên khối, kim đồng kim loại không tiếng tích tắc (kim trôi êm ái), tạo nét thô mộc cá tính.\n\nKhối bê tông được đúc từ xi măng trắng mịn, đánh bóng nhẹ và phủ lớp chống thấm, nên bề mặt có những lỗ khí li ti tự nhiên — mỗi chiếc đồng hồ mang một "làn da" riêng. Kim bằng đồng brass sẽ ngả màu trầm theo thời gian, tạo vẻ cổ điển.\n\nBộ máy Silent Sweep chạy liên tục không phát tiếng tích tắc, đặt trong phòng ngủ cũng không ảnh hưởng giấc ngủ.',
    story: 'Bê tông thường gắn với công trình và sự lạnh lẽo, nhưng ở kích thước nhỏ, nó trở nên mộc mạc và ấm áp lạ thường.\n\nNordic Minimal Clock là sự đối lập thú vị giữa chất liệu thô ráp và thời gian trôi êm — một lời nhắc nhẹ nhàng hãy sống chậm lại giữa nhịp làm việc hối hả.',
    features: ['Xi măng trắng đúc thủ công, mỗi chiếc một bề mặt', 'Kim đồng brass ngả màu đẹp theo thời gian', 'Đế lót cao su chống trầy bàn gỗ'],
    reviews: [['Hoài Nam', 5, '23/09/2026', 'Đặt phòng ngủ, đúng là không nghe tiếng tích tắc. Khối bê tông nhìn rất cá tính.', true]],
  },
  'prod-10': {
    kind: 'desk', space: 'cozy',
    description: 'Chân đỡ nến thơm hoặc nến trụ thon dài, kết hợp giữa kim loại đồng ánh vàng và khối gỗ tần bì ấm cúng.\n\nCốc cắm nến bằng đồng thau có gờ hứng sáp, vừa nến cây tiêu chuẩn đường kính 2.2cm. Khối gỗ tần bì phía dưới đủ nặng để giữ nến đứng vững, đồng thời cách nhiệt cho mặt bàn.\n\nĐặt một chiếc trên bàn ăn cho bữa tối, hoặc gom 2–3 chiếc cao thấp khác nhau trên khay gỗ để tạo một góc hygge ấm áp.',
    story: 'Hygge — khái niệm của người Đan Mạch về sự ấm cúng — thường bắt đầu từ một ngọn nến. Ánh lửa nhỏ làm căn phòng chậm lại, câu chuyện dài hơn, và bữa tối trở nên đáng nhớ.\n\nBrass Candle Holder được thiết kế để là "nhân vật phụ" hoàn hảo: không phô trương, nhưng làm mọi thứ xung quanh đẹp hơn.',
    features: ['Vừa nến cây tiêu chuẩn Ø2.2cm', 'Khối gỗ cách nhiệt, bảo vệ mặt bàn', 'Phối 2–3 chiếc trên khay cho góc hygge'],
    reviews: [['Yến Nhi', 5, '18/09/2026', 'Đồng thau sáng bóng, đặt trên bàn ăn tối lãng mạn hẳn.', true]],
  },
  'prod-11': {
    kind: 'light', space: 'desk',
    description: 'Đèn bàn cần cong sơn tĩnh điện nhám, chao xoay 180° cho ánh sáng ấm dịu khi đọc sách hoặc làm việc buổi tối.\n\nCần đèn uốn cong một đường liền khiến chao vươn ra phía trước, chiếu sáng đúng vùng làm việc mà đế vẫn nằm gọn ở góc bàn. Đế kim loại nặng 600g giữ đèn vững, không bị chúi về phía trước.\n\nĐèn dùng bóng E27 phổ thông, đi kèm bóng LED 2700K ánh vàng ấm; bạn có thể thay bóng dimmer hoặc bóng thông minh tuỳ thích.',
    story: 'Arc Desk Lamp được thiết kế cho những buổi tối dài bên bàn làm việc: ánh sáng đủ để đọc, đủ ấm để không mỏi mắt, và một dáng đèn đủ đẹp để bạn muốn ngồi vào bàn.\n\nTông sơn nhám mờ không bám vân tay và hợp với mọi chất liệu — gỗ, đá hay mặt bàn trắng.',
    features: ['Đế kim loại 600g, đèn không chúi', 'Tương thích bóng thông minh và bóng dimmer E27', 'Sơn nhám không bám vân tay'],
    reviews: [['Quang Huy', 5, '30/09/2026', 'Chao xoay linh hoạt, ánh vàng 2700K đọc sách rất dễ chịu.', true]],
  },
  'prod-12': {
    kind: 'plant', space: 'desk',
    description: 'Chậu gốm men xanh mint kèm cây sen đá sống, kích thước nhỏ gọn đặt vừa mọi góc bàn làm việc.\n\nCây được ươm tại vườn ở Đà Lạt, thuần dưỡng 2 tuần trong điều kiện ánh sáng trong nhà trước khi giao nên thích nghi tốt với bàn làm việc, bậu cửa sổ. Giá thể trộn đá perlite thoát nước nhanh, hạn chế úng rễ — nguyên nhân số một khiến sen đá chết.\n\nChăm sóc: tưới 1 lần/tuần khi đất khô hẳn, đặt nơi có ánh sáng gián tiếp 4–6 giờ mỗi ngày.',
    story: 'Một chậu cây nhỏ trên bàn có thể thay đổi cả ngày làm việc của bạn: một khoảng xanh để mắt nghỉ ngơi, một sinh vật nhỏ để quan tâm.\n\nChúng tôi chọn sen đá vì đây là loại cây "dễ thương với người bận rộn" — ít đòi hỏi, sống lâu, và mỗi tháng lại nhú thêm vài chiếc lá mới.',
    features: ['Cây thuần dưỡng 2 tuần trước khi giao', 'Giá thể trộn perlite chống úng rễ', 'Kèm thẻ hướng dẫn chăm sóc'],
    reviews: [['Thanh Trúc', 5, '03/10/2026', 'Mua 3 chậu xếp ở bậu cửa sổ, màu mint pastel dễ thương xỉu.', true]],
  },
  'prod-13': {
    kind: 'desk', space: 'desk',
    description: 'Khay gỗ sồi tự nhiên bo góc mềm, gom gọn chìa khóa, sổ tay và đồ decor nhỏ trên bàn làm việc.\n\nKhay được phay CNC từ một tấm gỗ sồi liền, thành khay cao 4cm giữ đồ không trượt ra ngoài. Lớp dầu bóng an toàn thực phẩm cho phép bạn dùng khay để bưng trà, bánh hoặc làm khay phục vụ buổi tiệc nhỏ.\n\nBảo quản: lau khăn ẩm, không ngâm nước hoặc cho vào máy rửa chén.',
    story: 'Khay gỗ là món đồ "gom" — gom những thứ lặt vặt về một chỗ, gom ánh nhìn về một điểm nhấn trên bàn. Chỉ cần đặt chiếc khay xuống, mọi thứ xung quanh tự nhiên ngăn nắp hơn.\n\nVân sồi trên mỗi khay đều khác nhau, nên chiếc khay bạn nhận được là duy nhất.',
    features: ['Phay CNC từ gỗ sồi liền khối', 'Dầu phủ an toàn thực phẩm', 'Thành khay 4cm giữ đồ không trượt'],
    reviews: [['Gia Bảo', 5, '27/09/2026', 'Để chìa khoá, đồng hồ, ví ở cửa ra vào. Gỗ đẹp, hoàn thiện mịn.', true]],
  },
  'prod-14': {
    kind: 'desk', space: 'desk',
    description: 'Bộ phụ kiện bàn làm việc gồm giá treo tai nghe bằng gỗ và hộp bút gốm, giữ mặt bàn luôn ngăn nắp.\n\nGiá treo cao 26cm vừa các loại tai nghe chụp tai phổ biến, móc treo bọc nỉ để không hằn lên đệm đầu tai nghe. Hộp bút gốm men trắng chia 3 ngăn cho bút, kéo, thước và có lót cao su dưới đáy.\n\nHai món phối màu be – trắng, dễ kết hợp với setup gỗ sáng, bàn trắng hoặc bàn đen tối giản.',
    story: 'Desk Set dành cho những người dành 8 tiếng mỗi ngày bên bàn làm việc — designer, lập trình viên, sinh viên. Chúng tôi tin một mặt bàn gọn gàng là bước đầu tiên của một ngày làm việc tập trung.\n\nVà khi xong việc, chiếc tai nghe có chỗ của nó, không còn vắt vẻo trên màn hình.',
    features: ['Móc treo bọc nỉ, không hằn đệm tai nghe', 'Hộp bút gốm chia 3 ngăn', 'Hợp setup bàn gỗ sáng, trắng hoặc đen'],
    reviews: [['Duy Khang', 5, '01/10/2026', 'Treo được cả tai nghe gaming nặng, đế không đổ. Combo với hộp bút gốm nhìn rất sạch.', true]],
  },
  'prod-15': {
    kind: 'plant', space: 'living',
    description: 'Chậu xi măng đúc mịn màu trắng kèm cây nha đam mini, tạo điểm nhấn xanh tối giản cho kệ sách hoặc bàn làm việc.\n\nNha đam (lô hội) là loại cây mọng nước có khả năng lọc không khí, chịu hạn tốt và gần như không cần chăm sóc. Chậu xi măng đúc thủ công có lỗ thoát nước và lớp chống thấm bên trong, giữ đất thoáng khí.\n\nChăm sóc: tưới 10–14 ngày một lần, đặt nơi có nắng nhẹ buổi sáng. Khi cây lớn, bạn có thể tách cây con sang chậu mới.',
    story: 'Nha đam là loại cây mà bà và mẹ chúng ta thường trồng ở ban công — vừa làm cảnh, vừa dùng khi bị bỏng nhẹ. Aloe Pot mang hình ảnh quen thuộc ấy vào không gian hiện đại, trong một chiếc chậu xi măng trắng tối giản.\n\nĐơn giản, bền bỉ, và luôn xanh — giống cách chúng tôi mong món decor của bạn sẽ đồng hành lâu dài.',
    features: ['Nha đam lọc không khí, chịu hạn tốt', 'Chậu có lớp chống thấm bên trong', 'Có thể tách cây con khi cây lớn'],
    reviews: [['Mỹ Duyên', 5, '26/09/2026', 'Chậu trắng xi măng rất sạch sẽ, cây nha đam mập khoẻ.', true]],
  },
  'prod-16': {
    kind: 'light', space: 'living',
    description: 'Đèn thả trần chao nhôm dáng chuông cổ điển, tạo vùng sáng ấm gọn gàng phía trên bàn ăn hoặc quầy bar.\n\nChao nhôm được dập nguyên tấm, sơn tĩnh điện bên ngoài và lót trắng bên trong để phản xạ tối đa ánh sáng xuống dưới — vùng sáng tập trung, không chói lên trần. Dây treo bọc vải điều chỉnh độ cao tới 1.2m.\n\nGợi ý lắp: treo cách mặt bàn ăn 70–80cm; với bàn dài từ 1.6m, dùng 2–3 đèn cách nhau 60cm.',
    story: 'Dáng chao chuông là một trong những thiết kế đèn kinh điển nhất của Bắc Âu thế kỷ 20 — đơn giản, hiệu quả và đẹp theo thời gian.\n\nPendant Lamp của Luméa giữ nguyên tinh thần ấy, chỉ tinh chỉnh tỉ lệ cho trần nhà thấp hơn của căn hộ Việt Nam, để bữa cơm gia đình luôn quây quần dưới một vùng sáng ấm.',
    features: ['Chao nhôm dập nguyên tấm, lót trắng phản xạ', 'Dây treo bọc vải, chỉnh cao tới 1.2m', 'Gợi ý treo cách mặt bàn 70–80cm'],
    reviews: [['Tiến Đạt', 5, '24/09/2026', 'Treo 2 chiếc trên bàn ăn, ánh sáng tập trung, bữa tối ấm cúng hẳn.', true]],
  },
  'prod-17': {
    kind: 'desk', space: 'cozy',
    description: 'Khay gốm men mộc lòng nông, đặt trang sức, nến nhỏ hoặc đồ decor để tạo một góc trưng bày tinh tế.\n\nMen mộc (không bóng) để lộ chất đất nung với những đốm sắt li ti tự nhiên, mỗi chiếc khay có sắc độ hơi khác nhau. Lòng khay nông 1.5cm giúp lấy nhẫn, bông tai dễ dàng.\n\nĐặt trên bàn trang điểm, kệ phòng tắm hoặc cạnh cửa ra vào để đựng chìa khoá — món nhỏ mà luôn có ích.',
    story: 'Ceramic Tray lấy cảm hứng từ những chiếc đĩa gốm trong trà đạo Nhật Bản — mộc mạc, khiêm nhường nhưng đầy chủ ý.\n\nNhững món đồ nhỏ thân thuộc nhất của bạn — chiếc nhẫn cưới, đôi bông tai mẹ tặng — xứng đáng có một nơi trú ngụ đẹp đẽ.',
    features: ['Men mộc lộ đốm sắt tự nhiên', 'Lòng khay nông 1.5cm, lấy đồ dễ', 'Dùng được cho nến trà và que thơm'],
    reviews: [['Như Quỳnh', 5, '20/09/2026', 'Để nhẫn và bông tai trên bàn trang điểm, men mộc nhìn rất Nhật.', true]],
  },
  'prod-18': {
    kind: 'print3d', space: 'desk',
    description: 'Mô hình phi hành gia ngồi thư giãn được in 3D bằng PLA, bề mặt xử lý mịn và sơn phủ mờ, làm điểm nhấn cho kệ sách.\n\nMô hình in ở độ phân giải 0.12mm, sau đó được chà nhám, sơn lót và sơn phủ mờ thủ công qua 3 lớp, nên bề mặt mịn, không còn vân lớp in. Chi tiết mũ bảo hiểm, ba lô dưỡng khí và tư thế ngồi bắt chéo chân đều được tạc rõ nét.\n\nAstro Buddy có thể ngồi trên mép kệ, chồng sách hay cạnh màn hình máy tính — một người bạn nhỏ dễ thương cho góc làm việc.',
    story: 'Ai trong chúng ta cũng từng mơ bay vào vũ trụ khi còn bé. Astro Buddy là lời nhắc nhỏ về giấc mơ ấy — đang ngồi nghỉ, ngắm nhìn bàn làm việc của bạn như ngắm Trái Đất từ quỹ đạo.\n\nMỗi chú phi hành gia được kỹ thuật viên Luméa hoàn thiện bằng tay, nên mỗi chú đều có một chút "cá tính" riêng.',
    features: ['Sơn phủ thủ công 3 lớp, không thấy vân in', 'Ngồi được trên mép kệ, chồng sách', 'Hoàn thiện bằng tay từng chiếc'],
    reviews: [['Tú Anh', 5, '02/10/2026', 'Bé phi hành gia ngồi cạnh màn hình, đồng nghiệp ai đi qua cũng dừng lại ngắm.', true]],
  },
  'prod-19': {
    kind: 'plant', space: 'cozy',
    description: 'Chậu bonsai mini men xanh rêu trầm, mang nét thiền Nhật vào bàn làm việc hay tủ đầu giường.\n\nCây bonsai (thường là sam hương hoặc linh sam mini) được nghệ nhân tỉa tạo dáng sẵn, uốn cành bằng dây nhôm mềm theo thế trực hoặc thế nghiêng. Chậu gốm men rêu có lỗ thoát nước lớn và lưới chắn đất.\n\nChăm sóc: tưới phun sương mỗi ngày vào mùa khô, đặt nơi có nắng sáng; tỉa nhẹ cành non 2–3 tháng một lần để giữ dáng.',
    story: 'Bonsai là nghệ thuật của sự kiên nhẫn — mỗi cành cây được uốn nắn qua nhiều tháng, nhiều năm. Một chậu bonsai nhỏ trên bàn là lời nhắc nhẹ nhàng rằng điều đẹp đẽ luôn cần thời gian.\n\nChúng tôi hợp tác với một nhà vườn nhỏ ở Huế, nơi các nghệ nhân đã chăm sóc bonsai qua ba thế hệ.',
    features: ['Nghệ nhân tỉa và uốn dáng sẵn', 'Chậu có lưới chắn đất, thoát nước tốt', 'Hợp tác cùng nhà vườn bonsai tại Huế'],
    reviews: [['Minh Tâm', 5, '29/09/2026', 'Cây đẹp, dáng nghiêng rất có hồn. Thẻ hướng dẫn tỉa cành rất chi tiết.', true]],
  },
  'prod-20': {
    kind: 'vase', space: 'living',
    description: 'Bình gốm nâu đất dáng thon kèm bó cỏ pampas khô, tô điểm phòng khách bằng sắc be - nâu ấm áp.\n\nCỏ pampas được sấy khô tự nhiên và xử lý chống rụng lông, giữ dáng bông xù mềm tới 2–3 năm. Bình gốm men nâu đất làm tay có trọng lượng đủ nặng để bó cỏ cao 38cm không bị đổ.\n\nĐặt ở góc sofa, kệ TV hay cạnh lối vào để tạo điểm nhấn boho mộc mạc. Thỉnh thoảng dùng máy sấy tóc ở chế độ mát để thổi bụi cho cỏ.',
    story: 'Những bông cỏ lau mềm mại gợi nhớ đến cánh đồng lau cuối thu — thứ vẻ đẹp nhẹ nhàng mà không cần ai chăm bón.\n\nBộ bình và cỏ này được chọn để mang chút thiên nhiên vào nhà mà không cần tưới nước, không lo héo úa — hợp với những ai yêu cây nhưng thường xuyên đi xa.',
    features: ['Cỏ xử lý chống rụng, giữ dáng 2–3 năm', 'Bình đủ nặng để bó cỏ cao không đổ', 'Phong cách boho mộc mạc, không cần tưới'],
    reviews: [['Khả Hân', 5, '04/10/2026', 'Cỏ xù bông rất đẹp, hầu như không rụng. Đặt cạnh sofa đúng vibe boho.', true]],
  },
  'prod-21': {
    kind: 'wall', space: 'living',
    description: 'Khung tranh gỗ sồi viền mảnh kèm poster typography tối giản, treo tường hoặc đặt kệ đều đẹp.\n\nPoster in trên giấy mỹ thuật 250gsm bằng mực pigment bền màu 50 năm, không ố vàng. Mặt kính trong 2mm có viền dán bảo vệ khi vận chuyển. Khung gỗ sồi viền 2cm, mặt sau có móc treo ngang và chân đứng gấp.\n\nBạn có thể thay poster khác cùng khổ A3 bất cứ lúc nào — mặt sau dùng ghim xoay mở nhanh.',
    story: 'Một câu chữ đúng lúc có thể thay đổi tâm trạng cả ngày. Bộ poster typography của Luméa được viết và thiết kế bởi đội ngũ nội bộ: những câu nhắc nhở ngắn về sống chậm, về nhà, về những điều nhỏ bé.\n\nKhung gỗ sồi mảnh giữ cho chữ là nhân vật chính, nhưng đủ ấm để bức tranh không bị lạnh lẽo.',
    features: ['Giấy mỹ thuật 250gsm, mực pigment bền 50 năm', 'Ghim xoay mở nhanh, thay tranh dễ', 'Kính trong 2mm có viền bảo vệ'],
    reviews: [['Phương Nam', 5, '23/09/2026', 'Khung gỗ sồi mảnh rất tinh tế, treo ở hành lang nhìn sang hẳn.', true]],
  },
  'prod-22': {
    kind: 'bigFurniture', space: 'living',
    description: 'Sofa 3 chỗ bọc nhung xanh rêu, đệm ngồi lò xo túi êm ái, chân gỗ sồi thon gọn — điểm nhấn sang trọng cho phòng khách hiện đại.\n\nĐệm ngồi gồm lớp lò xo túi độc lập, mút D40 và lớp bông gòn phủ trên cùng: êm khi vừa ngồi xuống, nâng đỡ tốt khi ngồi lâu. Khung gỗ thông sấy đạt độ ẩm 10–12%, liên kết bằng mộng và vít, bảo hành khung 5 năm.\n\nVải nhung polyester sợi ngắn có khả năng chống bám lông thú cưng và chống thấm nhẹ — các vết bẩn thông thường chỉ cần lau bằng khăn ẩm.',
    story: 'Verde trong tiếng Ý nghĩa là "xanh lá". Sắc xanh rêu sâu của nhung được chọn để mang cảm giác của khu vườn vào phòng khách — tươi mát nhưng vẫn sang trọng, đặc biệt đẹp khi đặt cạnh gỗ sồi, đồng thau và cây xanh.\n\nMỗi chiếc sofa được bọc vải thủ công tại xưởng của Luméa, kiểm tra 27 điểm chất lượng trước khi giao, và lắp đặt tận nơi bởi đội ngũ của chúng tôi.',
    features: ['Bảo hành khung gỗ 5 năm', 'Kiểm tra 27 điểm chất lượng trước khi giao', 'Nệm 3 lớp: lò xo túi, mút D40, bông gòn'],
    reviews: [['Thế Vinh', 5, '02/10/2026', 'Màu xanh rêu ngoài đời sang hơn ảnh rất nhiều. Ngồi êm, mèo nhà mình cào thử chưa thấy xước.', true]],
  },
  'prod-23': {
    kind: 'bigFurniture', space: 'cozy',
    description: 'Giường 1m6 đầu giường bọc nệm chần nút cổ điển, khung gỗ tự nhiên chắc chắn, gam màu be dịu mắt cho phòng ngủ thư thái.\n\nĐầu giường cao 120cm bọc vải linen pha bông, chần nút thủ công theo hình kim cương — tựa lưng đọc sách rất êm. Khung giường gỗ cao su xử lý chống mối mọt, dát giường gỗ thông 14 thanh có khe thoáng khí giúp nệm không ẩm mốc.\n\nGầm giường cao 25cm, dễ dàng lau dọn hoặc đặt hộp lưu trữ. Đội Luméa lắp đặt tại nhà trong khoảng 60 phút.',
    story: 'Phòng ngủ là nơi một ngày bắt đầu và kết thúc. Lune — "mặt trăng" trong tiếng Pháp — được thiết kế để mỗi đêm của bạn đều yên tĩnh như ánh trăng.\n\nĐường chần nút cổ điển gợi nhớ những khách sạn boutique châu Âu, nhưng gam be và linen mộc giữ cho chiếc giường gần gũi, ấm áp như ở nhà.',
    features: ['Đầu giường cao 120cm, tựa lưng đọc sách êm', 'Gầm cao 25cm, dễ lau dọn và để đồ', 'Gỗ cao su xử lý chống mối mọt'],
    reviews: [['Như Ý', 5, '28/09/2026', 'Đầu giường chần nút rất sang, tựa lưng đọc sách êm cực. Lắp đặt nhanh gọn.', true]],
  },
  'prod-24': {
    kind: 'bigFurniture', space: 'living',
    description: 'Bàn ăn gỗ sồi mặt chữ nhật cho 6 người, chân vát thanh mảnh đúng tinh thần Bắc Âu — dùng làm bàn ăn hay bàn làm việc lớn đều hợp.\n\nMặt bàn ghép thanh gỗ sồi dày 3cm, xử lý cân bằng ẩm và phủ 3 lớp dầu lau gốc thực vật an toàn thực phẩm. Chân bàn vát ra ngoài tạo dáng nhẹ, khoảng để chân rộng cho cả 6 người ngồi thoải mái.\n\nBảo quản: lau sạch ngay khi đổ nước canh, nước sốt; dùng lót ly cho đồ nóng. Mỗi năm thoa lại một lớp dầu để bề mặt luôn mịn.',
    story: 'Bàn ăn là trái tim của ngôi nhà — nơi cả gia đình quây quần, nơi bạn bè ngồi lại trò chuyện tới khuya, và nơi những đứa trẻ làm bài tập buổi tối.\n\nBàn Nordic được làm để chứng kiến tất cả những khoảnh khắc đó trong nhiều năm: chắc chắn, dễ chăm sóc, và càng dùng càng có thêm "câu chuyện" trên mặt gỗ.',
    features: ['Mặt gỗ ghép thanh xử lý cân bằng ẩm', 'Khoảng để chân rộng cho 6 người', 'Phủ 3 lớp dầu lau an toàn thực phẩm'],
    reviews: [['Đức Anh', 5, '30/09/2026', 'Bàn ăn chắc, vân sồi đẹp. Cả nhà 6 người ngồi vẫn rộng rãi.', true]],
  },
  'prod-25': {
    kind: 'furniture', space: 'living',
    description: 'Ghế bành lưng cong ôm người, bọc vải dạ xám ấm, chân gỗ tần bì — góc đọc sách hay bàn làm việc đều thêm phần thư giãn.\n\nLưng ghế cong theo đường cong cột sống, tay vịn liền khối với lưng tạo cảm giác được "ôm" khi ngồi. Mút D40 đàn hồi tốt, không xẹp sau thời gian dài; vải dạ dệt dày giữ ấm nhẹ, rất hợp phòng máy lạnh.\n\nĐặt cạnh một chiếc đèn cây và bàn phụ nhỏ, bạn sẽ có ngay góc đọc sách lý tưởng.',
    story: 'Mỗi ngôi nhà nên có một chiếc ghế "của riêng mình" — nơi bạn đọc sách, uống trà, hay chỉ ngồi yên ngắm mưa.\n\nArmchair này được thiết kế cho đúng khoảnh khắc ấy: vừa vặn với vóc dáng người Việt, đủ nhỏ gọn cho căn hộ, đủ êm để bạn không muốn đứng dậy.',
    features: ['Tay vịn liền khối, ngồi có cảm giác được ôm', 'Kích thước vừa vóc dáng người Việt', 'Vải dạ dệt dày, hợp phòng máy lạnh'],
    reviews: [['Hồng Ân', 5, '25/09/2026', 'Ghế ôm người, ngồi đọc sách cả buổi chiều không mỏi. Vải dạ xám rất sang.', true]],
  },
  'prod-26': {
    kind: 'bigFurniture', space: 'cozy',
    description: 'Tủ quần áo 2 cánh vân gỗ óc chó ấm áp, bên trong có thanh treo và 3 ngăn xếp — gọn gàng, bền bỉ cho phòng ngủ.\n\nThân tủ MDF lõi xanh chống ẩm phủ veneer óc chó, cạnh dán chỉ ABS dày chống bong tróc. Bản lề giảm chấn Hafele đóng êm, không va đập. Ngăn xếp có thể điều chỉnh độ cao theo 5 nấc.\n\nTủ được giao kèm ke chống đổ và lắp đặt cố định vào tường bởi đội ngũ Luméa — an toàn cho gia đình có trẻ nhỏ.',
    story: 'Walden được đặt theo tên cuốn sách nổi tiếng của Henry David Thoreau về cuộc sống giản dị bên hồ Walden. Một chiếc tủ không cần quá nhiều ngăn kéo, chỉ cần đủ chỗ cho những món đồ bạn thật sự yêu thích.\n\nVân óc chó trầm ấm giúp phòng ngủ trở nên tĩnh lặng, và cánh tủ trơn không tay nắm giữ mặt tiền gọn gàng, tinh tế.',
    features: ['MDF lõi xanh chống ẩm, cạnh dán chỉ ABS', 'Ngăn xếp điều chỉnh 5 nấc độ cao', 'Lắp ke chống đổ cố định tường miễn phí'],
    reviews: [['Bảo Châu', 5, '27/09/2026', 'Bản lề đóng êm thật sự, vân óc chó đẹp. Đội lắp đặt cố định vào tường rất cẩn thận.', true]],
  },
  'prod-27': {
    kind: 'print3d', space: 'desk',
    description: 'Cặp bookend hình sóng in 3D giữ sách đứng thẳng trên kệ hoặc bàn học, đế nặng chống trượt.\n\nPhần đế có khoang chứa đầy cát thạch anh giúp mỗi chiếc nặng khoảng 210g, giữ vững cả hàng sách 30–40cm. Đường sóng uốn lượn được thiết kế đối xứng — đặt hai chiếc đối diện nhau, chúng tạo thành một con sóng liền mạch ôm lấy hàng sách.\n\nĐế dán cao su non chống trượt, không để lại vết trên mặt kệ gỗ hay kính.',
    story: 'Hàng sách trên kệ là một phần tính cách của chủ nhân. Bookend Sóng là "người gác cổng" nho nhỏ, giữ cho những cuốn sách yêu thích luôn đứng ngay ngắn, sẵn sàng được mở ra.\n\nĐường sóng gợi nhớ những con sóng biển miền Trung — nơi một thành viên trong đội thiết kế Luméa lớn lên.',
    features: ['Đế chứa cát thạch anh, mỗi chiếc nặng ~210g', 'Hai chiếc ghép đối xứng thành một con sóng', 'Cao su non chống trượt, không để lại vết'],
    reviews: [['Ngọc Hà', 5, '01/10/2026', 'Hai chiếc ghép lại thành con sóng đúng như mô tả, giữ sách rất chắc.', true]],
  },
};

// Bố cục mô tả theo kiểu trang sản phẩm nội thất (tham khảo moho.com.vn): tagline → giới thiệu →
// ĐẶC ĐIỂM NỔI BẬT (tiêu đề + diễn giải) → CẤU TẠO – CÔNG NĂNG → KÍCH THƯỚC – VẬT LIỆU → BẢO QUẢN.
// "Cảm hứng thiết kế" nằm ở trường story (khối "Câu chuyện sản phẩm").
const HIGHLIGHTS = {
  'mock-walnut-side-table': {
    tagline: 'Bàn phụ gỗ óc chó Vincent — nhỏ gọn, mềm mại và bền bỉ theo năm tháng.',
    items: [
      ['Gỗ óc chó Bắc Mỹ nguyên khối', 'Óc chó là dòng gỗ cao cấp với vân sóng tự nhiên và sắc nâu socola trầm ấm. Gỗ được sấy về độ ẩm 8–10% nên ổn định, hạn chế cong vênh trong khí hậu nhiệt đới.'],
      ['Đường bo mềm, an toàn cho cả gia đình', 'Toàn bộ cạnh bàn được bo bán kính 6mm, không còn góc sắc — yên tâm khi nhà có trẻ nhỏ chạy nhảy.'],
      ['Ba kích thước cho mọi góc nhà', 'Bản 45cm cạnh giường, 55cm cạnh sofa văng, 65cm làm bàn trà mini — chọn đúng tỉ lệ cho không gian của bạn.'],
    ],
  },
  'mock-walnut-bookshelf': {
    tagline: 'Kệ sách Vincent 5 tầng — nơi những cuốn sách yêu thích được trưng bày xứng tầm.',
    items: [
      ['Chịu lực 20kg mỗi tầng', 'Đợt kệ dày 18mm có thanh đỡ ẩn phía sau, chất đầy sách khổ lớn vẫn không võng sau thời gian dài.'],
      ['Thiết kế mở, dùng làm vách ngăn', 'Hông kệ thoáng giúp ánh sáng đi xuyên qua, có thể đặt giữa phòng để chia khu tiếp khách và góc làm việc.'],
      ['An toàn với ke chống đổ', 'Bộ ke gắn tường đi kèm giữ kệ cố định, phù hợp gia đình có trẻ nhỏ và thú cưng.'],
    ],
  },
  'mock-walnut-stool': {
    tagline: 'Ghế đôn Vincent — chút mềm mại bouclé cho góc nhỏ nhà bạn.',
    items: [
      ['Vải bouclé xu hướng', 'Bề mặt vòng sợi xoăn tạo hiệu ứng chạm êm và bắt sáng đẹp, đang là chất liệu được yêu thích trong nội thất hiện đại.'],
      ['Nệm mút D40 giữ form', 'Mút tỷ trọng cao đàn hồi tốt, không xẹp lún dù dùng hằng ngày.'],
      ['Đa năng trong mọi phòng', 'Ghế trang điểm, ghế phụ phòng khách, đôn để chân hay ghế cuối giường — một món dùng được ở khắp nhà.'],
    ],
  },
  'mock-oak-stool': {
    tagline: 'Ghế đôn Ashen — tối giản tinh thần Japandi, mộc mạc từ gỗ sồi trắng.',
    items: [
      ['Gỗ sồi trắng nguyên khối', 'Vân thẳng, màu sáng như tro, cứng và bền — chất liệu kinh điển của nội thất Bắc Âu.'],
      ['Mặt ghế khoét lõm công thái học', 'Lõm nhẹ theo dáng ngồi giúp ghế gỗ cứng vẫn thoải mái khi ngồi lâu.'],
      ['Mộng gỗ ẩn tinh xảo', 'Không lộ đinh vít, các mối nối mộng âm dương giữ ghế chắc chắn và bề mặt liền lạc.'],
    ],
  },
  'mock-oak-side-table': {
    tagline: 'Bàn phụ tròn Ashen — vững chãi trên một chân trụ, nhẹ nhàng trong từng đường nét.',
    items: [
      ['Chân trụ trung tâm tiện dụng', 'Không có chân ở bốn góc nên kéo sát vào sofa, ghế bành mà không vướng chân người ngồi.'],
      ['Mặt gỗ chống thấm nhẹ', 'Lớp dầu lau giúp nước đọng không loang vào gỗ nếu được lau khô kịp thời.'],
      ['Ốc cân bằng dưới đế', 'Điều chỉnh được khi sàn không phẳng, bàn luôn đứng vững, không cập kênh.'],
    ],
  },
  'prod-1': {
    tagline: 'Moon Lamp — mang ánh trăng rằm về bên giấc ngủ của bạn.',
    items: [
      ['Bề mặt mặt trăng chân thực', 'In từ dữ liệu địa hình thật của Mặt Trăng, khi bật đèn từng miệng hố và dãy núi hiện lên sống động.'],
      ['Khắc tên – món quà mang dấu ấn riêng', 'Khắc laser tên, ngày kỷ niệm hoặc lời chúc lên đế gỗ — món quà sinh nhật, kỷ niệm ý nghĩa.'],
      ['Pin sạc Type-C, dùng 8–10 giờ', 'Không cần cắm dây khi dùng, mang đèn từ phòng ngủ ra ban công hay bàn làm việc đều được.'],
    ],
  },
  'prod-2': {
    tagline: 'Ceramic Abstract Vase — vẻ đẹp không hoàn hảo của gốm làm tay.',
    items: [
      ['Gốm Bát Tràng nặn tay', 'Mỗi chiếc bình có độ uốn, độ dày men hơi khác nhau — món decor độc bản cho ngôi nhà của bạn.'],
      ['Men mờ chống thấm tuyệt đối', 'Nung ở 1.200°C, cắm hoa tươi lâu ngày không thấm, không đọng ẩm dưới đáy.'],
      ['Màu trắng sữa dễ phối', 'Hợp phong cách Japandi, Scandinavian, tối giản — đặt ở kệ sách, bàn trà hay bậu cửa sổ đều đẹp.'],
    ],
  },
  'prod-3': {
    tagline: 'Parametric Wave Vase — khi toán học trở thành nghệ thuật trang trí.',
    items: [
      ['Thiết kế bằng thuật toán', 'Các nếp gập xoắn được sinh từ hàm sóng, tạo hiệu ứng sáng – tối chuyển động khi ánh sáng chiếu nghiêng.'],
      ['PETG kín nước, cắm hoa tươi', 'Thành bình in liền khối, không cần ống lót vẫn cắm được hoa tươi ngậm nước.'],
      ['Tuỳ biến màu & kích thước', 'Chọn màu, chất liệu Silk hai màu và kích thước, xem trước trên trình 3D rồi mới đặt in.'],
    ],
  },
  'prod-4': {
    tagline: 'Nordic Shelf — biến mảng tường trống thành góc trưng bày.',
    items: [
      ['Thép sơn tĩnh điện bền màu', 'Lớp sơn nhám đen bám chắc, chống gỉ, không bong tróc khi va chạm.'],
      ['Gỗ thông phủ sáp mộc mạc', 'Giữ màu gỗ tự nhiên, vân rõ, phù hợp phong cách Scandinavian công nghiệp.'],
      ['Lắp linh hoạt nhiều bố cục', 'Treo đơn, ghép so le hay xếp thành cụm — tuỳ theo diện tích và ý tưởng trang trí.'],
    ],
  },
  'prod-5': {
    tagline: 'Bàn phụ gỗ sồi Bắc Âu — người bạn nhỏ cạnh giường và sofa.',
    items: [
      ['Chiều cao chuẩn công năng', '48cm ngang tầm mặt nệm và tay vịn sofa, với tay là tới ly nước, cuốn sách.'],
      ['Gỗ sồi 100% tự nhiên', 'Gỗ cứng, ít co ngót, sắc sáng giúp phòng nhỏ trông rộng và thoáng hơn.'],
      ['Lắp ráp không cần dụng cụ', 'Chân bàn vặn ren trực tiếp vào mặt, 3 phút là xong, tháo ra dễ dàng khi chuyển nhà.'],
    ],
  },
  'prod-6': {
    tagline: 'Plywood Stool — một tấm gỗ, một đường cong, vô vàn công dụng.',
    items: [
      ['Gỗ ép uốn liền khối', 'Plywood 9 lớp ép nóng trong khuôn, không mối nối, nhẹ mà chịu tải tới 120kg.'],
      ['Xếp chồng gọn gàng', 'Khi không dùng có thể xếp nhiều chiếc lên nhau, tiết kiệm diện tích cho căn hộ nhỏ.'],
      ['Ghế, kệ hay bàn mini', 'Dùng làm ghế phụ, kệ chậu cây, giá để sách báo hoặc bàn trà thấp đều hợp.'],
    ],
  },
  'prod-7': {
    tagline: 'Desk Organizer — mỗi món đồ trên bàn đều có chỗ của nó.',
    items: [
      ['Ngăn chia theo đồ dùng thật', 'Khe thẻ, ngăn bút, khay ghim nam châm và khe điện thoại được đo theo kích thước đồ dùng thực tế.'],
      ['Khe điện thoại nghiêng 60°', 'Vừa xem thông báo khi làm việc, vừa sạc pin nhờ rãnh luồn dây phía sau.'],
      ['Khắc tên, logo làm quà tặng', 'Cá nhân hoá mặt trước với tên, logo hoặc slogan — quà tặng đồng nghiệp, đối tác ý nghĩa.'],
    ],
  },
  'prod-8': {
    tagline: 'Möbius Loop — một mặt, một cạnh, vô tận như ý tưởng.',
    items: [
      ['Hình khối không thể đúc khuôn', 'Dải Möbius chỉ có một mặt; in 3D nguyên khối giúp tượng liền mạch, không có đường ghép.'],
      ['Hai phong cách hoàn thiện', 'Metallic Silk ánh kim đổi theo góc nhìn hoặc PLA nghệ thuật mộc mạc như đá.'],
      ['Điểm nhấn kiểu gallery', 'Đặt trên kệ sách, bàn làm việc hay console tạo chiều sâu nghệ thuật cho không gian.'],
    ],
  },
  'prod-9': {
    tagline: 'Nordic Minimal Clock — thời gian trôi êm trên khối bê tông mộc.',
    items: [
      ['Bê tông đúc thủ công', 'Mỗi chiếc có lỗ khí và sắc độ riêng — vẻ thô mộc không chiếc nào giống chiếc nào.'],
      ['Kim trôi không tiếng động', 'Bộ máy Silent Sweep chạy êm, đặt phòng ngủ không làm phiền giấc ngủ.'],
      ['Kim đồng brass cổ điển', 'Đồng thau ngả màu trầm theo thời gian, càng dùng càng có nét vintage.'],
    ],
  },
  'prod-10': {
    tagline: 'Brass Candle Holder — ánh nến nhỏ cho những buổi tối hygge.',
    items: [
      ['Đồng thau kết hợp gỗ tần bì', 'Sắc vàng đồng ấm áp đặt trên khối gỗ sáng màu, sang trọng mà gần gũi.'],
      ['Cốc nến chống tràn sáp', 'Gờ hứng sáp giữ mặt bàn sạch sẽ, khối gỗ cách nhiệt bảo vệ bề mặt bên dưới.'],
      ['Phối nhóm đẹp hơn', 'Gom 2–3 chiếc trên khay gỗ hoặc dọc bàn ăn để tạo góc trang trí có nhịp điệu.'],
    ],
  },
  'prod-11': {
    tagline: 'Matte Arc Desk Lamp — ánh sáng ấm cho những đêm làm việc dài.',
    items: [
      ['Cần cong vươn xa', 'Chao vươn ra trước chiếu đúng vùng làm việc, đế đèn nằm gọn ở góc bàn.'],
      ['Ánh sáng 2700K dịu mắt', 'Bóng LED vàng ấm giảm ánh sáng xanh, đọc sách và làm việc buổi tối không mỏi mắt.'],
      ['Tương thích bóng E27', 'Thay bóng dimmer hoặc bóng thông minh dễ dàng theo nhu cầu.'],
    ],
  },
  'prod-12': {
    tagline: 'Chậu sen đá Mint — một khoảng xanh nhỏ xinh trên bàn làm việc.',
    items: [
      ['Cây khoẻ, đã thuần dưỡng', 'Sen đá ươm tại Đà Lạt, thuần dưỡng 2 tuần trong điều kiện trong nhà trước khi giao.'],
      ['Dễ chăm cho người bận rộn', 'Chỉ cần tưới 1 lần mỗi tuần, ánh sáng gián tiếp là đủ để cây phát triển.'],
      ['Men mint pastel dễ thương', 'Sắc xanh mint nhẹ nhàng hợp với bàn gỗ, bàn trắng và các phụ kiện pastel.'],
    ],
  },
  'prod-13': {
    tagline: 'Oak Tray — gom những điều nhỏ bé về một chỗ thật gọn gàng.',
    items: [
      ['Phay CNC từ gỗ sồi liền', 'Không ghép mảnh, thành khay liền lạc, bo góc mềm mại.'],
      ['An toàn thực phẩm', 'Lớp dầu phủ đạt chuẩn tiếp xúc thực phẩm, dùng bưng trà, bánh thoải mái.'],
      ['Mỗi khay một vân gỗ', 'Vân sồi tự nhiên khác nhau ở từng chiếc — món đồ mang dấu ấn riêng.'],
    ],
  },
  'prod-14': {
    tagline: 'Desk Set — mặt bàn gọn, đầu óc thoáng.',
    items: [
      ['Giá tai nghe đế nặng', 'Đế gỗ nặng chống đổ, móc bọc nỉ không làm hằn đệm tai nghe.'],
      ['Hộp bút gốm 3 ngăn', 'Chia ngăn cho bút, kéo, thước; đáy lót cao su chống trượt.'],
      ['Phối màu dễ hợp setup', 'Tông be – trắng hợp bàn gỗ sáng, bàn trắng hay setup tối giản màu đen.'],
    ],
  },
  'prod-15': {
    tagline: 'Aloe Pot — sắc xanh bền bỉ trong chiếc chậu xi măng tối giản.',
    items: [
      ['Nha đam lọc không khí', 'Cây mọng nước giúp cải thiện chất lượng không khí, chịu hạn và ít sâu bệnh.'],
      ['Chậu xi măng chống thấm', 'Lớp chống thấm bên trong và lỗ thoát nước giúp rễ thoáng khí, không úng.'],
      ['Gần như không cần chăm', 'Tưới 10–14 ngày một lần — hợp với người hay đi công tác, du lịch.'],
    ],
  },
  'prod-16': {
    tagline: 'Pendant Lamp — vùng sáng ấm cho bữa cơm sum vầy.',
    items: [
      ['Dáng chuông Bắc Âu kinh điển', 'Thiết kế vượt thời gian, hợp phòng ăn, quầy bar và đảo bếp.'],
      ['Ánh sáng tập trung', 'Lòng chao lót trắng phản xạ ánh sáng xuống mặt bàn, không chói lên trần.'],
      ['Điều chỉnh độ cao', 'Dây treo bọc vải dài 1.2m, tuỳ chỉnh theo chiều cao trần và mặt bàn.'],
    ],
  },
  'prod-17': {
    tagline: 'Ceramic Tray — nơi nghỉ ngơi cho những món đồ nhỏ thân thương.',
    items: [
      ['Men mộc thủ công', 'Lộ chất đất nung và đốm sắt tự nhiên, mỗi khay một sắc độ riêng.'],
      ['Lòng khay nông tiện dụng', 'Lấy nhẫn, bông tai, chìa khoá dễ dàng, không phải mò tìm.'],
      ['Tinh thần trà đạo Nhật', 'Mộc mạc, khiêm nhường, hợp bàn trang điểm, kệ phòng tắm và lối vào.'],
    ],
  },
  'prod-18': {
    tagline: 'Astro Buddy — chú phi hành gia nhỏ ngồi nghỉ trên kệ sách của bạn.',
    items: [
      ['In 3D độ phân giải 0.12mm', 'Chi tiết mũ, ba lô dưỡng khí và tư thế ngồi được tạc rõ nét.'],
      ['Hoàn thiện thủ công 3 lớp', 'Chà nhám, sơn lót và sơn phủ mờ bằng tay, bề mặt mịn không thấy vân in.'],
      ['Ngồi được ở mọi mép kệ', 'Tư thế ngồi thả chân giúp Astro Buddy "ngồi" trên mép kệ, chồng sách hay cạnh màn hình.'],
    ],
  },
  'prod-19': {
    tagline: 'Bonsai mini men rêu — nghệ thuật kiên nhẫn trong lòng bàn tay.',
    items: [
      ['Tạo dáng bởi nghệ nhân', 'Cây được tỉa và uốn dáng sẵn theo thế trực hoặc thế nghiêng.'],
      ['Chậu men rêu thoát nước tốt', 'Lỗ thoát lớn kèm lưới chắn đất, hạn chế úng rễ.'],
      ['Từ nhà vườn ba thế hệ', 'Hợp tác cùng nhà vườn bonsai tại Huế, chăm sóc cây theo phương pháp truyền thống.'],
    ],
  },
  'prod-20': {
    tagline: 'Bình cỏ pampas gốm nâu — mùa thu dịu dàng trong phòng khách.',
    items: [
      ['Cỏ pampas chống rụng', 'Sấy khô tự nhiên và xử lý chống rụng lông, giữ dáng bông xù tới 2–3 năm.'],
      ['Bình gốm làm tay', 'Men nâu đất dáng thon, đủ nặng để giữ bó cỏ cao 38cm đứng vững.'],
      ['Không cần tưới, không héo', 'Trang trí thiên nhiên dành cho người bận rộn hay đi xa.'],
    ],
  },
  'prod-21': {
    tagline: 'Khung tranh Typography gỗ sồi — những câu chữ nhỏ cho một ngôi nhà ấm.',
    items: [
      ['In mỹ thuật bền màu', 'Giấy 250gsm, mực pigment bền màu tới 50 năm, không ố vàng.'],
      ['Khung gỗ sồi viền mảnh', 'Viền 2cm tinh tế, để câu chữ là nhân vật chính.'],
      ['Treo tường hoặc đặt kệ', 'Kèm móc treo ngang và chân đứng gấp; thay tranh nhanh nhờ ghim xoay.'],
    ],
  },
  'prod-22': {
    tagline: 'Sofa nhung Verde — sắc xanh khu vườn giữa phòng khách hiện đại.',
    items: [
      ['Đệm ngồi 3 lớp êm ái', 'Lò xo túi độc lập, mút D40 và bông gòn phủ: êm khi ngồi xuống, nâng đỡ tốt khi ngồi lâu.'],
      ['Nhung chống bám lông thú cưng', 'Sợi nhung ngắn hạn chế bám lông, chống thấm nhẹ, lau sạch vết bẩn bằng khăn ẩm.'],
      ['Khung gỗ bảo hành 5 năm', 'Gỗ thông sấy đạt chuẩn, liên kết mộng và vít, kiểm tra 27 điểm chất lượng trước khi giao.'],
    ],
  },
  'prod-23': {
    tagline: 'Giường Lune — tĩnh lặng như ánh trăng, ấm áp như vòng tay.',
    items: [
      ['Đầu giường chần nút cổ điển', 'Bọc linen pha bông, chần nút kim cương thủ công, tựa lưng đọc sách êm ái.'],
      ['Gầm cao 25cm tiện dụng', 'Dễ lau dọn và tận dụng không gian để hộp lưu trữ.'],
      ['Dát giường thoáng khí', '14 thanh gỗ thông có khe hở giúp nệm thông thoáng, không ẩm mốc.'],
    ],
  },
  'prod-24': {
    tagline: 'Bàn ăn Nordic 6 chỗ — nơi cả nhà quây quần mỗi ngày.',
    items: [
      ['Mặt gỗ sồi dày 3cm', 'Ghép thanh xử lý cân bằng ẩm, chắc chắn và ổn định theo thời gian.'],
      ['An toàn thực phẩm', 'Phủ 3 lớp dầu lau gốc thực vật, đặt thức ăn trực tiếp không lo hoá chất.'],
      ['Rộng rãi cho 6 người', 'Chân vát ra ngoài tạo khoảng để chân thoải mái, dùng làm bàn làm việc lớn cũng rất hợp.'],
    ],
  },
  'prod-25': {
    tagline: 'Armchair vải dạ — chiếc ghế "của riêng mình" trong mỗi ngôi nhà.',
    items: [
      ['Lưng cong ôm người', 'Đường cong theo cột sống và tay vịn liền khối mang lại cảm giác được nâng đỡ trọn vẹn.'],
      ['Vừa vóc dáng người Việt', 'Kích thước được tinh chỉnh cho chiều cao trung bình, ngồi chạm sàn thoải mái.'],
      ['Vải dạ dày dặn', 'Giữ ấm nhẹ trong phòng máy lạnh, bề mặt mềm, ít xù lông.'],
    ],
  },
  'prod-26': {
    tagline: 'Tủ quần áo Walden — giản dị, bền bỉ và luôn ngăn nắp.',
    items: [
      ['MDF lõi xanh chống ẩm', 'Phủ veneer óc chó, cạnh dán chỉ ABS dày chống bong tróc trong môi trường ẩm.'],
      ['Bản lề giảm chấn Hafele', 'Cánh tủ đóng êm, không va đập, bền bỉ qua hàng chục nghìn lần đóng mở.'],
      ['Ngăn linh hoạt 5 nấc', 'Điều chỉnh độ cao ngăn xếp theo lượng quần áo, túi xách, chăn gối.'],
    ],
  },
  'prod-27': {
    tagline: 'Bookend Sóng — giữ những cuốn sách yêu thích luôn đứng ngay ngắn.',
    items: [
      ['Đế nặng chứa cát thạch anh', 'Mỗi chiếc nặng khoảng 210g, giữ vững hàng sách dài 30–40cm.'],
      ['Ghép đôi thành một con sóng', 'Hai chiếc đặt đối diện tạo thành con sóng liền mạch ôm lấy hàng sách.'],
      ['Chống trượt, không để vết', 'Đế cao su non bám tốt trên kệ gỗ và kính, không để lại vết bẩn.'],
    ],
  },
};

// Hướng dẫn bảo quản theo nhóm sản phẩm.
const CARE = {
  light: '• Lau vỏ đèn bằng khăn khô mềm, không dùng cồn hay chất tẩy.\n• Rút nguồn/tắt đèn khi lau chùi hoặc thay bóng.\n• Tránh đặt nơi ẩm ướt, gần nguồn nhiệt hoặc ánh nắng gắt kéo dài.',
  vase: '• Thay nước mỗi 2–3 ngày khi cắm hoa tươi, rửa bình bằng nước ấm và xà phòng nhẹ.\n• Tránh va đập mạnh và thay đổi nhiệt độ đột ngột.\n• Lau bụi bên ngoài bằng khăn mềm hơi ẩm.',
  print3d: '• Lau bụi bằng khăn microfiber hoặc cọ mềm, không dùng khăn giấy thô dễ gây xước.\n• Tránh để gần nguồn nhiệt trên 55°C (cốp xe, cạnh bếp) và nắng gắt trực tiếp.\n• Không ngâm nước lâu với sản phẩm PLA; bản PETG có thể rửa nhẹ bằng nước mát.',
  plant: '• Tưới khi đất khô hẳn, đổ bỏ nước thừa trong đĩa lót sau 15 phút.\n• Đặt nơi có ánh sáng gián tiếp, mang ra chỗ có nắng nhẹ 1–2 lần mỗi tuần.\n• Lau chậu bằng khăn ẩm; bón phân tan chậm 2–3 tháng một lần.',
  desk: '• Lau bằng khăn mềm hơi ẩm rồi lau khô lại ngay.\n• Tránh để vật sắc nhọn cào lên bề mặt và tránh ánh nắng gắt kéo dài.\n• Với chi tiết kim loại, thỉnh thoảng lau bằng khăn khô để giữ độ sáng.',
  wall: '• Kiểm tra vít và tải trọng định kỳ, không đặt quá tải trọng khuyến nghị.\n• Lau bụi bằng khăn khô mềm, tránh hoá chất tẩy rửa mạnh.\n• Treo tránh khu vực ẩm thấp hoặc tường thường xuyên bị thấm.',
  furniture: '• Lau bằng khăn mềm vắt kỹ theo chiều vân gỗ, sau đó lau khô.\n• Dùng lót ly cho đồ nóng/lạnh, tránh đặt gần cửa sổ nắng gắt hoặc điều hoà thổi trực tiếp.\n• 6–12 tháng thoa lại một lớp dầu lau gỗ để giữ độ ẩm và màu sắc.',
  bigFurniture: '• Hút bụi phần vải bọc mỗi tuần, xử lý vết bẩn ngay bằng khăn ẩm và dung dịch trung tính.\n• Tránh ánh nắng chiếu trực tiếp làm phai màu vải và gỗ.\n• Kiểm tra, siết lại ốc liên kết sau 6 tháng sử dụng; liên hệ Luméa để được bảo trì.',
};

/** Ghép mô tả nhiều phần theo bố cục trang sản phẩm nội thất. */
function composeDescription(product, content) {
  const h = HIGHLIGHTS[product.id];
  const [intro, ...rest] = content.description.split('\n\n');
  const structure = rest.join('\n\n');
  const care = CARE[content.kind];
  const isFurniture = product.categoryGroup === 'FURNITURE' && product.productionType === 'READY_STOCK';
  const promises = [
    '• Miễn phí giao hàng cho đơn từ 500.000₫, kiểm tra hàng trước khi nhận.',
    isFurniture ? '• Giao và lắp đặt tận nơi miễn phí nội thành TP.HCM.' : '• Đóng gói chống sốc nhiều lớp cho từng sản phẩm.',
    '• Đổi trả trong 7 ngày nếu lỗi sản xuất, hư hỏng khi vận chuyển hoặc giao sai mẫu.',
    '• Bảo hành 12 tháng, tra cứu bảo hành trực tuyến bằng mã phiếu.',
  ];
  const sizes = (product.customization?.sizes || []).map(s => `• ${s.label}: ${s.dimensions}`);
  const specs = [
    product.dimensions && `Kích thước phủ bì: ${product.dimensions}`,
    ...(sizes.length ? ['Các kích thước có sẵn:', ...sizes] : []),
    product.weight && `Khối lượng: ${product.weight}`,
    product.materialInfo && `Vật liệu: ${product.materialInfo}`,
    product.printTechnology && `Công nghệ in: ${product.printTechnology}`,
    product.productionType === 'PRINT_ON_DEMAND' && `Thời gian sản xuất: ${product.productionTime || '2–4 ngày'} (in theo đơn)`,
  ].filter(Boolean);

  return [
    h?.tagline,
    intro,
    h && ['ĐẶC ĐIỂM NỔI BẬT', ...h.items.map(([title, text]) => `▸ ${title}\n${text}`)].join('\n\n'),
    structure && `CẤU TẠO – CÔNG NĂNG\n${structure}`,
    `KÍCH THƯỚC – VẬT LIỆU\n${specs.join('\n')}`,
    care && `HƯỚNG DẪN BẢO QUẢN\n${care}`,
    `CAM KẾT TỪ LUMÉA\n${promises.join('\n')}`,
  ].filter(Boolean).join('\n\n');
}

// File mô hình 3D thật (GLB) gán cho sản phẩm — đặt trong projects/my-client/src/assets/models/products/
// (nguồn & giấy phép: CREDITS.md cùng thư mục). Sản phẩm khác dùng threeModelType hoặc chưa có 3D.
const MODEL_URLS = {
  'prod-22': 'assets/models/products/glam-velvet-sofa.glb',
  'prod-25': 'assets/models/products/sheen-chair.glb',
  // Chuyển từ file 3ds Max AT120.max của Luméa (nhóm tủ hồ sơ HR1800) — xem CREDITS.md.
  'prod-26': 'assets/models/products/tu-ho-so-hr1800.glb',
  // Bàn SV1400HL ráp lại từ các tấm trong AT120.max (vách chân, hộc, mặt bàn) — xem CREDITS.md.
  'prod-28': 'assets/models/products/ban-lam-viec-sv1400hl.glb',
};

// Nội dung cho sản phẩm bổ sung (products-extra.js).
CONTENT['prod-28'] = {
  kind: 'furniture', space: 'desk',
  // Gallery chỉ dùng ảnh render từ chính mô hình — không chèn ảnh không gian của bàn khác.
  noSpaceImages: true,
  description: 'Bàn làm việc 1m4 mặt gỗ sồi, hộc liền bên phải gồm 1 ngăn kéo và 1 tủ cánh có khoá, vách yếm che chân kín đáo — gọn gàng cho văn phòng lẫn góc làm việc tại nhà.\n\nMặt bàn dày 25mm rộng 1394 × 700mm, đủ chỗ cho màn hình đôi, laptop và tài liệu. Hai vách chân dày 18mm liên kết với vách yếm bằng ốc cam âm, giúp bàn đứng vững không rung lắc khi gõ phím. Hộc liền cao 440mm: ngăn kéo trên đựng bút, sổ; tủ cánh dưới có khoá cất hồ sơ quan trọng.\n\nLỗ luồn dây Ø60mm có nắp nhựa gọn gàng, bốn chân đệm chỉnh cao bù độ lệch sàn. Bàn giao dạng tháo rời, đội Luméa lắp đặt tận nơi trong khoảng 30 phút.',
  story: 'Một chiếc bàn làm việc tốt là chiếc bàn bạn không phải nghĩ tới: đủ rộng, đủ chắc, và mọi thứ cần dùng luôn trong tầm tay.\n\nMẫu bàn này được Luméa dựng 3D từ bản vẽ thật của xưởng — bạn có thể xoay, phóng to và đổi màu gỗ ngay trong phòng 3D trước khi đặt mua.',
  features: ['Mặt bàn dày 25mm, rộng 1394 × 700mm', 'Ốc cam âm liên kết chắc chắn', 'Tủ cánh có khoá cất hồ sơ', 'Lắp đặt tận nơi trong 30 phút'],
  reviews: [['Khánh Duy', 5, '12/10/2026', 'Bàn chắc, hộc có khoá rất tiện cất giấy tờ. Xem trong phòng 3D trước rồi mới đặt, nhận hàng đúng y như vậy.', true]],
};
HIGHLIGHTS['prod-28'] = {
  tagline: 'Bàn làm việc gỗ sồi 1m4 — gọn gàng, chắc chắn, mọi thứ trong tầm tay.',
  items: [
    ['Hộc liền tiện dụng', 'Ngăn kéo trên cho đồ dùng nhỏ, tủ cánh dưới có khoá cho hồ sơ — không cần mua thêm tủ hộc rời.'],
    ['Kết cấu vững chãi', 'Vách chân 18mm, vách yếm và ốc cam âm giữ bàn đứng vững, không rung khi gõ phím hay đặt màn hình lớn.'],
    ['Đi dây gọn gàng', 'Lỗ luồn dây có nắp trên mặt bàn giúp dây sạc, dây màn hình đi xuống gọn, mặt bàn luôn thoáng.'],
  ],
};

function hashIndex(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Đánh giá mẫu của 1 sản phẩm: đánh giá riêng + đánh giá chung theo nhóm, ngày giảm dần. */
function reviewsFor(productId, content) {
  const seed = hashIndex(productId);
  const space = SPACE[content.space];
  const own = (content.reviews || []).map(([author, rating, date, comment, withImages], i) => ({
    id: `${productId}-xrev-own-${i + 1}`,
    author, avatar: AVATARS[(seed + i) % AVATARS.length], rating, date, comment,
    verifiedPurchase: true,
    ...(withImages ? { images: [img(space[i % space.length], 600)] } : {}),
    ...(i === 0 && rating === 5 ? { pinned: true } : {}),
  }));

  // Ngày của đánh giá chung: lùi dần từ 15/09/2026, cách nhau 4–9 ngày.
  let day = new Date('2026-09-15T00:00:00Z').getTime();
  const pool = REVIEW_POOL[content.kind].map(([rating, comment, withImages, reply], i) => {
    day -= (4 + ((seed + i) % 6)) * 24 * 3600 * 1000;
    const d = new Date(day);
    const date = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    const replyDate = new Date(day + 24 * 3600 * 1000);
    return {
      id: `${productId}-xrev-${i + 1}`,
      author: REVIEWERS[(seed + i * 3) % REVIEWERS.length],
      avatar: AVATARS[(seed + i + 2) % AVATARS.length],
      rating, date, comment,
      verifiedPurchase: (seed + i) % 5 !== 0,
      ...(withImages ? { images: [img(space[(seed + i) % space.length], 600), img(space[(seed + i + 1) % space.length], 600)] } : {}),
      ...(reply ? { reply: { text: reply, date: `${String(replyDate.getUTCDate()).padStart(2, '0')}/${String(replyDate.getUTCMonth() + 1).padStart(2, '0')}/${replyDate.getUTCFullYear()}` } } : {}),
    };
  });
  return [...own, ...pool];
}

/**
 * Gộp nội dung mở rộng vào 1 sản phẩm (không sửa object gốc). Trả về sản phẩm mới, hoặc chính nó nếu
 * không có nội dung mở rộng. Chạy lại nhiều lần cho cùng kết quả.
 */
function enrichProduct(product) {
  const content = CONTENT[product.id];
  if (!content) return product;
  const modelUrl = product.modelUrl || MODEL_URLS[product.id] || null;

  const longer = (current, next) => (next && next.length > (current || '').length ? next : current || '');
  const union = (current, extra, keyOf = x => x) => {
    const seen = new Set((current || []).map(keyOf));
    return [...(current || []), ...extra.filter(x => !seen.has(keyOf(x)))];
  };

  const spaceImages = content.noSpaceImages ? [] : SPACE[content.space].map(id => img(id, 1000));
  const reviews = union(product.reviews, reviewsFor(product.id, content), r => r.id);
  const rating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : product.rating;

  return {
    ...product,
    description: longer(product.description, composeDescription(product, content)),
    story: longer(product.story, content.story),
    features: union(product.features, content.features),
    images: union(product.images, spaceImages, u => u.split('?')[0]),
    reviews,
    rating,
    reviewCount: Math.max(product.reviewCount || 0, reviews.length),
    ...(modelUrl ? { modelUrl } : {}),
  };
}

module.exports = { enrichProduct, CONTENT };
