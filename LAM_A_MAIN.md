# LAM_A_MAIN.md

> Bản đồ kiến trúc của **Lam-a-main** (project CHÍNH — Deco3D, nền tảng TMĐT nội thất decor nhỏ gọn & in 3D theo yêu cầu).
> Khác với `REFERENCE_ARCHITECTURE.md` (khảo sát AuraPC-main) và `vita.md` (khảo sát VitaCare-main) — hai file đó mô tả project THAM KHẢO, còn file này mô tả chính Lam-a-main tại thời điểm viết.
> Ngày cập nhật: 2026-09-22 (đính chính mục Auth — bản trước ghi nhầm JWT; bổ sung admin auth, ATM payment, verify giá server-side, AI chatbot dùng Gemini thật).

---

## 1. Technology Stack

| Layer | Công nghệ |
|---|---|
| Frontend framework | Angular 19 (standalone components, `*ngIf`/`*ngFor` — chưa dùng control-flow `@if`/`@for` mới) |
| Frontend apps | 2 project Angular **độc lập** trong cùng workspace: `my-client` (khách hàng, port 4200) + `my-admin` (quản trị, port 4201) |
| State management | Angular `signal()`/`computed()`/`effect()` là chính; RxJS `Observable` cho gọi HTTP |
| HTTP | `HttpClient` (`provideHttpClient()`, **không có interceptor nào** — mỗi service tự gắn `userId`/`adminId` vào request cần xác thực) |
| Routing | `provideRouter` + `loadComponent()` cho mọi route (không route nào eager ngoài `AppComponent`) |
| Backend | Node.js, Express 5, 1 backend duy nhất (`server/`, port 4300) phục vụ cả `my-client` lẫn `my-admin` |
| Database | MongoDB (`mongodb://127.0.0.1:27017/deco3d`) qua Mongoose 8 |
| Auth | Số điện thoại + mật khẩu (bcrypt), **không dùng JWT/token** — server tin thẳng `userId`/`adminId` client gửi lên (tham khảo VitaCare-main). OTP chỉ dùng xác thực SĐT lúc đăng ký/quên mật khẩu (dev mode trả thẳng mã OTP, chưa gắn SMS provider thật) |
| Realtime | Socket.IO (`socket.io-client` FE, `server/socket.js` BE) — dùng cho chat hỗ trợ trực tiếp |
| Thanh toán | MoMo + ZaloPay (sandbox), verify giao dịch qua IPN/return URL |
| 3D | Three.js (`GLTFLoader`, `OrbitControls`) — customizer sản phẩm + phòng 3D "Shop The Room", hỗ trợ cả model thật (`.glb`) lẫn fallback procedural geometry |
| Styling | **Plain CSS thuần** — Tailwind đã bị gỡ bỏ hoàn toàn khỏi toolchain, `styles.css` là CSS tĩnh "đóng băng" từ lần build Tailwind cuối cùng, các class Tailwind trong HTML (`bg-amber-400`, `text-neutral-900`...) vẫn hoạt động vì được định nghĩa thủ công trong `styles.css` |
| Theme | Theme tối (đen/cam/xanh), tham khảo bảng màu + font của AuraPC-main (`--accent-orange: #FF6D2D`, `--accent-blue: #2055AF`, font Satoshi + Inter) |
| Testing | Karma/Jasmine (scaffold mặc định, chưa viết test case cụ thể) |

**Không dùng**: NgRx/Redux, SCSS/Less, Tailwind (đã gỡ), NgModule, SSR.

---

## 2. Kiến trúc tổng thể (2 project Angular + 1 backend)

