/** Video chủ đề hiển thị ở trang chủ my-client — nhân viên đăng/sửa qua tab Video. */
export interface Video {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  poster: string;
  link: string;
  ctaLabel: string;
  active: boolean;
  order: number;
  createdAt?: string;
}
