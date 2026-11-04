export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  rating: number;
  active: boolean;
}

/** Danh sách mặc định khi chưa lưu cấu hình 'suppliers' lần nào. */
export const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', code: 'NCC-BAMBU', name: 'Công Ty CP Vật Liệu 3D Tech Bambu', contact: 'Nguyễn Văn Hùng', phone: '0912 345 678', email: 'hung.nguyen@bambumaterials.vn', address: 'KCN Cao Quận 9, TP.HCM', category: 'Cuộn sợi PLA, PETG, Resin in 3D', rating: 4.9, active: true },
  { id: 'sup-2', code: 'NCC-BATTRANG', name: 'Xưởng Gốm Thủ Công Bát Tràng Artisans', contact: 'Trần Thị Mai', phone: '0983 222 111', email: 'mai.art@battrangceramic.vn', address: 'Làng Cổ Bát Tràng, Gia Lâm, Hà Nội', category: 'Chân đèn gốm, chậu gốm tráng men', rating: 4.8, active: true },
  { id: 'sup-3', code: 'NCC-OAKWOOD', name: 'Xưởng Chế Tác Gỗ Sồi Tự Nhiên Mộc Xanh', contact: 'Lê Hoàng Long', phone: '0909 888 777', email: 'contact@mocxanhwood.com', address: 'Thuận An, Bình Dương', category: 'Đế đèn gỗ sồi, mặt bàn trà mini', rating: 4.7, active: true },
  { id: 'sup-4', code: 'NCC-LEDPHILIPS', name: 'Nhà Phân Phối Linh Kiện Chiếu Sáng Philips OEM', contact: 'Đỗ Minh Trí', phone: '0938 555 444', email: 'tri.do@lightingoem.vn', address: 'Đống Đa, Hà Nội', category: 'Mạch LED cảm ứng chạm, cáp Type-C', rating: 4.9, active: true },
];

export const DEFAULT_SHOWROOM_ADDRESS = 'Tầng 2, Tháp Design, 128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Quận 3, TP.HCM';
