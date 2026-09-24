import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../components/icon/icon.component';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

/** Nội dung tổng hợp lại từ các trang chính sách hiện có (giao hàng/đổi trả/thanh toán)
 *  và diễn giải ngắn gọn hơn cho định dạng accordion — không phát sinh chính sách mới.
 *  Chia sẵn thành 2 cột độc lập để khi mở 1 câu trả lời, cột kia không bị đẩy/xáo trộn. */
const FAQ_LEFT_COLUMN: FaqCategory[] = [
  {
    title: 'Đặt hàng & Thanh toán',
    items: [
      {
        id: 'order-1',
        question: 'Làm thế nào để đặt hàng trực tuyến?',
        answer: 'Bạn chỉ cần bấm vào nút "Mua ngay" hoặc "Thêm vào giỏ hàng" ở sản phẩm muốn chọn. Khi đã sẵn sàng, nhấn vào biểu tượng giỏ hàng ở góc trên bên phải màn hình và làm theo hướng dẫn để đăng nhập/đăng ký tài khoản và hoàn tất thanh toán.',
      },
      {
        id: 'order-2',
        question: 'Có những hình thức thanh toán trực tuyến nào?',
        answer: 'Luméa hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng/VietQR, ví MoMo và ví ZaloPay. Bạn có thể chọn phương thức phù hợp ở bước thanh toán.',
      },
      {
        id: 'order-3',
        question: 'Tôi có thể thay đổi hoặc hủy đơn hàng sau khi đã đặt không?',
        answer: 'Với sản phẩm có sẵn, bạn có thể liên hệ hotline 1800 6928 để thay đổi hoặc hủy đơn trước khi đơn được bàn giao cho đơn vị vận chuyển. Sản phẩm in theo yêu cầu hoặc đã tuỳ biến 3D không thể hủy sau khi đã bắt đầu in.',
      },
      {
        id: 'order-4',
        question: 'Xu Luméa là gì và dùng để làm gì?',
        answer: 'Xu Luméa là điểm thưởng tích luỹ khi mua sắm hoặc tham gia hoạt động trên Luméa (ví dụ hoàn thành Trắc Nghiệm Phong Cách). Xu có thể dùng để giảm trừ trực tiếp vào giá trị đơn hàng khi thanh toán tại Giỏ hàng.',
      },
    ],
  },
  {
    title: 'Đổi trả & Bảo hành',
    items: [
      {
        id: 'return-1',
        question: 'Chính sách đổi trả sản phẩm áp dụng như thế nào?',
        answer: 'Sản phẩm có sẵn được đổi trả trong 7 ngày nếu lỗi sản xuất, hư hỏng khi vận chuyển hoặc giao sai mẫu. Sản phẩm in theo yêu cầu hoặc tuỳ biến 3D chỉ đổi trả khi lỗi thuộc về sản xuất, không áp dụng vì lý do đổi ý.',
      },
      {
        id: 'return-2',
        question: 'Sản phẩm bị nứt, vỡ khi nhận hàng thì tôi phải làm gì?',
        answer: 'Vui lòng quay video lúc mở hộp và chụp ảnh sản phẩm, sau đó liên hệ Luméa trong vòng 48 giờ kể từ khi nhận hàng. Chúng tôi sẽ in lại hoặc đổi mới sản phẩm miễn phí cho bạn.',
      },
      {
        id: 'return-3',
        question: 'Làm sao để tra cứu thông tin bảo hành?',
        answer: 'Vào mục "Tra cứu bảo hành" và nhập mã đơn hàng hoặc số điện thoại đặt hàng để xem thời hạn và tình trạng bảo hành của từng sản phẩm.',
      },
    ],
  },
];

const FAQ_RIGHT_COLUMN: FaqCategory[] = [
  {
    title: 'Vận chuyển & Giao hàng',
    items: [
      {
        id: 'ship-1',
        question: 'Thời gian giao hàng mất bao lâu?',
        answer: 'Sản phẩm có sẵn thường được giao trong 2-4 ngày làm việc tuỳ khu vực. Với sản phẩm in theo yêu cầu, thời gian giao sẽ cộng thêm thời gian sản xuất (thường 2-5 ngày) được ghi rõ trên trang chi tiết sản phẩm.',
      },
      {
        id: 'ship-2',
        question: 'Phí vận chuyển được tính như thế nào?',
        answer: 'Miễn phí vận chuyển cho đơn hàng từ 500.000₫ trở lên. Đơn dưới 500.000₫ áp dụng phí đồng giá 30.000₫ toàn quốc.',
      },
      {
        id: 'ship-3',
        question: 'Làm thế nào để tôi theo dõi tiến trình đơn hàng?',
        answer: 'Vào mục "Tra cứu đơn hàng" và nhập mã đơn hàng, hoặc xem trong "Tài khoản của tôi → Đơn Hàng Của Tôi" nếu bạn đã đăng nhập khi đặt hàng.',
      },
    ],
  },
  {
    title: 'Tuỳ biến & In 3D',
    items: [
      {
        id: 'custom-1',
        question: 'Sản phẩm nào có thể tuỳ biến 3D?',
        answer: 'Chỉ những sản phẩm được đánh dấu "Có thể tùy biến" (hiển thị nút Tuỳ biến 3D trên trang chi tiết) mới hỗ trợ đổi màu, chất liệu, kích thước hoặc khắc tên.',
      },
      {
        id: 'custom-2',
        question: 'Tôi có thể xem trước mô hình 3D trước khi mua không?',
        answer: 'Với các sản phẩm có gắn nhãn "Xem 3D", bạn có thể xoay và phóng to mô hình 3D ngay trên trang chi tiết sản phẩm trước khi đặt hàng hoặc tuỳ biến.',
      },
    ],
  },
  {
    title: 'Tư vấn',
    items: [
      {
        id: 'advice-1',
        question: 'Tôi muốn tư vấn thêm về kích thước và phối màu nội thất thì làm sao?',
        answer: 'Bạn có thể trò chuyện với Trợ Lý AI của Luméa, dùng khung chat hỗ trợ trực tuyến ở góc màn hình hoặc gọi hotline 1800 6928. Đội ngũ Luméa sẽ gợi ý kích thước và bảng màu phù hợp với không gian của bạn.',
      },
      {
        id: 'advice-2',
        question: 'Tôi muốn đặt một mẫu decor riêng, chưa có sẵn trên website?',
        answer: 'Hãy gửi yêu cầu tại mục "Thiết kế riêng", mô tả ý tưởng kèm ảnh tham khảo. Đội ngũ Luméa sẽ phản hồi báo giá và thời gian sản xuất cho bạn.',
      },
    ],
  },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.css'
})
export class FaqComponent {
  readonly columns: FaqCategory[][] = [FAQ_LEFT_COLUMN, FAQ_RIGHT_COLUMN];

  private openIds: { [key: string]: boolean } = {};

  toggle(id: string): void {
    this.openIds[id] = !this.openIds[id];
  }

  isOpen(id: string): boolean {
    return !!this.openIds[id];
  }
}