```
Lam-a-main/
├── projects/
│   ├── my-client/      # App khách hàng — public-facing, không cần đăng nhập để duyệt
│   └── my-admin/       # App quản trị — dashboard cho chủ shop
├── server/              # Express API — 1 backend phục vụ cả 2 app FE
│   ├── config/          # Kết nối MongoDB
│   ├── middleware/      # JWT middleware (requireAuth/optionalAuth)
│   ├── models/          # Mongoose model, 1 file/1 collection
│   ├── routes/          # Router Express, 1 file/1 domain
│   ├── utils/           # OTP, MoMo, ZaloPay helper
│   └── seed/            # Script chuyển mock-data.ts (Angular) → seed MongoDB
├── angular.json         # Định nghĩa 2 Angular project trong 1 workspace
├── REFERENCE_ARCHITECTURE.md  # Bản đồ kiến trúc AuraPC-main (tham khảo)
├── vita.md                    # Bản đồ kiến trúc VitaCare-main (tham khảo)
└── LAM_A_MAIN.md               # File này
```

- **Không có shared library** giữa `my-client` và `my-admin` — mỗi app tự có bản sao `core/services`, `core/models`, `shared/pipes`, `components/icon` riêng (trùng với tiền lệ ở cả AuraPC-main lẫn VitaCare-main: 2 app độc lập, code trùng nhau được chấp nhận thay vì tách thư viện dùng chung).
- **`my-admin` từng là 1 route (`/admin`) nằm trong `my-client`**, sau đó được tách hẳn thành project Angular riêng (lý do: tách biệt rõ ràng khách hàng ↔ quản trị, tránh admin code lọt vào bundle khách hàng). Mọi liên kết chéo giữa 2 app giờ dùng `<a [href]="...AppUrl">` (link ngoài), không còn `routerLink` nội bộ được.
- Không có SSR — thuần SPA.

---

## 3. Folder Structure — `my-client`

```
projects/my-client/src/app/
├── app.component.ts/.html/.css   # Shell gốc: header, router-outlet (có hiệu ứng fade chuyển trang),
│                                   footer, cart-drawer, ai-modal, login-modal, support-chat-widget,
│                                   product-quick-view, toast — tất cả overlay toàn cục nằm ở đây
├── app.routes.ts                  # Toàn bộ route, flat list, loadComponent() cho tất cả
├── app.config.ts                  # provideRouter + provideHttpClient
├── components/                    # UI dùng chung nhiều route
│   ├── header/, footer/, icon/    # icon/ là bộ SVG icon tự vẽ (không dùng icon-font/thư viện ngoài)
│   ├── cart-drawer/, login-modal/, ai-modal/, support-chat-widget/
│   ├── product-card/, product-quick-view/, toast/       # (mới) hạ tầng hiệu ứng UX
│   ├── three-viewer/, room-viewer/                       # wrapper Three.js cho customizer & room
│   └── recently-viewed-section/
├── core/
│   ├── data/mock-data.ts          # CHỈ còn dùng làm nguồn seed ban đầu cho backend (xem mục 10) —
│   │                                 KHÔNG còn được service nào import trực tiếp để hiển thị nữa
│   ├── data/quiz-data.ts          # Câu hỏi/kết quả Trắc Nghiệm Phong Cách Decor (tĩnh, không cần backend)
│   ├── models/                    # TypeScript interface thuần, đặt tách biệt (khác AuraPC/Vita —
│   │                                 2 project tham khảo để interface cạnh service, Lam-a-main tách riêng)
│   ├── services/                  # ~19 service, xem mục 7
│   └── interceptors/auth.interceptor.ts   # Tự gắn Bearer token vào request tới apiUrl
├── shared/
│   ├── pipes/vnd.pipe.ts          # Format tiền VNĐ
│   ├── directives/scroll-reveal.directive.ts  # IntersectionObserver fade-in khi cuộn
│   └── three/                     # product-scenes.ts, room-scenes.ts, resource-manager.ts,
│                                     viewer-runtime.ts — logic Three.js thuần, tách khỏi component
├── pages/                          # Mỗi route = 1 folder, lazy-loaded
│   ├── home/, catalog/, product-detail/, customizer-3d/, shop-the-room/
│   ├── custom-request/{list,new,detail}/, community/, news/, style-quiz/
│   ├── cart-checkout/, checkout-momo-return/, checkout-zalopay-return/
│   ├── order-tracking/, warranty-lookup/, account/
├── environments/environment.ts    # apiUrl, socketUrl, adminAppUrl
```

