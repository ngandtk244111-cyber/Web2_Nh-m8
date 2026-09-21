# REFERENCE_ARCHITECTURE.md

> Bản đồ kiến trúc của **AuraPC-main** (project THAM KHẢO), dùng để định hướng khi xây **Lam-a-main** (project CHÍNH).
> File này chỉ mô tả architecture — không copy source code, không tự implement feature.
> Nguồn khảo sát: `AuraPC-main/AuraPC-main` (CLAUDE.md có sẵn trong repo + đọc trực tiếp các file cấu hình/service cốt lõi).

---

## 1. Technology Stack

| Layer | Công nghệ |
|---|---|
| Frontend framework | Angular 21 (standalone components, không dùng NgModule) |
| Frontend apps | 2 app riêng: `my-client` (khách hàng) + `my-admin` (quản trị) trong cùng Angular workspace |
| Shared lib | `projects/shared` (Angular library project — hiện gần như trống, chỉ là scaffold mặc định `ng generate library`) |
| State management | Angular `signal()`/`computed()`/`effect()` là chính; RxJS `BehaviorSubject`/`Subject` cho sự kiện/stream (giỏ hàng, toast, chat) |
| HTTP | `HttpClient` + functional interceptor (`provideHttpClient(withInterceptors([...]))`) |
| Routing | `provideRouter` + lazy-loaded standalone components (`loadComponent`) |
| Backend | Node.js, Express 5.2 |
| Database | MongoDB + Mongoose (10+ models) |
| Auth | JWT (7 ngày) + OTP qua số điện thoại; social login (Google/Facebook) |
| Realtime | Socket.IO (`socket.io-client` FE, `socket.js` BE) — dùng cho chat/hub |
| 3D/Visualization | Three.js (canvas homepage), `@google/model-viewer` (trang sản phẩm) |
| Khác | Chart.js/ng2-charts (dashboard admin), GSAP (animation), docx/xlsx/PDFKit (export), Nodemailer (email) |
| Styling | Plain CSS thuần theo từng component (không Tailwind, không SCSS, không CSS framework) |
| Testing | Karma/Jasmine (FE), Jest (BE) |
| Deploy | Frontend → Vercel; Backend → Render |

**Kết luận cho Lam-a-main:** đây là kiến trúc "Angular standalone + signals + Express/MongoDB REST API", không dùng NgRx, không dùng NgModule, không dùng UI framework ngoài (tự viết CSS). Nếu Lam-a-main dùng Angular hiện đại tương tự, đây là pattern phù hợp để tham khảo trực tiếp.

---

## 2. Kiến trúc tổng thể (Monorepo)

```
AuraPC-main/
├── projects/
│   ├── my-client/      # App khách hàng (chính, public-facing)
│   ├── my-admin/       # App quản trị (Shopify Polaris-inspired UI)
│   └── shared/         # Angular lib dùng chung (hiện chưa dùng nhiều)
├── server/             # Express API — 1 backend phục vụ cả 2 app FE
├── scrapers/           # Script thu thập dữ liệu (gitignored, không liên quan kiến trúc app)
├── angular.json        # Định nghĩa cả 2 project Angular trong 1 workspace
└── package.json        # Root: chỉ chứa deps + script cho FE (ng serve/build/test)
```

- 1 Angular workspace, nhiều project (`ng serve my-client`, `ng serve my-admin`).
- 1 Express backend duy nhất phục vụ cả client lẫn admin (phân quyền qua middleware `requireAuth` / `requireAdmin` / `requireUserOrAdmin`), không tách backend riêng cho admin.
- Không có SSR — thuần SPA (dùng `isPlatformBrowser`/`PLATFORM_ID` để guard code chỉ chạy browser).

---

## 3. Folder Structure (my-client — app chính, đáng tham khảo nhất)

