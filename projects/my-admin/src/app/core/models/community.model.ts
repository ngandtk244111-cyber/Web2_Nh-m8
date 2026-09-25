export interface ProductTag {
  productId: string;
  xPercent: number; // 0 - 100% position on the image
  yPercent: number; // 0 - 100% position on the image
  note?: string;
}

export interface PostComment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    handle: string;
    badge?: string;
  };
  title: string;
  caption: string;
  imageUrl: string;
  tags: string[];
  productTags: ProductTag[];
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  comments: PostComment[];
  createdAt: string;
  /** Các trường dưới chỉ có ở route admin (GET /community/admin). */
  userId?: string | null;
  postedAt?: string;
  status?: CommunityPostStatus;
  moderationReason?: string;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  isStaffPick?: boolean;
}

/** PUBLISHED: đang hiển thị; HIDDEN: nhân viên ẩn; REJECTED: bộ lọc tự động chặn lúc đăng. */
export type CommunityPostStatus = 'PUBLISHED' | 'HIDDEN' | 'REJECTED';