**Quy ước**: `pages/` gắn với 1 route cụ thể, `components/` dùng lại xuyên route. Naming `feature.component.ts` (không có barrel `index.ts` như AuraPC).

---

## 4. Folder Structure — `my-admin`

```
projects/my-admin/src/app/
├── app.component.ts/.html         # Chỉ có <router-outlet> — không header/footer riêng
├── app.routes.ts                  # 1 route chính: '' → AdminComponent (loadComponent)
├── pages/dashboard/admin.component.ts/.html/.css   # TOÀN BỘ dashboard nằm trong 1 component lớn
│                                     (sidebar + topbar + 4 tab: orders/custom-requests/products/rooms)
├── core/{models,services}/        # BẢN SAO (không import chéo) từ my-client — product, room,
│                                     custom-request, cart, order, community(không có), news(không có)
├── components/icon/                # bản sao icon.component
├── shared/pipes/vnd.pipe.ts        # bản sao
├── environments/environment.ts     # apiUrl, socketUrl, clientAppUrl
```

- **Không có route guard / trang đăng nhập riêng cho admin** — khác AuraPC-main (có `admin-auth.guard.ts` + layout wrapper). Ai có link `localhost:4201` đều vào được thẳng dashboard. Đây là khoảng trống bảo mật đã biết, chưa được yêu cầu xử lý.
- Tab "Sản Phẩm" tách 2 sub-tab riêng biệt: **Sản Phẩm Có Sẵn** (READY_STOCK) và **Sản Phẩm Tùy Biến In 3D** (PRINT_ON_DEMAND) — khớp với cách `my-client` tách `/catalog` (chỉ ready-stock) và `/customizer-3d` (chỉ customizable).
- Nút "Thêm sản phẩm mới" hiện chỉ set cờ `showAddProductModal = true` nhưng **chưa có modal form thật** — placeholder chưa hoàn thiện.

---

## 5. Routing Structure

### `my-client` (`app.routes.ts`)
| Path | Route param | Ghi chú |
|---|---|---|
| `` | | Trang chủ |
| `catalog` | | Chỉ sản phẩm READY_STOCK (đã tách khỏi hàng tùy biến) |
| `product/:slug` | slug | Chi tiết sản phẩm |
| `customizer-3d` | `?productId=` | Chỉ sản phẩm PRINT_ON_DEMAND/customizable |
| `shop-the-room` | `?roomId=` | Phòng 3D |
| `custom-request`, `custom-request/new`, `custom-request/:id` | id | Đặt thiết kế riêng |
| `community` | | Cộng đồng decor |
| `style-quiz` | | Trắc Nghiệm Phong Cách Decor (mới) |
| `news`, `news/:slug` | slug | Blog/insight |
| `checkout`, `checkout-momo-return`, `checkout-zalopay-return` | | Thanh toán |
| `orders/track` | `?orderNumber=` | Tra cứu đơn (không cần đăng nhập) |
| `warranty-lookup` | | Tra cứu bảo hành |
| `account` | | Cần đăng nhập (tự kiểm tra trong component, không có route guard) |
| `**` | | redirect `''` |

### `my-admin` (`app.routes.ts`)
Chỉ 1 route thật: `'' → AdminComponent`. Toàn bộ điều hướng nội bộ dashboard là đổi `activeTab`/`productSubTab` (biến component), không phải Angular route.

---

## 6. Component Structure & Pattern