```
projects/my-client/src/app/
├── app.component.ts / .html / .css     # Root shell: header, router-outlet, footer, floating widgets
├── app.config.ts                        # providers: router + httpClient(interceptors)
├── app.routes.ts                        # Toàn bộ route định nghĩa ở 1 file
├── components/                          # Component DÙNG CHUNG toàn app (không gắn với 1 route cụ thể)
│   ├── header/, footer/, toast/
│   ├── chatbot-widget/, support-chat-widget/
│   ├── checkout-stepper/, cod-otp-dialog/
│   ├── recently-viewed-section/, side-ad-banners/, three-canvas/
├── core/
│   ├── services/                        # TẤT CẢ business logic + gọi API nằm ở đây
│   └── interceptors/
│       └── auth.interceptor.ts
└── pages/                                # Mỗi route = 1 folder riêng, lazy-loaded
    ├── homepage/, product-list/, product-detail/   # eager-loaded (route gốc)
    ├── account/, cart/, checkout*, blog*, builder/, aura-hub/, support/, track-order/, warranty-lookup/, ve-aurapc/, collabs-minecraft/
    └── <feature>/
        ├── <feature>.component.ts
        ├── <feature>.component.html
        ├── <feature>.component.css
        └── index.ts (barrel, chỉ có ở 1 số feature — dùng để loadComponent gọn hơn)
```

Quy ước:
- 3 route đầu tiên (`homepage`, `san-pham`, `san-pham/:slug`) load eager (import trực tiếp) vì là trang vào chính.
- Tất cả route còn lại dùng `loadComponent: () => import(...)`.
- Mỗi page component tự chứa `.ts/.html/.css` riêng — không có global SCSS/theme system.
- `components/` chứa UI tái sử dụng liên route; `pages/` chứa UI gắn với 1 route cụ thể.

**my-admin** structure khác biệt đáng chú ý:
```
projects/my-admin/src/app/
├── core/auth/            # admin-auth.guard.ts, admin-auth.interceptor.ts, admin-auth.service.ts
├── core/services/
├── layout/               # admin-layout.component.* — layout khung có sidebar/topbar cho toàn bộ trang admin
├── pages/<feature>-admin/
└── shared/
```
→ Admin dùng **route guard** (`CanActivateFn`) + **layout wrapper component** bọc toàn bộ các trang con — pattern này client không cần vì client là public.

---

## 4. Routing Structure

File duy nhất: `app.routes.ts` — flat list, không dùng route nesting/children, không dùng route data phức tạp.

Pattern đáng chú ý:
- **Slug tiếng Việt cho route công khai**: `/san-pham`, `/tai-khoan`, `/aura-builder`, `/ho-tro`, `/tra-cuu-don-hang`, `/tra-cuu-bao-hanh`, `/ve-aurapc` — SEO-friendly, thân thiện người dùng Việt.
- Route có tham số: `/san-pham/:slug`, `/aura-builder/:id`, `/blog/:slug`, `/aura-hub/:postId`, `/ve-aurapc/:slug`.
- Wildcard cuối cùng: `{ path: '**', redirectTo: '' }`.
- Không có route guard ở client app (mọi trang public; auth state được service tự quản lý, không chặn ở router level). Admin app thì có guard.

**Tham khảo khi xây Lam-a-main:** nếu muốn URL thân thiện + đa ngôn ngữ, có thể áp dụng cùng cách đặt slug theo ngôn ngữ chính của target user. Nếu Lam-a-main có khu vực admin riêng, tham khảo cặp (guard + layout wrapper) của `my-admin`.

---

## 5. Component Structure & Pattern

- **100% standalone components** — `standalone: true`, khai báo `imports: [...]` trực tiếp trong `@Component`. Không NgModule nào trong toàn bộ app.
- Component root (`AppComponent`) đảm nhiệm:
  - Bọc `<app-header>`, `<router-outlet>`, `<app-footer>` (ẩn có điều kiện qua signal `hideFooter()`).
  - Gắn các widget nổi cố định (chat, scroll-to-top) ở ngoài `<router-outlet>` → luôn hiện xuyên suốt mọi trang.
  - Dùng `@if` (control flow mới của Angular, không dùng `*ngIf`).
  - Theo dõi route hiện tại bằng `toSignal(router.events.pipe(...))` để đổi behaviour theo route (ví dụ ẩn footer ở trang `/aura-builder`).
- Widget dùng chung (chat, toast, ad banner) được đặt ở cấp `AppComponent`, không lặp lại trong từng page.
- Naming: prefix `app-`, tên file theo kiểu `feature.component.ts`.
- 1 số feature có `index.ts` để barrel export, giúp `loadComponent()` gọn (`import('./pages/account').then(m => m.AccountPageComponent)`).

---

## 6. Service Structure

