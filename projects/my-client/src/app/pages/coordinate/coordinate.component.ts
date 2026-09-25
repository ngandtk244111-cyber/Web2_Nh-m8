import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { ProductService } from '../../core/services/product.service';
import { NewsService } from '../../core/services/news.service';
import { Product } from '../../core/models/product.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

const ACCESSORY_ROW_SIZE = 12;
const ACCESSORY_GROUP_COUNT = 5;

// Nội dung mock dùng chung cho mọi bộ phối đồ.
const HIGHLIGHTS = [
  { title: 'Bảng màu hài hòa', text: 'Chọn 2–3 tông chủ đạo (be, nâu gỗ, trắng ngà) rồi thêm một màu nhấn nhỏ để không gian có chiều sâu mà vẫn dịu mắt.' },
  { title: 'Chất liệu chạm vào là thích', text: 'Kết hợp bề mặt nhám của gốm, vân gỗ và nhựa in 3D mờ để tạo cảm giác ấm áp, tự nhiên.' },
  { title: 'Ánh sáng tầng lớp', text: 'Đèn bàn, đèn sàn và ánh sáng ban ngày đan xen giúp căn phòng đổi mood nhẹ nhàng từ sáng đến tối.' },
  { title: 'Điểm nhấn vừa đủ', text: 'Mỗi góc chỉ cần một món nổi bật; các món còn lại đóng vai trò làm nền, tránh cảm giác rối mắt.' },
];

const TIPS = [
  { title: 'Bắt đầu từ món lớn nhất', text: 'Xác định vị trí của đèn hoặc kệ trước, sau đó mới sắp các món nhỏ xung quanh theo tỉ lệ.' },
  { title: 'Xếp theo nhóm ba', text: 'Nhóm 3 món với chiều cao khác nhau cho cảm giác cân đối và tự nhiên hơn so với xếp thành hàng.' },
  { title: 'Chừa khoảng trống', text: 'Giữ 30–40% bề mặt để trống giúp từng món decor được nhìn rõ, không gian cũng thoáng hơn.' },
  { title: 'Lặp lại một chi tiết', text: 'Lặp một màu hoặc một chất liệu ở 2–3 vị trí khác nhau để cả căn phòng liền mạch.' },
  { title: 'Cá nhân hóa bằng món in 3D', text: 'Thay màu, khắc tên hoặc đổi kích thước món đồ để bộ phối đồ mang dấu ấn riêng của bạn.' },
];

const FAQS = [
  { q: 'Tôi có thể mua lẻ từng món trong bộ phối đồ không?', a: 'Có. Mọi sản phẩm trong bộ đều bán riêng, bạn bấm vào từng món để xem chi tiết và thêm vào giỏ.' },
  { q: 'Món đồ có đúng màu và kích thước như trong ảnh không?', a: 'Ảnh phối đồ mang tính minh họa không gian. Kích thước và chất liệu chính xác được ghi ở trang chi tiết từng sản phẩm.' },
  { q: 'Có thể tùy chỉnh màu sắc để hợp với phòng của tôi không?', a: 'Các món in 3D hỗ trợ tùy chỉnh màu và kích thước, bạn có thể thử ngay trong trang Tùy biến 3D.' },
  { q: 'Bao lâu thì tôi nhận được hàng?', a: 'Hàng có sẵn được giao trong vài ngày; món in theo yêu cầu cần thêm thời gian sản xuất ghi rõ ở từng sản phẩm.' },
];

@Component({
  selector: 'app-coordinate',
  standalone: true,
  imports: [CommonModule, RouterLink, VndPipe],
  templateUrl: './coordinate.component.html',
  styleUrl: './coordinate.component.css'
})
export class CoordinateComponent {
  private roomService = inject(RoomService);
  private productService = inject(ProductService);
  private newsService = inject(NewsService);
  private route = inject(ActivatedRoute);

  private readonly roomIdSignal = signal<string | null>(null);

  /** Cùng điều kiện với mục "Ý Tưởng Phối Đồ" ở trang chủ: phòng dựng sẵn có điểm sản phẩm. */
  readonly rooms = computed(() =>
    this.roomService.rooms().filter(r => r.roomType !== 'glb_scene' && r.hotspots.length > 0)
  );

  readonly room = computed(() => {
    const id = this.roomIdSignal();
    return this.rooms().find(r => r.id === id) ?? (id ? undefined : this.rooms()[0]);
  });

  readonly roomProducts = computed<Product[]>(() => {
    const room = this.room();
    return room ? this.roomService.getProductsInRoom(room) : [];
  });

  /** Phụ kiện gợi ý: sản phẩm ngoài bộ phối đồ, gom theo danh mục thành các hàng cuộn ngang có tiêu đề. */
  readonly accessoryGroups = computed<{ label: string; products: Product[] }[]>(() => {
    const used = new Set(this.roomProducts().map(p => p.id));
    const byCat = new Map<string, Product[]>();
    for (const p of this.productService.products()) {
      if (used.has(p.id)) continue;
      const list = byCat.get(p.categoryName) ?? [];
      list.push(p);
      byCat.set(p.categoryName, list);
    }
    return [...byCat.entries()]
      .map(([label, products]) => ({ label, products: products.slice(0, ACCESSORY_ROW_SIZE) }))
      .slice(0, ACCESSORY_GROUP_COUNT);
  });

  readonly relatedArticles = computed(() => this.newsService.articles().slice(0, 3));

  readonly otherRooms = computed(() => this.rooms().filter(r => r.id !== this.room()?.id));

  readonly tips = TIPS;
  readonly highlights = HIGHLIGHTS;
  readonly faqs = FAQS;

  constructor() {
    this.route.paramMap.subscribe(p => this.roomIdSignal.set(p.get('roomId')));
  }

  scrollRow(row: HTMLElement, dir: 1 | -1): void {
    row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: 'smooth' });
  }
}