- 100% standalone component, `imports: [...]` khai trực tiếp trong `@Component`.
- Dùng directive cũ `*ngIf`/`*ngFor` (không phải `@if`/`@for` như 2 project tham khảo).
- State cục bộ: `signal()` trong service (là "store" thực chất) + biến class thường trong component.
- **Pattern đọc dữ liệu bất đồng bộ**: mọi service dữ liệu (Product/Room/CustomRequest/Community/News) fetch từ backend trong `constructor()`, populate 1 `signal`. Component cần snapshot dữ liệu lúc khởi tạo (thay vì bind trực tiếp signal trong template) dùng `effect()` trong constructor để tự đồng bộ lại khi signal đổi — KHÔNG dùng `ngOnInit` đọc `signal()` một lần (vì lúc đó dữ liệu backend có thể chưa kịp về). Xem ví dụ ở `customizer-3d.component.ts`, `shop-the-room.component.ts`, `home.component.ts`.
- Overlay toàn cục (cart-drawer, modal, toast, quick-view) đặt ở `AppComponent`, không lặp lại per-page — giống pattern AuraPC.

---

## 7. Service Structure — `my-client` (`core/services/`)

| Service | Vai trò | Backend thật? |
|---|---|---|
| `auth.service.ts` | OTP theo số điện thoại, JWT, signal `currentUser`, lưu `localStorage['deco3d_user'/'deco3d_token']`, cập nhật hồ sơ (gender/dateOfBirth) + upload avatar | ✅ |
| `address.service.ts` | Sổ địa chỉ giao hàng (CRUD, đặt mặc định) + API hành chính VN công khai cho cascading tỉnh/huyện/xã | ✅ |
| `product.service.ts` | CRUD sản phẩm, các computed `customizableProducts`/`readyStockProducts`/`printOnDemandProducts` | ✅ |
| `room.service.ts` | Danh sách phòng 3D, phòng đang active, sản phẩm gắn hotspot trong phòng | ✅ |
| `custom-request.service.ts` | Tạo yêu cầu thiết kế riêng, chat, đổi trạng thái/báo giá, convert sang giỏ hàng | ✅ |
| `community.service.ts` | Bài đăng cộng đồng, like/unlike/comment (server), isLiked/isSaved (client-only, localStorage) | ✅ (một phần) |
| `news.service.ts` | Blog/insight, lọc theo category, tăng view khi đọc | ✅ |
| `cart.service.ts` | Giỏ hàng (localStorage, chưa đồng bộ server), tính giá theo customization, coupon | ❌ (vẫn local) |
| `order.service.ts` | Tạo/tra cứu đơn hàng, cập nhật tiến độ sản xuất | ✅ |
| `warranty.service.ts` | Tra cứu/tạo yêu cầu bảo hành | ✅ |
| `payment.service.ts` | Tạo giao dịch MoMo/ZaloPay | ✅ |
| `coin.service.ts` | Số dư xu + lịch sử, claim thưởng (idempotent theo `reason+refId`) | ✅ |
| `quiz.service.ts` | Tính kết quả Trắc Nghiệm Phong Cách (thuần client, dữ liệu tĩnh) | — |
| `support-chat.service.ts` | Chat hỗ trợ realtime qua Socket.IO | ✅ |
| `ai-assistant.service.ts` | Modal trợ lý AI gợi ý ý tưởng decor | — |
| `toast.service.ts` | Toast thông báo toàn app (mới) | — |
| `cart-fly.service.ts` | Hiệu ứng bay ảnh sản phẩm vào icon giỏ hàng (mới) | — |
| `quick-view.service.ts` | State popup xem nhanh sản phẩm (mới) | — |
| `login-modal.service.ts` | State mở/đóng modal đăng nhập | — |
| `recently-viewed.service.ts` | Lịch sử xem sản phẩm (localStorage) | ❌ |

**`my-admin`** có bản sao độc lập của: `product.service.ts`, `room.service.ts`, `custom-request.service.ts`, `cart.service.ts`, `order.service.ts` — **không có** `community.service.ts`/`news.service.ts` (admin chưa có tab quản lý 2 mảng này), **không có** `coin.service.ts`/`quiz.service.ts`/toast/cart-fly/quick-view (các tính năng UX đó chỉ dành cho khách hàng).

---

## 8. Authentication / Authorization Flow

> **Đính chính (2026-09-22)**: mục này trước đây mô tả sai — ghi là dùng JWT nhưng code thật KHÔNG dùng JWT/token nào cả. Đã sửa lại theo đúng code hiện tại.

