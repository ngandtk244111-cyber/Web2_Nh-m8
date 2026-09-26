import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../../components/icon/icon.component';

interface AboutValue {
  icon: string;
  title: string;
  text: string;
}

interface AboutCard {
  image: string;
  eyebrow: string;
  title: string;
  cta: string;
  link: string;
}

/** Trang "Về Luméa" — bố cục tham khảo trang Our Story của Castlery:
 *  câu tuyên ngôn → điều khác biệt → video → 3 thẻ dẫn sang các khu vực khác của web. */
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent {
  playing = false;

  readonly video = {
    mp4: 'assets/promo-banner/customizer-placeholder.mp4',
    webm: 'assets/promo-banner/customizer-placeholder.webm',
    poster: 'assets/hero-banner/hero-print-3d.png',
  };

  readonly values: AboutValue[] = [
    {
      icon: 'cube',
      title: 'In 3D theo yêu cầu',
      text: 'Mỗi món đồ được in khi bạn đặt — đúng kích thước, đúng màu, không tồn kho dư thừa.',
    },
    {
      icon: 'sliders',
      title: 'Tùy biến tới từng chi tiết',
      text: 'Đổi màu, khắc chữ, thêm phụ kiện và xem trước ngay trên mô hình 3D trước khi đặt.',
    },
    {
      icon: 'sparkles',
      title: 'AI gợi ý decor',
      text: 'Chưa biết bắt đầu từ đâu? Trợ lý AI của Luméa gợi ý món đồ hợp với căn phòng và phong cách của bạn.',
    },
  ];

  readonly cards: AboutCard[] = [
    {
      image: 'assets/categories/3d-custom.png',
      eyebrow: 'Xưởng in 3D',
      title: 'Món đồ của riêng bạn, in từ ý tưởng',
      cta: 'Tạo sản phẩm riêng',
      link: '/custom-request/new',
    },
    {
      image: 'assets/home/shop-the-room-hero.jpg',
      eyebrow: 'Sản phẩm',
      title: 'Tìm món đồ bạn sẽ muốn giữ mãi',
      cta: 'Xem tất cả sản phẩm',
      link: '/catalog',
    },
    {
      image: 'assets/hero-banner/hero-print-3d.png',
      eyebrow: 'Tin tức & Mẹo sống',
      title: 'Mẹo decor, ý tưởng thiết kế và xu hướng mới',
      cta: 'Đọc bài viết',
      link: '/news',
    },
  ];
}