Tất cả service nằm phẳng trong `core/services/` (không chia theo feature-folder), mỗi service `providedIn: 'root'`:

| Service | Vai trò |
|---|---|
| `auth.service.ts` | Đăng nhập OTP theo số điện thoại + Google/Facebook, quản lý `currentUser` (signal), lưu token/localStorage |
| `api.service.ts` | **Toàn bộ** gọi API sản phẩm/đơn hàng/blog/hub/review/... + các hàm helper thuần (không gọi API) như `productDisplayPrice`, `productHasSale` đặt ngay cạnh interface `Product` |
| `cart.service.ts` | Giỏ hàng: local (localStorage) khi chưa đăng nhập, sync server khi đăng nhập; dùng `effect()` lắng nghe `auth.currentUser()` để tự động fetch/clear giỏ |
| `address.service.ts` | Quản lý địa chỉ giao hàng |
| `chat-panel.service.ts`, `chatbot.service.ts`, `support-chat.service.ts` | Tách riêng 3 tầng: UI panel state / AI chatbot / live support chat |
| `notification.service.ts` | Thông báo người dùng |
| `realtime.service.ts` | Socket.IO client wrapper |
| `recently-viewed.service.ts` | Lịch sử xem sản phẩm (localStorage) |
| `toast.service.ts` | Toast message toàn app |
| `intro-state.service.ts` | State cho intro/onboarding UI |

**Pattern quan trọng:**
1. **1 ApiService lớn** chứa mọi method gọi API + interfaces liên quan (Product, Category, Order, BlogPost, Warranty, Hub...) — không tách theo domain thành nhiều file service nhỏ. Đơn giản nhưng file khá dài (~700 dòng).
2. **Service-to-service reactivity qua `effect()`**: `CartService` inject `AuthService` và dùng `effect()` để phản ứng khi user đăng nhập/đăng xuất — đây là cách "kết nối feature" chính thay vì NgRx hay event bus phức tạp.
3. Local-first + server-sync: cart hoạt động được cả khi chưa đăng nhập (localStorage), tự động đồng bộ lên server khi có user — pattern tốt để tham khảo cho bất kỳ feature nào cần hoạt động offline/guest rồi merge khi login.
4. Toàn bộ side-effect localStorage đều bọc `try/catch` (phòng trường hợp SSR/không có `localStorage`, dù app này không SSR nhưng vẫn phòng thủ).

---

## 7. Models / Interfaces

- **Không có thư mục `models/` riêng** ở frontend — tất cả interface (`Product`, `Category`, `OrderListItem`, `BlogPost`, `WarrantyItem`, ...) định nghĩa ngay trong `api.service.ts`, cạnh method dùng chúng.
- `auth.service.ts` tự định nghĩa `User`, `UserProfile` riêng (không import từ api.service).
- Interface khá "loose" (nhiều field optional, một số kiểu `any`) để chấp nhận response linh hoạt từ MongoDB (schema cũ/mới lẫn lộn, ví dụ `Product` có cả `old_price` và `salePrice` cho 2 phiên bản schema).
- Backend: model Mongoose trong `server/models/*.js`, 1 file/1 collection, không dùng TypeScript ở backend.

**Tham khảo cho Lam-a-main:** nếu muốn tách rõ ràng hơn, có thể tạo `core/models/` riêng — nhưng nếu ưu tiên tốc độ phát triển giống AuraPC, giữ interface cạnh service cũng là lựa chọn hợp lệ đã được chứng minh hoạt động.

---

## 8. Authentication / Authorization Flow

**Client (my-client):**
1. Người dùng nhập số điện thoại → `AuthService.requestOtp()` → BE gửi OTP (dev mode trả `devOtp` trong response để test).
2. Xác thực → `AuthService.verifyOtp()` → BE trả `{ user, token }` → FE lưu `user` vào `localStorage['aurapc_user']`, token vào `localStorage['aurapc_token']`, set `currentUser` signal.
3. Social login (`loginWithGoogle`/`loginWithFacebook`) dùng cùng flow, chỉ khác endpoint.
4. `auth.interceptor.ts` (functional interceptor) tự động gắn `Authorization: Bearer <token>` vào **mọi request tới `environment.apiUrl`** — check qua `req.url.startsWith(...)`.
5. Không có route guard ở client — trang nào cần user thì tự kiểm tra `auth.currentUser()` trong component.