**Client (`my-client`):**
1. Đăng nhập bằng **số điện thoại + mật khẩu** (bcrypt), KHÔNG dùng JWT/token — tham khảo đúng cơ chế của VitaCare-main: backend trả thẳng object `user` (đã bỏ `password`) sau khi login/register thành công.
2. OTP chỉ dùng để **xác thực số điện thoại lúc đăng ký / quên mật khẩu** (`OTP_DEV_MODE=true` trả thẳng mã trong response, chưa gắn SMS thật) — không phải cơ chế đăng nhập chính.
3. `AuthService` lưu nguyên `user` vào `localStorage['deco3d_user']`, giữ trong 1 signal `currentUser`. **Không có interceptor** (`core/interceptors/` không tồn tại) — các request cần xác thực tự gửi kèm `userId` trong body/query, server tin thẳng giá trị này (`middleware/auth.js`: `attachUserId`/`requireUserId`).
4. Không có route guard — trang `account` tự kiểm tra `authService.currentUser()`.

**Backend:**
- `server/middleware/auth.js`: `requireUserId`/`attachUserId` (đọc `userId` client gửi lên, không verify gì cả — mô hình "tin client" có chủ đích, đánh đổi lấy sự đơn giản) + `requireAdminId` (mới thêm, cùng mô hình, dùng cho admin).
- **Admin (`my-admin`) giờ đã có đăng nhập**: `server/models/Admin.js` (username + password bcrypt), `POST /api/admin/auth/login`. Các route ghi dữ liệu admin-only (`product`/`room` CRUD, `custom-request` đổi trạng thái, `order` list-all + cập nhật tiến độ, `news` CRUD) đã gắn `requireAdminId`. **Vẫn không phải bảo mật thật** (không token, ai tự chế `adminId` trong request vẫn qua được nếu gọi thẳng API bằng Postman/curl) — chấp nhận đánh đổi để nhất quán với toàn bộ auth hiện có của Lam-a-main, xem quyết định ở mục 15.
- **Bảo mật giá đã được vá**: `POST /api/orders` giờ tính lại `unitPrice`/`subtotal`/`discount`/`shippingFee`/`total` từ sản phẩm THẬT trong DB (`server/utils/pricing.js`), không tin số tiền client gửi lên nữa.
- Route ghi dữ liệu của `community`/`custom-request` (POST `/:id/messages`) vẫn dùng chung giữa khách hàng và shop nên KHÔNG protect bằng `requireAdminId` — cần tách endpoint riêng nếu muốn siết chặt hơn.

**Admin (`my-admin`):** đã có màn hình đăng nhập (`pages/login/`) + `adminAuthGuard` (route `''` yêu cầu đăng nhập, chưa đăng nhập redirect `/login`) + `AdminAuthService` (signal `currentAdmin`, lưu `localStorage['deco3d_admin']`). Tài khoản mặc định do `server/seed/seed.js` tạo (`ADMIN_DEFAULT_USERNAME`/`ADMIN_DEFAULT_PASSWORD` trong `.env`, mặc định `admin`/`admin123` — **phải đổi trước khi deploy thật**).

---

## 9. API Pattern (Backend — `server/`)

```
server/
├── index.js              # Entry: connectDB, CORS whitelist (localhost:4200 + 4201), mount route, error handler
├── config/db.js           # Kết nối MongoDB qua mongoose.connect()
├── middleware/auth.js      # requireAuth/optionalAuth
├── models/*.js             # 1 Mongoose model / file, KHÔNG dùng TypeScript
├── routes/*.js              # 1 router Express / domain
├── utils/{otp,momo,zalopay}.js
└── seed/                    # convert-mock-data.js (chuyển mock-data.ts → CommonJS) + seed.js (nạp MongoDB,
                                bỏ qua nếu collection đã có dữ liệu)
```

