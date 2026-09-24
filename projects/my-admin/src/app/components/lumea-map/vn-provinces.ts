/**
 * Tọa độ (gần đúng, lấy trung tâm hành chính) của các tỉnh/thành để đặt điểm trên bản đồ,
 * kèm alias để khớp địa chỉ nhập tự do (có/không dấu, viết tắt, quận/huyện nổi bật).
 * Ý tưởng tham khảo từ dashboard-vn-map của my-admin-vita, rút gọn cho nhu cầu của Luméa.
 */
export interface VnProvince {
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const VN_PROVINCES: VnProvince[] = [
  { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009, aliases: ['ho chi minh', 'hcm', 'sai gon', 'saigon', 'thu duc'] },
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, aliases: ['ha noi', 'hanoi', 'gia lam', 'dong da', 'ba dinh', 'cau giay', 'hoan kiem'] },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, aliases: ['da nang'] },
  { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881, aliases: ['hai phong'] },
  { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469, aliases: ['can tho'] },
  { name: 'Bình Dương', lat: 10.9804, lng: 106.6519, aliases: ['binh duong', 'thu dau mot', 'thuan an', 'di an'] },
  { name: 'Đồng Nai', lat: 10.9574, lng: 106.8427, aliases: ['dong nai', 'bien hoa'] },
  { name: 'Bà Rịa - Vũng Tàu', lat: 10.346, lng: 107.0843, aliases: ['vung tau', 'ba ria'] },
  { name: 'Long An', lat: 10.5359, lng: 106.4137, aliases: ['long an', 'tan an'] },
  { name: 'Tiền Giang', lat: 10.36, lng: 106.36, aliases: ['tien giang', 'my tho'] },
  { name: 'An Giang', lat: 10.3864, lng: 105.4352, aliases: ['an giang', 'long xuyen'] },
  { name: 'Kiên Giang', lat: 10.0125, lng: 105.0809, aliases: ['kien giang', 'rach gia', 'phu quoc'] },
  { name: 'Cà Mau', lat: 9.1769, lng: 105.15, aliases: ['ca mau'] },
  { name: 'Lâm Đồng', lat: 11.9404, lng: 108.4583, aliases: ['lam dong', 'da lat', 'dalat'] },
  { name: 'Khánh Hòa', lat: 12.2388, lng: 109.1967, aliases: ['khanh hoa', 'nha trang'] },
  { name: 'Bình Thuận', lat: 10.9289, lng: 108.1021, aliases: ['binh thuan', 'phan thiet'] },
  { name: 'Đắk Lắk', lat: 12.6667, lng: 108.05, aliases: ['dak lak', 'buon ma thuot'] },
  { name: 'Phú Yên', lat: 13.0882, lng: 109.0929, aliases: ['phu yen', 'tuy hoa'] },
  { name: 'Bình Định', lat: 13.7765, lng: 109.2237, aliases: ['binh dinh', 'quy nhon'] },
  { name: 'Quảng Ngãi', lat: 15.1205, lng: 108.7923, aliases: ['quang ngai'] },
  { name: 'Quảng Nam', lat: 15.5736, lng: 108.474, aliases: ['quang nam', 'hoi an', 'tam ky'] },
  { name: 'Thừa Thiên Huế', lat: 16.4637, lng: 107.5909, aliases: ['hue', 'thua thien'] },
  { name: 'Nghệ An', lat: 18.6796, lng: 105.6813, aliases: ['nghe an'] },
  { name: 'Thanh Hóa', lat: 19.8067, lng: 105.7852, aliases: ['thanh hoa'] },
  { name: 'Ninh Bình', lat: 20.2506, lng: 105.9745, aliases: ['ninh binh'] },
  { name: 'Nam Định', lat: 20.42, lng: 106.1683, aliases: ['nam dinh'] },
  { name: 'Thái Bình', lat: 20.4463, lng: 106.3366, aliases: ['thai binh'] },
  { name: 'Hưng Yên', lat: 20.6464, lng: 106.0511, aliases: ['hung yen'] },
  { name: 'Hải Dương', lat: 20.9373, lng: 106.3146, aliases: ['hai duong'] },
  { name: 'Bắc Ninh', lat: 21.1861, lng: 106.0763, aliases: ['bac ninh'] },
  { name: 'Vĩnh Phúc', lat: 21.3089, lng: 105.6049, aliases: ['vinh phuc'] },
  { name: 'Thái Nguyên', lat: 21.5942, lng: 105.8482, aliases: ['thai nguyen'] },
  { name: 'Quảng Ninh', lat: 20.9711, lng: 107.0448, aliases: ['quang ninh', 'ha long'] },
  { name: 'Lào Cai', lat: 22.4856, lng: 103.9707, aliases: ['lao cai', 'sa pa', 'sapa'] },
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

/** Tìm tỉnh/thành xuất hiện trong chuỗi địa chỉ; trả về null nếu không nhận ra. */
export function findProvince(address: string): VnProvince | null {
  const text = ` ${normalizeVn(address)} `;
  for (const p of VN_PROVINCES) {
    if (p.aliases.some(a => text.includes(` ${a} `))) return p;
  }
  return null;
}