**Backend:**
- JWT ký bằng `JWT_SECRET` (bắt buộc có trong env, server **crash khi start** nếu thiếu — chủ đích, không có fallback secret).
- `server/middleware/auth.js` export 4 middleware: `requireAuth` (user), `optionalAuth` (user nếu có), `requireAdmin` (admin riêng), `requireUserOrAdmin` (dùng chung route cho cả 2 role, phân biệt qua `decoded.isAdmin`).
- Token decode gắn `req.userId`/`req.phoneNumber` hoặc `req.adminId`/`req.isAdmin` vào request để route dùng tiếp.

**Admin (my-admin):**
- Có `CanActivateFn` guard (`admin-auth.guard.ts`) chặn route nếu chưa đăng nhập → redirect `/login`.
- Có `admin-layout.component` bọc toàn bộ trang admin (sidebar/topbar cố định).
- Có interceptor riêng (`admin-auth.interceptor.ts`) — tách biệt hoàn toàn với interceptor của client dù dùng chung 1 backend.

**Tham khảo cho Lam-a-main:** nếu có cả public site + trang quản trị, nên tách 2 interceptor + 2 auth service riêng (client vs admin) như AuraPC, dùng chung backend nhưng phân middleware theo role.

---

## 9. API Pattern (Backend)

```
server/
├── index.js              # Entry: connectDB, CORS whitelist, mount tất cả route, error handler tập trung
├── config/                # DB connection
├── middleware/auth.js     # JWT middleware (mô tả ở mục 8)
├── models/*.js            # 1 Mongoose model / file
├── routes/*.js            # 1 router / domain (productRoutes, orderRoutes, cartRoutes...)
├── routes/admin/*.js      # Route riêng cho admin, mount song song route client
└── utils/                 # Logic tách khỏi route (filter building, normalizers, email, PDF, momo...)
```

Pattern route điển hình (xem `server/routes/productRoutes.js`):
- Router Express thuần, `async/await` + `try/catch` trong từng handler, log lỗi rồi trả `500` với `{ error: err.message }`.
- Logic phức tạp (build filter MongoDB, chuẩn hoá field, tính toán) tách ra `utils/` (`productFilters.js`, `productNormalizers.js`, `filterOptionsConfig.js`) — route chỉ điều phối, không chứa business logic dài.
- CORS: whitelist tường minh domain (Vercel URLs + localhost), không dùng `origin: '*'`.
- **Bảo mật giá**: route thanh toán verify giá sản phẩm lại từ DB server-side (không tin giá client gửi lên) — pattern quan trọng cho bất kỳ hệ thống thanh toán nào.

**Tham khảo cho Lam-a-main:** cấu trúc `routes/ + models/ + utils/` tách bạch là pattern gọn, dễ mở rộng, không cần framework phụ (NestJS...). Nếu Lam-a-main dùng Express, đây là khuôn mẫu trực tiếp áp dụng được.

---

## 10. Cách quản lý dữ liệu (Data Flow)

```
Component (page) 
   → gọi method của service tương ứng (ApiService/CartService/AuthService...) 
   → Observable trả về, subscribe trong component HOẶC dùng toSignal()/async pipe 
   → service cập nhật signal nội bộ nếu cần cache/state dùng chung (vd: currentUser, cartCount)
   → component khác đọc lại signal đó (không qua store trung tâm)
```

- Không có state management library (không Redux/NgRx/Akita). "Store" thực chất là các `signal()` sống trong service `providedIn: 'root'` — đây là singleton tự nhiên của Angular DI.
- `computed()` dùng để derive giá trị (vd: `cartCount`, `cartTotal` derive từ `items` signal).
- `effect()` dùng để tạo phản ứng chéo giữa các service (Cart phản ứng theo Auth).
- Giao tiếp component → component không liên quan cha/con: qua `Subject`/`Observable` trong service (vd: `itemAdded$`, `showLoginPopup$`) — pattern pub/sub nhẹ thay vì event emitter phức tạp.

---

## 11. Layout & Shared Components

