/**
 * Tọa độ (gần đúng, lấy trung tâm hành chính) của 63 tỉnh/thành để đặt điểm trên bản đồ,
 * kèm alias để khớp địa chỉ nhập tự do (có/không dấu, viết tắt, quận/huyện nổi bật).
 * Danh sách khớp với provinces.open-api.vn/api/p/ mà my-client dùng ở bước checkout,
 * nên mọi đơn đặt qua web đều nhận ra được tỉnh.
 * Ý tưởng tham khảo từ dashboard-vn-map của my-admin-vita, rút gọn cho nhu cầu của Luméa.
 */
export interface VnProvince {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const VN_PROVINCES: VnProvince[] = [
  // Đông Nam Bộ
  { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009, aliases: ['ho chi minh', 'hcm', 'sai gon', 'saigon', 'thu duc'] },
  { name: 'Bình Dương', lat: 10.9804, lng: 106.6519, aliases: ['binh duong', 'thu dau mot', 'thuan an', 'di an'] },
  { name: 'Đồng Nai', lat: 10.9574, lng: 106.8427, aliases: ['dong nai', 'bien hoa'] },
  { name: 'Bà Rịa - Vũng Tàu', lat: 10.346, lng: 107.0843, aliases: ['vung tau', 'ba ria'] },
  { name: 'Bình Phước', lat: 11.5349, lng: 106.8823, aliases: ['binh phuoc', 'dong xoai'] },
  { name: 'Tây Ninh', lat: 11.3352, lng: 106.1099, aliases: ['tay ninh'] },
  // Tây Nam Bộ
  { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469, aliases: ['can tho'] },
  { name: 'Long An', lat: 10.5359, lng: 106.4137, aliases: ['long an', 'tan an'] },
  { name: 'Tiền Giang', lat: 10.36, lng: 106.36, aliases: ['tien giang', 'my tho'] },
  { name: 'Bến Tre', lat: 10.2415, lng: 106.3759, aliases: ['ben tre'] },
  { name: 'Trà Vinh', lat: 9.9347, lng: 106.3453, aliases: ['tra vinh'] },
  { name: 'Vĩnh Long', lat: 10.2537, lng: 105.9722, aliases: ['vinh long'] },
  { name: 'Đồng Tháp', lat: 10.4938, lng: 105.6882, aliases: ['dong thap', 'cao lanh', 'sa dec'] },
  { name: 'An Giang', lat: 10.3864, lng: 105.4352, aliases: ['an giang', 'long xuyen', 'chau doc'] },
  { name: 'Kiên Giang', lat: 10.0125, lng: 105.0809, aliases: ['kien giang', 'rach gia', 'phu quoc'] },
  { name: 'Hậu Giang', lat: 9.7845, lng: 105.4701, aliases: ['hau giang', 'vi thanh'] },
  { name: 'Sóc Trăng', lat: 9.6025, lng: 105.9739, aliases: ['soc trang'] },
  { name: 'Bạc Liêu', lat: 9.2941, lng: 105.7278, aliases: ['bac lieu'] },
  { name: 'Cà Mau', lat: 9.1769, lng: 105.15, aliases: ['ca mau'] },
  // Tây Nguyên
  { name: 'Lâm Đồng', lat: 11.9404, lng: 108.4583, aliases: ['lam dong', 'da lat', 'dalat', 'bao loc'] },
  { name: 'Đắk Lắk', lat: 12.6667, lng: 108.05, aliases: ['dak lak', 'dac lac', 'buon ma thuot'] },
  { name: 'Đắk Nông', lat: 12.0046, lng: 107.6907, aliases: ['dak nong', 'gia nghia'] },
  { name: 'Gia Lai', lat: 13.9833, lng: 108.0, aliases: ['gia lai', 'pleiku'] },
  { name: 'Kon Tum', lat: 14.3498, lng: 108.0005, aliases: ['kon tum'] },
  // Duyên hải Nam Trung Bộ
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, aliases: ['da nang'] },
  { name: 'Quảng Nam', lat: 15.5736, lng: 108.474, aliases: ['quang nam', 'hoi an', 'tam ky'] },
  { name: 'Quảng Ngãi', lat: 15.1205, lng: 108.7923, aliases: ['quang ngai'] },
  { name: 'Bình Định', lat: 13.7765, lng: 109.2237, aliases: ['binh dinh', 'quy nhon'] },
  { name: 'Phú Yên', lat: 13.0882, lng: 109.0929, aliases: ['phu yen', 'tuy hoa'] },
  { name: 'Khánh Hòa', lat: 12.2388, lng: 109.1967, aliases: ['khanh hoa', 'nha trang', 'cam ranh'] },
  { name: 'Ninh Thuận', lat: 11.5675, lng: 108.9886, aliases: ['ninh thuan', 'phan rang'] },
  { name: 'Bình Thuận', lat: 10.9289, lng: 108.1021, aliases: ['binh thuan', 'phan thiet'] },
  // Bắc Trung Bộ
  { name: 'Thừa Thiên Huế', lat: 16.4637, lng: 107.5909, aliases: ['hue', 'thua thien'] },
  { name: 'Quảng Trị', lat: 16.7943, lng: 107.0451, aliases: ['quang tri', 'dong ha'] },
  { name: 'Quảng Bình', lat: 17.4689, lng: 106.6223, aliases: ['quang binh', 'dong hoi'] },
  { name: 'Hà Tĩnh', lat: 18.3428, lng: 105.9057, aliases: ['ha tinh'] },
  { name: 'Nghệ An', lat: 18.6796, lng: 105.6813, aliases: ['nghe an'] },
  { name: 'Thanh Hóa', lat: 19.8067, lng: 105.7852, aliases: ['thanh hoa'] },
  // Đồng bằng sông Hồng
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, aliases: ['ha noi', 'hanoi', 'gia lam', 'dong da', 'ba dinh', 'cau giay', 'hoan kiem'] },
  { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881, aliases: ['hai phong'] },
  { name: 'Ninh Bình', lat: 20.2506, lng: 105.9745, aliases: ['ninh binh'] },
  { name: 'Nam Định', lat: 20.42, lng: 106.1683, aliases: ['nam dinh'] },
  { name: 'Thái Bình', lat: 20.4463, lng: 106.3366, aliases: ['thai binh'] },
  { name: 'Hà Nam', lat: 20.5835, lng: 105.923, aliases: ['ha nam', 'phu ly'] },
  { name: 'Hưng Yên', lat: 20.6464, lng: 106.0511, aliases: ['hung yen'] },
  { name: 'Hải Dương', lat: 20.9373, lng: 106.3146, aliases: ['hai duong'] },
  { name: 'Bắc Ninh', lat: 21.1861, lng: 106.0763, aliases: ['bac ninh'] },
  { name: 'Vĩnh Phúc', lat: 21.3089, lng: 105.6049, aliases: ['vinh phuc', 'vinh yen'] },
  { name: 'Quảng Ninh', lat: 20.9711, lng: 107.0448, aliases: ['quang ninh', 'ha long'] },
  // Trung du & miền núi phía Bắc
  { name: 'Thái Nguyên', lat: 21.5942, lng: 105.8482, aliases: ['thai nguyen'] },
  { name: 'Bắc Giang', lat: 21.2731, lng: 106.1946, aliases: ['bac giang'] },
  { name: 'Phú Thọ', lat: 21.3227, lng: 105.4019, aliases: ['phu tho', 'viet tri'] },
  { name: 'Hòa Bình', lat: 20.8172, lng: 105.3376, aliases: ['hoa binh'] },
  { name: 'Lạng Sơn', lat: 21.8537, lng: 106.7615, aliases: ['lang son'] },
  { name: 'Cao Bằng', lat: 22.6657, lng: 106.2577, aliases: ['cao bang'] },
  { name: 'Bắc Kạn', lat: 22.147, lng: 105.8348, aliases: ['bac kan', 'bac can'] },
  { name: 'Tuyên Quang', lat: 21.8233, lng: 105.214, aliases: ['tuyen quang'] },
  { name: 'Hà Giang', lat: 22.8233, lng: 104.9836, aliases: ['ha giang'] },
  { name: 'Yên Bái', lat: 21.7229, lng: 104.9113, aliases: ['yen bai'] },
  { name: 'Lào Cai', lat: 22.4856, lng: 103.9707, aliases: ['lao cai', 'sa pa', 'sapa'] },
  { name: 'Sơn La', lat: 21.3256, lng: 103.9188, aliases: ['son la'] },
  { name: 'Điện Biên', lat: 21.386, lng: 103.023, aliases: ['dien bien'] },
  { name: 'Lai Châu', lat: 22.3964, lng: 103.4582, aliases: ['lai chau'] },
];

/** Bỏ dấu, chữ thường, gom khoảng trắng — để so khớp địa chỉ nhập tự do. */
export function normalizeVn(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Tìm tỉnh/thành xuất hiện trong chuỗi địa chỉ; trả về null nếu không nhận ra.
 * Địa chỉ VN ghi tỉnh ở cuối, nên ưu tiên alias khớp ở vị trí sau cùng —
 * tránh nhầm tên đường như "Xa lộ Hà Nội, Thủ Đức" hay "Phố Huế, Hà Nội".
 */
export function findProvince(address: string): VnProvince | null {
  const text = ` ${normalizeVn(address)} `;
  let best: VnProvince | null = null;
  let bestPos = -1;
  for (const p of VN_PROVINCES) {
    for (const a of p.aliases) {
      const pos = text.lastIndexOf(` ${a} `);
      if (pos > bestPos) { best = p; bestPos = pos; }
    }
  }
  return best;
}