- Pattern route: `async/await` + `try/catch`, log lỗi, trả JSON `{ success: boolean, ... }` hoặc `{ success: false, error }`.
- **Không tách `utils/` cho business logic phức tạp** như AuraPC-main (build filter, normalize) — route tự xử lý trực tiếp, các route hiện tại đơn giản nên chưa cần tách.
- **`id` field**: mọi document (Product/Room/CustomRequest/CommunityPost/NewsArticle) có field `id: String` tường minh riêng biệt với `_id` của Mongo — để khớp 1:1 với interface TypeScript phía frontend (vốn dùng `id: string`) mà không cần sửa bất kỳ component nào. `_id`/`__v` vẫn tồn tại trong response nhưng bị frontend bỏ qua.
- **Bảo mật giá**: order tạo qua `POST /api/orders` nhận thẳng `total`/`subtotal` từ client, **KHÔNG verify lại giá server-side** — khác AuraPC-main (verify giá từ DB khi thanh toán). Rủi ro cần lưu ý nếu có thanh toán thật.
- **Idempotency**: chỉ `CoinTransaction` có cơ chế chống nhận thưởng trùng (unique index `user+reason+refId`).

---

## 10. Data Flow & Nguồn dữ liệu

```
Component → service (signal cục bộ) → HttpClient → server/routes/*.js → Mongoose → MongoDB
                ↑                                                              │
                └──────────────── response { success, data } ──────────────────┘
```

- **Tất cả 10 domain đã có backend thật**: User, Order, Warranty, OtpCode, ChatMessage, CoinTransaction (có từ trước) + Product, Room, CustomRequest, CommunityPost, NewsArticle (mới thêm).
- **Còn thuần client-side (localStorage, chưa có backend)**: giỏ hàng (`cart.service.ts`), lịch sử xem gần đây (`recently-viewed.service.ts`), coupon (`MOCK_COUPONS` tĩnh trong `mock-data.ts`), trạng thái like/save cộng đồng theo trình duyệt.
- `mock-data.ts` (trong `my-client`) giờ chỉ còn vai trò **nguồn seed ban đầu** cho MongoDB (qua `server/seed/`), không còn được service nào đọc trực tiếp lúc runtime nữa.
- Không có cache/state trung gian phức tạp — mỗi service tự giữ 1 signal, gọi `refresh()` lại sau mỗi lần ghi thành công (`tap()` trong RxJS pipe hoặc gọi thủ công trong `.subscribe()`).

---

## 11. Layout & Shared Components

- `AppComponent` (my-client) = layout gốc duy nhất: header + `<router-outlet>` (có class `route-fade`/`route-fade--leaving` để fade nhẹ khi chuyển route) + footer + toàn bộ overlay (cart-drawer, ai-modal, login-modal, support-chat-widget, product-quick-view, toast).
- `AppComponent` (my-admin) = tối giản, chỉ `<router-outlet>`; toàn bộ layout (sidebar/topbar) nằm trong `AdminComponent` chứ không tách `layout/` riêng như AuraPC-main.
- Icon: tự vẽ SVG trong `components/icon/icon.component.html` (switch theo `name`), không dùng icon-font/thư viện ngoài — mỗi icon mới phải thêm `<ng-container *ngIf="name === '...'">` thủ công.

---

## 12. CSS / Styling Pattern

