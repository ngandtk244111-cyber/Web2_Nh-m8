import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { CommunityPost, ProductTag } from '../../core/models/community.model';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css'
})
export class CommunityComponent implements OnInit {
  posts: CommunityPost[] = [];
  availableProducts: Product[] = [];

  showCreateModal = false;
  newPostTitle = '';
  newPostCaption = '';
  newPostImageUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';
  selectedTagProductId = '';

  expandedPostComments: { [key: string]: boolean } = {};
  commentInputs: { [key: string]: string } = {};

  constructor(
    private communityService: CommunityService,
    private productService: ProductService,
    private cartService: CartService,
    public authService: AuthService,
    public loginModalService: LoginModalService
  ) {
    // posts/products giờ nạp bất đồng bộ từ backend — effect() tự đồng bộ lại mỗi khi signal đổi.
    effect(() => {
      this.posts = this.communityService.posts();
    });
    effect(() => {
      this.availableProducts = this.productService.products();
    });
  }

  ngOnInit(): void {}

  getProduct(id: string): Product | undefined {
    return this.productService.getProductById(id);
  }

  toggleLike(postId: string): void {
    this.communityService.toggleLike(postId);
  }

  toggleSave(postId: string): void {
    this.communityService.toggleSave(postId);
  }

  toggleComments(postId: string): void {
    this.expandedPostComments[postId] = !this.expandedPostComments[postId];
  }

  addComment(postId: string): void {
    const text = this.commentInputs[postId]?.trim();
    if (!text) return;
    this.communityService.addComment(postId, text, 'Bạn');
    this.commentInputs[postId] = '';
  }

  openTagPopover(tag: ProductTag): void {}

  /** Đăng bài yêu cầu đăng nhập — cần userId thật để tính Xu thưởng và gắn đúng tác giả. */
  openCreateModal(): void {
    if (!this.authService.currentUser()) {
      this.loginModalService.open();
      return;
    }
    this.showCreateModal = true;
  }

  publishPost(): void {
    const user = this.authService.currentUser();
    if (!user || !this.newPostTitle || !this.newPostImageUrl) return;

    const tags: ProductTag[] = [];
    if (this.selectedTagProductId) {
      tags.push({
        productId: this.selectedTagProductId,
        xPercent: 50,
        yPercent: 50,
      });
    }

    this.communityService.createPost({
      userId: user._id,
      author: {
        id: user._id,
        name: user.fullName || user.phoneNumber,
        avatar: this.authService.getAvatarUrl(user.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        handle: '@' + user.phoneNumber,
      },
      title: this.newPostTitle,
      caption: this.newPostCaption,
      imageUrl: this.newPostImageUrl,
      tags: ['#decor', '#goccanhan', '#deco3d'],
      productTags: tags,
    });

    this.showCreateModal = false;
    this.newPostTitle = '';
    this.newPostCaption = '';
  }
}