- `AppComponent` = layout gốc duy nhất cho client (header + outlet + footer + floating widgets), không có nhiều layout khác nhau theo route (chỉ ẩn/hiện footer bằng điều kiện).
- `my-admin` có layout riêng biệt (`admin-layout.component`) bọc quanh route con — khác hẳn client (nên tách layout theo "loại app", không theo từng page).
- Widget dùng chung đặt tại `components/`: `header`, `footer`, `toast`, `chatbot-widget`, `support-chat-widget`, `side-ad-banners` — đều là standalone, import trực tiếp vào `AppComponent`.

---

## 12. CSS / Styling Pattern

- Plain CSS, không SCSS/Less, không Tailwind/Bootstrap.
- Mỗi component có file `.css` riêng (Angular ViewEncapsulation mặc định — scoped tự động).
- Không có design token/theme file tập trung cho `my-client` (mỗi component tự định nghĩa màu, ví dụ màu cam thương hiệu `#FF6D2D` lặp lại trực tiếp trong nhiều file thay vì biến CSS global) — **đây là điểm KHÔNG nên copy y nguyên**, Lam-a-main nên cân nhắc CSS variables tập trung nếu muốn dễ bảo trì hơn.
- `my-admin` có xu hướng theme rõ ràng hơn (dark/light, lấy cảm hứng Shopify Polaris) — đáng xem xét nếu Lam-a-main cần theme switcher.
- Animation: dùng `IntersectionObserver` + class `.fade-in`/`.scale-in` toggle bằng JS thuần (không dùng Angular Animations API), kết hợp GSAP cho hiệu ứng phức tạp hơn.

---

## 13. Các Pattern quan trọng (tổng hợp)

1. **Standalone-only Angular** — không NgModule, `loadComponent` cho lazy route.
2. **Signal-as-store** — mỗi service tự giữ state bằng `signal()`, không cần store trung tâm.
3. **`effect()` để nối các service với nhau** — cách "features kết nối nhau" chính của app này.
4. **Local-first, server-sync-on-login** — áp dụng cho cart (và có thể áp dụng cho recently-viewed, wishlist...).
5. **Functional interceptor gắn JWT có điều kiện** (chỉ gắn cho request tới API của chính app, tránh leak token sang domain khác).
6. **Interface đặt cạnh service dùng nó**, không có tầng model riêng.
7. **Route tiếng Việt có ý nghĩa (SEO slug)** thay vì route tiếng Anh chung chung.
8. **Tách backend thành routes/models/utils**, business logic phức tạp nằm ở `utils/`, route chỉ điều phối.
9. **Guard + Layout wrapper riêng cho khu vực admin**, tách biệt hoàn toàn interceptor/service với client.
10. **Bảo mật giá ở server** khi thanh toán — không tin dữ liệu giá từ client.
11. **Barrel file (`index.ts`) cho lazy-loaded feature** để câu `import()` gọn hơn.
12. **Widget nổi toàn cục (chat, scroll-top) đặt ở AppComponent**, không lặp lại per-page.

---

## 14. Danh sách file quan trọng và vai trò

| File | Vai trò |
|---|---|
| `CLAUDE.md` (root AuraPC-main) | Tổng quan kiến trúc, lệnh chạy, quy tắc bảo mật — nên đọc đầu tiên khi cần tra cứu nhanh |
| `angular.json` | Định nghĩa 2 Angular project (`my-client`, `my-admin`) trong 1 workspace |
| `projects/my-client/src/app/app.routes.ts` | Toàn bộ route của app khách hàng |
| `projects/my-client/src/app/app.config.ts` | Đăng ký router + HTTP interceptor |
| `projects/my-client/src/app/app.component.ts` | Layout gốc + logic ẩn/hiện footer theo route + scroll-to-top |
| `projects/my-client/src/app/core/services/api.service.ts` | Toàn bộ API call + interface dữ liệu chính (Product, Order, Blog, Hub...) |
| `projects/my-client/src/app/core/services/auth.service.ts` | Auth OTP + social login, quản lý user/token |
| `projects/my-client/src/app/core/services/cart.service.ts` | Giỏ hàng local + sync server, ví dụ mẫu tốt nhất cho pattern `effect()` |
| `projects/my-client/src/app/core/interceptors/auth.interceptor.ts` | Gắn JWT vào request |
| `projects/my-admin/src/app/core/auth/admin-auth.guard.ts` | Mẫu route guard cho khu vực cần đăng nhập |
| `projects/my-admin/src/app/layout/admin-layout.component.*` | Mẫu layout wrapper cho khu vực có nhiều trang con dùng chung khung |
| `server/index.js` | Entry point BE: mount route, CORS, error handler |
| `server/middleware/auth.js` | Toàn bộ logic JWT middleware (4 loại: user/admin/optional/either) |
| `server/routes/productRoutes.js` | Mẫu route Express điển hình (dùng chung `utils/` cho logic filter) |
| `server/routes/paymentRoutes.js` | Mẫu xử lý thanh toán, verify giá server-side |