- **Không dùng Tailwind CLI/PostCSS nữa** — `styles.css` là ~3000+ dòng CSS tĩnh "đóng băng" từ lần build Tailwind cuối, cộng thêm 1 khối `:root` design token (spacing/radius/shadow/z-index — tham khảo cấu trúc VitaCare) và token màu/font (tham khảo AuraPC) được viết tay ở đầu file.
- **HTML vẫn giữ nguyên class kiểu Tailwind** (`bg-amber-400`, `text-neutral-900`, `bg-[#F6F5F2]`...) — khi cần đổi theme, sửa TRỰC TIẾP giá trị trong rule đã compile của `styles.css` thay vì sửa từng file HTML, miễn là ý nghĩa ngữ nghĩa của class đó nhất quán toàn app (một class dùng cho 2 vai trò khác nhau ở 2 nơi — ví dụ `bg-neutral-900` từng vừa là nút CTA vừa là nền sidebar admin — phải tách ra class/màu riêng, không thể remap chung).
- Theme hiện tại: nền đen (`#000000`/`#0a0a0a`/`#111111`), chữ trắng/xám, accent cam `#FF6D2D` (thay cho vàng gold cũ), accent xanh `#2055AF` cho nút phụ, font **Satoshi** (heading) + **Inter** (nội dung) — chuyển thể từ bảng màu/font của AuraPC-main.
- Component có màu/token riêng ngoài `styles.css` (ví dụ `footer.component.css`, `style-quiz.component.css`) tự khai `:root { --ft-accent: ...; }` cục bộ, không phụ thuộc biến global.
- Hiệu ứng: `.reveal-up/-left/-right/-scale` (scroll-reveal qua `IntersectionObserver`), `.fly-to-cart-clone` + `.cart-bump` (bay ảnh vào giỏ hàng), `.route-fade` (chuyển trang) — tất cả định nghĩa trong `styles.css`, áp dụng qua class hoặc directive `appScrollReveal`.

---

## 13. Các Pattern quan trọng (tổng hợp)

1. **2 Angular project độc lập** (`my-client`/`my-admin`), không thư viện dùng chung, code trùng lặp có chủ đích.
2. **Backend monolith gọn** (`server/index.js` mount route theo domain) phục vụ cả 2 FE, JWT + OTP, có interceptor tự động gắn JWT ở `my-client`.
3. **`effect()` để đồng bộ signal bất đồng bộ vào state component** — pattern bắt buộc phải dùng cho MỌI nơi từng đọc `service.signal()` một lần lúc khởi tạo (khác AuraPC/Vita vì ở đó phần lớn dữ liệu đã có sẵn đồng bộ hoặc bind trực tiếp signal trong template).
4. **`id` field tường minh** trên mọi Mongoose model để khớp interface TypeScript có sẵn, tránh phải sửa hàng loạt file frontend khi thêm backend.
5. **CSS "đóng băng"**: đổi theme = sửa giá trị trong `styles.css`, không sửa class trong HTML — nhưng phải cẩn thận class nào bị dùng đa vai trò.
6. **Sản phẩm có sẵn ↔ tùy biến in 3D là 2 danh mục tách biệt hoàn toàn** (route, trang quản lý, computed signal riêng: `readyStockProducts` vs `customizableProducts`), không lọc chung 1 danh sách.
7. **Bảo mật còn khoảng trống đã biết**: admin không có auth/role, giá đơn hàng không verify server-side — chấp nhận được ở giai đoạn hiện tại, cần xử lý trước khi lên production thật.
8. **Seed từ chính source TypeScript**: `server/seed/convert-mock-data.js` biến `mock-data.ts` thành CommonJS để tái dùng dữ liệu mẫu thay vì viết lại tay.

---

## 14. Danh sách file quan trọng

| File | Vai trò |
|---|---|
| `projects/my-client/src/app/app.routes.ts` | Toàn bộ route khách hàng |
| `projects/my-client/src/app/app.component.ts` | Shell gốc + hiệu ứng chuyển trang |
| `projects/my-client/src/app/core/services/product.service.ts` | Mẫu chuẩn cho pattern service-gọi-backend-signal |
| `projects/my-client/src/app/shared/directives/scroll-reveal.directive.ts` | Hiệu ứng scroll-reveal dùng chung |
| `projects/my-client/src/styles.css` | Toàn bộ design token + CSS "đóng băng" — sửa theme ở đây |
| `projects/my-admin/src/app/pages/dashboard/admin.component.ts` | Toàn bộ logic dashboard admin (1 file lớn) |
| `server/index.js` | Mount toàn bộ route, CORS, error handler |
| `server/middleware/auth.js` | JWT middleware (chỉ có user, không có admin) |
| `server/seed/seed.js` | Nạp dữ liệu mẫu vào MongoDB |
| `server/routes/coinRoutes.js` | Mẫu route có idempotency (tham khảo khi thêm domain mới cần chống trùng) |
| `REFERENCE_ARCHITECTURE.md` | Bản đồ AuraPC-main (tham khảo màu/font/pattern) |
| `vita.md` | Bản đồ VitaCare-main (tham khảo cấu trúc CSS/layout) |

