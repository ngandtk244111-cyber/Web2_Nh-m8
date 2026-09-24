import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface PolicySection {
  heading: string;
  body: string[];
}

interface PolicyPage {
  title: string;
  updatedAt: string;
  intro: string;
  sections: PolicySection[];
}

const POLICY_PAGES: Record<string, PolicyPage> = {
  'giao-hang': {
    title: 'Chính Sách Giao Hàng',
    updatedAt: '01/09/2026',
    intro: 'Luméa giao hàng toàn quốc thông qua các đối tác vận chuyển uy tín. Nội dung dưới đây áp dụng cho mọi đơn hàng đặt trên website.',
    sections: [
      {
        heading: '1. Phí vận chuyển',
        body: [
          'Miễn phí vận chuyển cho đơn hàng từ 500.000₫ trở lên.',
          'Đơn hàng dưới 500.000₫ áp dụng phí vận chuyển đồng giá 30.000₫ toàn quốc.',
        ],
      },
      {
        heading: '2. Thời gian xử lý & giao hàng',
        body: [
          'Sản phẩm có sẵn (READY_STOCK): đóng gói và bàn giao vận chuyển trong 1-2 ngày làm việc, thời gian giao dự kiến 2-4 ngày tuỳ khu vực.',
          'Sản phẩm in theo yêu cầu (PRINT_ON_DEMAND) hoặc tuỳ biến 3D: cần thêm thời gian sản xuất (xem mục "Thời gian sản xuất" trên trang chi tiết từng sản phẩm) trước khi bàn giao vận chuyển.',
          'Thời gian có thể kéo dài hơn vào các dịp cao điểm (Flash Sale, lễ, Tết).',
        ],
      },
      {
        heading: '3. Kiểm tra hàng khi nhận',
        body: [
          'Với đơn thanh toán khi nhận hàng (COD), quý khách được kiểm tra ngoại quan sản phẩm trước khi thanh toán cho nhân viên giao hàng.',
          'Nếu phát hiện sản phẩm bị móp méo, vỡ do vận chuyển, vui lòng từ chối nhận hàng hoặc chụp ảnh hiện trạng và liên hệ Luméa trong vòng 24 giờ để được hỗ trợ đổi/trả.',
        ],
      },
      {
        heading: '4. Theo dõi đơn hàng',
        body: [
          'Quý khách có thể tra cứu tiến độ đơn hàng bất kỳ lúc nào tại mục "Tra cứu đơn hàng" bằng mã đơn hàng đã nhận qua email/SMS.',
        ],
      },
    ],
  },
  'doi-tra': {
    title: 'Chính Sách Đổi Trả',
    updatedAt: '01/09/2026',
    intro: 'Vì phần lớn sản phẩm của Luméa được sản xuất/tuỳ biến theo đơn, chính sách đổi trả được áp dụng khác nhau tuỳ loại sản phẩm.',
    sections: [
      {
        heading: '1. Sản phẩm có sẵn (READY_STOCK)',
        body: [
          'Được đổi trả trong vòng 7 ngày kể từ khi nhận hàng nếu sản phẩm lỗi sản xuất, hư hỏng do vận chuyển, hoặc giao sai mẫu/màu so với đơn đặt.',
          'Sản phẩm đổi trả cần còn nguyên vẹn, chưa qua sử dụng, kèm ảnh/video tình trạng thực tế khi liên hệ.',
        ],
      },
      {
        heading: '2. Sản phẩm in theo yêu cầu & tuỳ biến 3D',
        body: [
          'Do được sản xuất riêng theo lựa chọn màu sắc/kích thước/khắc tên của từng khách hàng, các sản phẩm này chỉ được đổi/trả khi lỗi thuộc về sản xuất (in lỗi, sai thông số đã xác nhận), không áp dụng đổi trả vì lý do đổi ý.',
          'Trước khi sản xuất, đơn tuỳ biến sẽ được xác nhận lại thông tin với khách hàng để hạn chế sai sót.',
        ],
      },
      {
        heading: '3. Quy trình yêu cầu đổi trả',
        body: [
          'Liên hệ qua Trung tâm hỗ trợ (chat trên website) hoặc hotline 1800 6928, cung cấp mã đơn hàng và hình ảnh/video sản phẩm.',
          'Luméa phản hồi trong vòng 24-48 giờ làm việc và hướng dẫn gửi trả (nếu cần) hoặc lịch đổi mới.',
        ],
      },
      {
        heading: '4. Hoàn tiền',
        body: [
          'Hoàn tiền theo phương thức thanh toán ban đầu (chuyển khoản, ví MoMo/ZaloPay) hoặc quy đổi thành Xu Luméa theo yêu cầu của khách hàng, trong vòng 3-7 ngày làm việc kể từ khi yêu cầu được duyệt.',
        ],
      },
    ],
  },
  'thanh-toan': {
    title: 'Phương Thức Thanh Toán',
    updatedAt: '21/09/2026',
    intro: 'Luméa hỗ trợ nhiều phương thức thanh toán để quý khách lựa chọn khi đặt hàng tại trang Thanh Toán.',
    sections: [
      {
        heading: '1. Đang hỗ trợ',
        body: [
          'Thanh toán khi nhận hàng (COD) — kiểm tra sản phẩm trước khi thanh toán tiền mặt cho bưu tá.',
          'Chuyển khoản ngân hàng / VietQR — quét mã bằng app ngân hàng bất kỳ, xác nhận nhanh, không mất phí giao dịch.',
          'Ví MoMo — thanh toán qua cổng MoMo, chuyển hướng an toàn tới ứng dụng MoMo.',
          'Ví ZaloPay — thanh toán qua cổng ZaloPay, chuyển hướng an toàn tới ứng dụng ZaloPay.',
        ],
      },
      {
        heading: '2. Sắp ra mắt',
        body: [
          'Thẻ quốc tế Visa / Mastercard.',
          'Cổng thanh toán VNPay.',
          'Thẻ ATM nội địa / NAPAS.',
          'Các phương thức này hiện chưa được kích hoạt trên hệ thống — mục thanh toán tương ứng sẽ hiển thị nhãn "Chưa hỗ trợ" và tạm thời không thể chọn cho đến khi Luméa hoàn tất tích hợp.',
        ],
      },
      {
        heading: '3. Bảo mật thanh toán',
        body: [
          'Toàn bộ giao dịch chuyển khoản/ví điện tử được xử lý qua cổng thanh toán của đối tác (MoMo, ZaloPay, ngân hàng), Luméa không lưu trữ thông tin thẻ/tài khoản ngân hàng của khách hàng.',
        ],
      },
    ],
  },
  'bao-mat': {
    title: 'Chính Sách Bảo Mật',
    updatedAt: '01/09/2026',
    intro: 'Luméa tôn trọng và cam kết bảo vệ thông tin cá nhân của khách hàng khi sử dụng website.',
    sections: [
      {
        heading: '1. Thông tin thu thập',
        body: [
          'Họ tên, số điện thoại, địa chỉ giao hàng, email khi đặt hàng hoặc tạo tài khoản.',
          'Lịch sử đơn hàng, sản phẩm đã xem/yêu thích để cá nhân hoá trải nghiệm mua sắm.',
        ],
      },
      {
        heading: '2. Mục đích sử dụng',
        body: [
          'Xử lý và giao đơn hàng, liên hệ xác nhận khi cần thiết.',
          'Chăm sóc khách hàng, thông báo trạng thái đơn hàng, chương trình ưu đãi.',
          'Cải thiện chất lượng sản phẩm và dịch vụ dựa trên phản hồi/đánh giá.',
        ],
      },
      {
        heading: '3. Chia sẻ thông tin với bên thứ ba',
        body: [
          'Luméa không bán hoặc trao đổi thông tin cá nhân của khách hàng cho bên thứ ba vì mục đích thương mại.',
          'Thông tin giao hàng chỉ được chia sẻ với đơn vị vận chuyển, và thông tin đơn hàng chỉ được chia sẻ với cổng thanh toán (MoMo, ZaloPay, ngân hàng) ở mức cần thiết để hoàn tất giao dịch.',
        ],
      },
      {
        heading: '4. Quyền của khách hàng',
        body: [
          'Quý khách có quyền yêu cầu xem, chỉnh sửa hoặc xoá thông tin cá nhân đã cung cấp bằng cách liên hệ Trung tâm hỗ trợ hoặc hotline 1800 6928.',
        ],
      },
    ],
  },
  'dieu-khoan': {
    title: 'Điều Khoản Sử Dụng',
    updatedAt: '01/09/2026',
    intro: 'Khi truy cập và sử dụng website Luméa, quý khách đồng ý với các điều khoản dưới đây.',
    sections: [
      {
        heading: '1. Tài khoản',
        body: [
          'Khách hàng chịu trách nhiệm bảo mật thông tin đăng nhập của mình và các hoạt động phát sinh từ tài khoản đó.',
          'Luméa có quyền tạm ngưng tài khoản có dấu hiệu gian lận hoặc vi phạm điều khoản sử dụng.',
        ],
      },
      {
        heading: '2. Đặt hàng & thanh toán',
        body: [
          'Đơn hàng chỉ được xác nhận sau khi hệ thống ghi nhận đầy đủ thông tin giao hàng và phương thức thanh toán hợp lệ.',
          'Luméa có quyền từ chối hoặc huỷ đơn trong trường hợp phát hiện sai sót giá/thông tin hoặc nghi ngờ gian lận.',
        ],
      },
      {
        heading: '3. Nội dung do người dùng đăng tải',
        body: [
          'Hình ảnh, bài viết chia sẻ tại mục Cộng đồng do người dùng tự đăng tải và chịu trách nhiệm về nội dung, bản quyền hình ảnh của mình.',
          'Luméa có quyền gỡ bỏ nội dung vi phạm thuần phong mỹ tục, bản quyền hoặc chính sách cộng đồng.',
        ],
      },
      {
        heading: '4. Sở hữu trí tuệ',
        body: [
          'Toàn bộ hình ảnh sản phẩm, thiết kế, logo, nội dung trên website thuộc quyền sở hữu của Luméa, nghiêm cấm sao chép sử dụng cho mục đích thương mại khi chưa được cho phép.',
        ],
      },
    ],
  },
  'cookie': {
    title: 'Chính Sách Cookie',
    updatedAt: '01/09/2026',
    intro: 'Website Luméa sử dụng cookie và các công nghệ lưu trữ tương tự trên trình duyệt để vận hành và cải thiện trải nghiệm mua sắm.',
    sections: [
      {
        heading: '1. Cookie được sử dụng để làm gì',
        body: [
          'Ghi nhớ sản phẩm trong giỏ hàng giữa các lần truy cập.',
          'Duy trì phiên đăng nhập của khách hàng.',
          'Ghi nhớ sản phẩm đã xem gần đây để gợi ý phù hợp hơn.',
        ],
      },
      {
        heading: '2. Cookie của bên thứ ba',
        body: [
          'Luméa hiện không sử dụng cookie quảng cáo/theo dõi của bên thứ ba cho mục đích tiếp thị lại (retargeting).',
        ],
      },
      {
        heading: '3. Quản lý cookie',
        body: [
          'Quý khách có thể xoá hoặc chặn cookie trong cài đặt trình duyệt, tuy nhiên một số tính năng như giỏ hàng, đăng nhập có thể không hoạt động đầy đủ nếu cookie bị chặn.',
        ],
      },
    ],
  },
};

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './policy.component.html',
  styleUrl: './policy.component.css'
})
export class PolicyComponent implements OnInit {
  page: PolicyPage | undefined;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') || '';
      this.page = POLICY_PAGES[slug];
    });
  }
}