---

## 15. Theo từng loại feature — nên tham khảo phần nào của AuraPC-main

| Muốn xây (Lam-a-main) | Nên xem trong AuraPC-main |
|---|---|
| Danh sách + chi tiết sản phẩm, filter | `pages/product-list/`, `pages/product-detail/`, `core/services/api.service.ts` (method `getProducts`, `getFilterOptions`), `server/routes/productRoutes.js`, `server/utils/productFilters.js` |
| Giỏ hàng (local + đồng bộ khi đăng nhập) | `core/services/cart.service.ts` (toàn bộ), `server/routes/cartRoutes.js` |
| Đăng nhập OTP/Social | `core/services/auth.service.ts`, `core/interceptors/auth.interceptor.ts`, `server/middleware/auth.js`, `server/routes/authRoutes.js` |
| Thanh toán nhiều phương thức (COD/QR/MoMo/ZaloPay) | `pages/checkout*/`, `server/routes/paymentRoutes.js`, `server/docs/MOMO_LOCAL.md` |
| Theo dõi/tra cứu đơn hàng không cần đăng nhập | `pages/track-order/`, `api.service.ts` (`trackOrder`, `getOrder`) |
| Tra cứu bảo hành | `pages/warranty-lookup/`, `server/routes/warrantyRoutes.js` |
| Blog | `pages/blog-list/`, `pages/blog-detail/`, `server/routes/blogRoutes.js` |
| Chatbot AI | `components/chatbot-widget/`, `server/routes/chatRoutes.js` (đọc CLAUDE.md mục AruBot để hiểu flow inject catalog vào prompt) |
| Chat hỗ trợ trực tiếp (realtime) | `components/support-chat-widget/`, `core/services/support-chat.service.ts`, `core/services/realtime.service.ts`, `server/socket.js`, `server/routes/supportRoutes.js` |
| Diễn đàn/cộng đồng (feed, like, comment, poll) | `pages/aura-hub/`, `server/routes/hubRoutes.js`, model `Post.js`/`HubComment.js` |
| Cấu hình sản phẩm tương tác (builder) | `pages/builder/`, `server/routes/builderRoutes.js`, model `Builder.js` |
| Trang tài khoản cá nhân (profile, avatar, địa chỉ) | `pages/account/`, `core/services/address.service.ts`, `server/routes/authRoutes.js` (route `/profile`, `/avatar`) |
| Đánh giá sản phẩm (review) | `server/routes/reviewRoutes.js`, `api.service.ts` (`getProductReviews`, `canReview`) |
| Thông báo người dùng | `core/services/notification.service.ts`, `server/routes/notificationRoutes.js` |
| Khu vực quản trị (dashboard, CRUD, phân quyền) | Toàn bộ `projects/my-admin/` — đặc biệt `core/auth/` (guard + interceptor riêng) và `layout/admin-layout.component.*` |
| 3D visualization / model viewer | `components/three-canvas/`, package `@google/model-viewer`, `three` |
| Toast/notification UI dùng chung | `components/toast/`, `core/services/toast.service.ts` |

---

## Ghi chú cuối

- Đây là bản đồ **tại thời điểm khảo sát** (2026-09-19). Nếu AuraPC-main thay đổi, cần đọc lại các file nguồn tương ứng trước khi dựa vào bản đồ này để quyết định.
- File này KHÔNG chứa source code copy nguyên văn — chỉ mô tả vị trí, vai trò, và pattern. Khi implement thật trong Lam-a-main, cần đọc trực tiếp file gốc trong AuraPC-main tương ứng với feature đang làm.
- Không có thay đổi nào được thực hiện trên AuraPC-main hoặc Lam-a-main ngoài việc tạo file này.