---

## 15. Trạng thái hiện tại — việc đã xong vs còn thiếu

**Đã xong:**
- Tách `my-client`/`my-admin` thành 2 project Angular độc lập, build/serve riêng.
- Backend thật cho 10 domain (User, Order, Warranty, OtpCode, ChatMessage, CoinTransaction, Product, Room, CustomRequest, CommunityPost, NewsArticle) — CRUD qua MongoDB, có seed script.
- Retheme toàn site sang theme tối/cam/xanh + font Satoshi/Inter (tham khảo AuraPC-main).
- Tách rạch ròi "Sản phẩm có sẵn" ↔ "Tùy biến in 3D" ở cả client (catalog/customizer) và admin (2 sub-tab).
- Hạ tầng hiệu ứng UX: toast, cart-fly animation, product quick-view, scroll-reveal, page transition.
- Tính năng mới: Trắc Nghiệm Phong Cách Decor (`/style-quiz`), hệ thống coin/rewards (idempotent).
- 3D: customizer sản phẩm + phòng "Shop The Room" hỗ trợ model `.glb` thật lẫn procedural fallback.
- Thanh toán MoMo/ZaloPay/ATM (qua cổng MoMo, `requestType: payWithATM`) sandbox + VietQR (ảnh QR tĩnh qua vietqr.io), tra cứu đơn hàng/bảo hành không cần đăng nhập.
- Feature Tài khoản đầy đủ (tách shell + 4 sub-component: Hồ sơ, Đơn hàng, Sổ địa chỉ, Xu thưởng) — hồ sơ mở rộng (giới tính/ngày sinh/avatar upload), sổ địa chỉ CRUD với cascading tỉnh/huyện/xã (API hành chính VN công khai), đơn hàng có filter theo trạng thái + tìm kiếm. Tham khảo AuraPC-main (`account-page.component.ts`, `address.service.ts`, route `/profile`/`/avatar`/`/addresses`).
- **AI Idea Assistant dùng LLM thật** (Google Gemini free tier, `server/routes/aiRoutes.js`) thay cho keyword-matching giả trước đây — có catalog-injection (gợi ý sản phẩm READY_STOCK có thật kèm link) tham khảo pattern AruBot của AuraPC-main.
- **Bảo mật giá đơn hàng**: `POST /api/orders` tính lại giá từ sản phẩm thật trong DB (`server/utils/pricing.js`), không tin số tiền client gửi lên.
- **Admin có đăng nhập** (username/password, `pages/login/` + `adminAuthGuard`), các route ghi dữ liệu admin-only đã gắn `requireAdminId`. Xem mục 8 để biết giới hạn (không phải bảo mật thật, chỉ tin id client gửi lên — quyết định có chủ đích để nhất quán với auth hiện có).

**Còn thiếu / nợ kỹ thuật đã biết (chưa được yêu cầu xử lý):**
- Giỏ hàng vẫn thuần localStorage, chưa đồng bộ server theo user đăng nhập.
- Admin auth chỉ tin `adminId` client gửi lên, không có token thật — gọi thẳng API bằng Postman/curl với `adminId` bất kỳ vẫn qua được. Đã được người dùng xác nhận chấp nhận đánh đổi này (ưu tiên nhất quán với auth hiện có hơn bảo mật tuyệt đối).
- Modal "Thêm sản phẩm mới" trong admin chưa có form thật (mới set cờ hiển thị, chưa render UI).
- Coupon vẫn là `MOCK_COUPONS` tĩnh (không có collection Promotion riêng), dùng chung file `mock-data.generated.js` cho cả seed lẫn verify giá.
- Chưa có test case cụ thể (chỉ có scaffold Karma/Jasmine mặc định).
