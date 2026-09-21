# vita.md

> Tài liệu khảo sát kiến trúc — **project tham khảo**: VitaCare-main.
> Nguồn khảo sát: `C:\Users\THIS PC\Downloads\VitaCare-main\VitaCare-main` (chỉ đọc, không có thay đổi nào được thực hiện lên project này).
> Ngày khảo sát: 2026-09-20.
> Mục đích: làm bản đồ kiến trúc để một dự án khác (Lam-a-main) tham khảo pattern/tổ chức code khi cần — không phải bản sao code, không dùng để copy nguyên văn.

---

## 1. Technology Stack

VitaCare-main **không phải** một Angular workspace monorepo kiểu ng-cli chuẩn (không có `projects/` dùng chung 1 `angular.json` gốc). Đây là **3 project độc lập nằm cạnh nhau trong 1 repo git**, mỗi cái có `package.json`/`angular.json` riêng, tự chạy `ng serve` riêng:

| App | Vai trò | Framework | Ngôn ngữ |
|---|---|---|---|
| `my-user` | Web khách hàng (nhà thuốc online) | Angular ^21.0.0 (standalone components) | TypeScript ~5.9.2 |
| `my-admin` | Trang quản trị (admin + dược sĩ) | Angular ^21.0.0 (standalone components) | TypeScript ~5.9.2 |
| `backend` | API server | Express ^5.2.1 + Mongoose ^8.0.0 | JavaScript thuần (CommonJS, không TypeScript) |

Root `package.json` (ở gốc VitaCare-main) chỉ khai báo `three: ^0.183.2` — đây là bản sao/placeholder, thư viện `three` thực sự được dùng và khai báo trong `my-user/package.json`.

### `my-user` (app khách hàng) — dependencies chính
- `@angular/core|common|compiler|forms|platform-browser|router` `^21.0.0`
- `rxjs ~7.8.0`, `tslib`
- `bootstrap ^5.3.8` — UI framework/CSS (kèm Bootstrap Icons class `bi bi-*` dùng trong template)
- `three ^0.183.2` + `three/examples/jsm` (`GLTFLoader`, `OrbitControls`) + `@types/three` — dùng cho mô hình giải phẫu 3D tương tác trong tính năng "Tra cứu bệnh" (`features/healthcare/disease/disease.ts`)
- `mongoose ^9.2.2` — **khai báo ở frontend** vì các file model Mongoose (`.js`) đặt ngay trong `src/app/core/models/` được backend `require()` lại (xem mục 9)
- Dev: `@angular/cli`, `@angular/build`, `vitest ^4.0.8` (test runner, không phải Jasmine/Karma mặc định cũ), `concurrently` (script `npm run dev` chạy song song backend + `ng serve`), `jsdom`

### `my-admin` (app quản trị) — dependencies chính
- `@angular/*` `^21.0.0`, `rxjs`, `bootstrap ^5.3.8`
- `flatpickr ^4.6.13` — date picker (có wrapper riêng `shared/vc-flatpickr`)
- `leaflet ^1.9.4` + `@types/leaflet` — bản đồ (dùng cho `home/dashboard-vn-map`, có thể cả chọn địa điểm cửa hàng)
- `quill ^2.0.3` + `ngx-quill ^30.0.1` — rich text editor (soạn blog, mô tả bệnh)
- `pdfmake ^0.3.7` — xuất PDF (hoá đơn/đơn hàng, thấy `dashboard-export.service.ts`)
- `xlsx ^0.18.5` — xuất/nhập Excel
- Dev: `@angular/cli`, `vitest`, `jsdom`

### `backend` — dependencies chính
- `express ^5.2.1` (Express 5, không phải 4)
- `mongoose ^8.0.0` — kết nối MongoDB
- `bcryptjs ^3.0.3` — hash mật khẩu
- `multer ^2.1.1` — upload file (ảnh blog, ảnh nhắc thuốc, avatar, banner khuyến mãi)
- `nodemailer ^8.0.1` — gửi email (OTP/quên mật khẩu)
- `cors`, `dotenv`
- Không có: JWT, passport, helmet, express-validator, TypeScript, ORM khác

**Styling approach**: CSS thuần theo component (`*.css` cạnh mỗi component, không SCSS/LESS), có 1 lớp "design system" tập trung bằng CSS variables (`src/styles/variables.css`) + Bootstrap 5 làm nền utility/grid, không dùng Tailwind.

**3D (three.js)**: chỉ dùng ở đúng 1 nơi trong `my-user` — `features/healthcare/disease/disease.ts` — render mô hình giải phẫu người dạng GLTF, có `OrbitControls` (xoay/zoom) và raycasting (click chọn bộ phận cơ thể để xem thông tin bệnh liên quan).

---

## 2. Kiến trúc tổng thể (Monorepo dạng "3 project cạnh nhau")

```
VitaCare-main/
├── my-user/          # App khách hàng (Angular) — website nhà thuốc, đọc/tra cứu, mua hàng, tư vấn, nhắc thuốc
├── my-admin/         # App quản trị (Angular) — dashboard cho admin + dược sĩ (pharmacist)
├── backend/          # API server (Express + MongoDB) — phục vụ cả my-user lẫn my-admin
├── data/             # Bộ dữ liệu JSON dùng để SEED/IMPORT vào MongoDB (không phải DB runtime)
├── assets/           # Ảnh/logo/icon/mascot dùng chung ở cấp gốc repo (nguồn gốc trước khi copy vào src/assets của my-user)
├── .vscode/          # Cấu hình workspace VSCode
├── package.json      # Chỉ có "three" — có vẻ là leftover/không phải entry chính của repo
└── package-lock.json
```

Giải thích vai trò:
- **`my-user`**: SPA khách hàng — mua thuốc/thực phẩm chức năng, tra cứu bệnh (kèm mô hình 3D), tư vấn đơn thuốc, đặt nhắc lịch uống thuốc, blog sức khỏe, quiz sức khỏe, chatbot "VitaBot".
- **`my-admin`**: SPA quản trị — quản lý sản phẩm/danh mục/đơn hàng/khách hàng/khuyến mãi/blog/bệnh/tư vấn, có phân vai **admin** và **pharmacist (dược sĩ)** với khu vực riêng ("pharmacist-only" cho blog, bệnh, tư vấn bệnh).
- **`backend`**: 1 Express server DUY NHẤT phục vụ API cho cả `my-user` và `my-admin` (route `/api/...` cho user, `/api/admin/...` cho admin), kết nối MongoDB (`mongodb://localhost:27019/VitaCare`), có `oauth-social.js` (Google/Facebook login), `vitabot-chat.js` (chatbot AI qua Replicate/Gemini), `importData.js`/`scripts/seed-users.js` (nạp dữ liệu mẫu).
- **`data/`**: các file `.json` là **dữ liệu mẫu/seed** (users, products, categories, orders, reminders, quiz, diseases, doctors, pharmacists, promotions, store locations...) để `backend/importData.js` nạp vào MongoDB khi khởi tạo — không phải database thật đang chạy (DB thật là MongoDB, port 27019).
- **`assets/`**: kho ảnh gốc (favicon, icon, logo, mascot, images) — nguồn để copy/đối chiếu vào `my-user/public` hoặc `my-user/src/assets` khi cần, không phải thư mục asset runtime chính thức của Angular.

---

## 3. Folder Structure chi tiết — `my-user` (app chính, đã xác nhận)

```
my-user/src/app/
├── components/                  # Một vài component dùng chung nhưng không thuộc "shared" chuẩn
│   ├── order-detail-modal/
│   └── review-form/
├── core/                        # Lớp lõi: service, model, guard, hằng số, route phụ trợ
│   ├── constants/
│   │   └── navigation.constants.ts
│   ├── guards/
│   │   └── auth.guard.ts
│   ├── models/                  # Trộn lẫn Mongoose schema (.js) VÀ TypeScript interface (.ts)
│   │   ├── Product.js / Category.js / Blog.js / User.js / Order.js / Cart.js
│   │   ├── HealthProfile.js / Prescription.js / Consultation.js / Review.js / HealthVideo.js
│   │   ├── ProductFAQ.js / quiz.js / result.js
│   │   └── store.model.ts        # duy nhất 1 model dạng TS interface thuần
│   ├── routes/                   # Router Express "mồ côi" (quizzes.js, stores.js) — KHÔNG được server.js dùng, có vẻ là tàn dư từ giai đoạn tách route trước khi dồn hết vào server.js
│   └── services/                  # ~30 service (xem mục 6)
├── features/                     # Theo domain nghiệp vụ (feature-based, không theo loại UI)
│   ├── accounts/                  # account, addresses, auth, cart, info, notice, order, order-detail-acc, orders, prescriptions, remind, return, reviews
│   ├── blogs/                     # blog, blog-category, blog-detail, blog-quick-view, blog-sub-category, recently-viewed-blogs, topic, topic-category
│   ├── healthcare/                # bmi-calculator, consultation, disease, disease-details, disease-group-details, health, health-detail, health-test
│   ├── pages/                     # about, expired-link, home, store-system
│   ├── policies/                  # 10+ trang chính sách tĩnh (giao hàng, bảo mật, đổi trả, điều khoản...)
│   └── products/                  # feature-categories, product, product-detail, product-filter, product-gallery, product-info-summary, product-list, product-quick-view, product-tabs-content, recently-viewed-products
├── shared/                        # Widget dùng lại toàn app: coin, date-picker, date-range-picker, floating-actions, footer, header, loading-shipping, vc-searchable-select, vitabot (chatbot)
├── app.config.ts                  # providers gốc (router, http client, APP_INITIALIZER)
├── app.routes.ts                  # route table
├── app.ts / app.html / app.css    # shell gốc (header + router-outlet + footer + các overlay toàn cục)
```

**Quy ước đặt tên**: mỗi component nằm trong 1 thư mục riêng cùng tên component (`product-detail/product-detail.ts|.html|.css|.spec.ts`), tên file không có hậu tố `.component` (khác convention Angular mặc định cũ) — ví dụ class `Product`, file `product.ts`, selector suy ra từ Angular CLI mới.

**Pattern chủ đạo**: 100% **standalone component** (`standalone: true`, mảng `imports` trực tiếp trong `@Component`), **không dùng NgModule**, lazy-load qua `loadComponent()` trong route table, dùng **Angular Signals** (`signal()`) cho state cục bộ/service state thay vì chỉ RxJS, cú pháp control-flow mới `@if`/`@for` trong template thay vì `*ngIf`/`*ngFor`.

---

## 4. Routing Structure — `my-user` (`app.routes.ts`)

| Path | Component | Ghi chú |
|---|---|---|
| `` | redirect → `HOME_ROUTE_SEGMENT` | hằng số route, không hardcode string |
| `nhathuocvitacare` (giá trị `HOME_ROUTE_SEGMENT`) | `Home` | route tiếng Việt/thương hiệu làm trang chủ thật |
| `home` | redirect → home segment | alias |
| `category/tra-cuu-benh/:groupSlug` | `DiseaseGroupDetails` | đặt TRƯỚC route category chung để tránh match nhầm |
| `category/:slug/:subslug/:seg3`, `category/:slug/:subslug`, `category/:slug` | `Product` (danh sách) | route param lồng nhiều cấp cho breadcrumb danh mục |
| `products`, `tim-kiem` | `Product` | route tiếng Việt cho tìm kiếm |
| `product/:slug` | `ProductDetail` | |
| `account` | `Account` | **canActivate: [authGuard]** |
| `order`, `addresses`, `info`, `reviews`, `return`, `prescriptions` | các trang tài khoản | không có guard (có thể tự kiểm tra login trong component) |
| `consultation` | `Consultation` | tư vấn đơn thuốc |
| `health` | `Account` | **canActivate: [authGuard]** (dùng lại component Account) |
| `health/bmi` | `BmiCalculator` | public |
| `health/nhac-lich-uong-thuoc` | `Account` | **canActivate: [authGuard]** — nhắc lịch uống thuốc |
| `health/:key` | `HealthDetailComponent` | **canActivate: [authGuard]**, route param |
| `health-test` | `HealthTestComponent` | quiz sức khỏe |
| `store-system` | `StoreSystemComponent` | hệ thống nhà thuốc/cửa hàng |
| `policy/gioi-thieu`, `policy/giay-phep-kinh-doanh`, `policy/quy-che-hoat-dong`, `policy/chinh-sach-*` (7 route), `policy/thong-tin-trung-tam-bao-hanh`, `policy/dieu-khoan-su-dung` | các trang chính sách tĩnh | toàn bộ path tiếng Việt |
| `about` | `About` | |
| `blog`, `blog/:slug`, `blog/danh-muc/:categorySlug`, `blog/danh-muc/:categorySlug/:subcategorySlug` | các trang blog | route param lồng cấp |
| `topic`, `topic/:specialtySlug` | chuyên mục blog | |
| `disease`, `disease/:id`, `benh/:id` (alias cũ) | tra cứu bệnh | hỗ trợ cả id lẫn slug |
| `**` | `ExpiredLink` | wildcard/404 |

Nhận xét: **toàn bộ route dùng tiếng Việt không dấu** cho URL công khai (SEO-friendly), route param xuất hiện nhiều (đến 3 cấp `:slug/:subslug/:seg3`), guard (`authGuard`) chỉ áp cho một số route liên quan tài khoản/sức khỏe cá nhân, không có nested route dạng `children` (khác `my-admin`).

`authGuard` (functional guard kiểu Angular mới, `CanActivateFn`) kiểm tra `authService.currentUser()` (signal) — nếu chưa đăng nhập thì mở modal đăng nhập và điều hướng về trang chủ thay vì đến trang login riêng (không có `/login` route ở `my-user`, đăng nhập là modal overlay toàn cục `<app-auth>`).

### Routing — `my-admin` (`app.routes.ts`)
Có **nested route với `children`** (khác `my-user`):
```
'' → redirect 'login'
'login' → Login
'admin' → Layout (parent), children:
  '' → redirect 'dashboard'
  'dashboard' → Home
  'orders', 'orders/detail/:id', 'orders/create', 'orders/edit/:id' → Ordermanage/Orderdetail
  'customers', 'customers/create', 'customers/detail/:id' → Customermanage/Customerdetail
  'products' → Productmanage
  'blogs' → PharmacistOnlyShell (children: '', 'detail', 'create' → Blogmanage/Blogdetail)
  'promotions' → Promotionmanage
  'diseases' → PharmacistOnlyShell (children: '', 'detail', 'create' → Diseasemanage/Diseasedetail)
  'consultation-prescription' → Consultationprescription
  'consultation-product' → Consultationproduct
  'consultation-disease' → PharmacistOnlyShell (children: '' → Consultationdisease)
```
`PharmacistOnlyShell` không phải guard định tuyến (`CanActivate`) mà là 1 **shell component bọc `<router-outlet>`**, tự đọc `AuthService.isPharmacistAccount()` trong `ngOnInit` để quyết định hiển thị nội dung hay chặn — tức là kiểm soát truy cập theo vai trò được làm ở tầng component/UI, không phải tầng route guard.

---

## 5. Component Structure & Pattern

- **100% standalone component** ở cả `my-user` và `my-admin`, không có `NgModule` nào được dùng cho feature.
- UI framework nền: **Bootstrap 5** (class utility + Bootstrap Icons `bi bi-*`), không có thư viện component Angular kiểu Angular Material/PrimeNG/NG-ZORRO.
- `my-admin` bổ sung thêm các thư viện UI chuyên biệt: `ngx-quill`/`quill` (rich text), `flatpickr` (date picker, có wrapper `shared/vc-flatpickr`), `leaflet` (bản đồ Việt Nam trong `home/dashboard-vn-map`).
- Template dùng cú pháp control-flow mới (`@if`, `@for`) thay vì directive `*ngIf`/`*ngFor` cũ.
- State cục bộ dùng Angular **Signals** (`signal()`, computed) kết hợp RxJS Observable cho gọi HTTP — không dùng NgRx/Redux/Akita.
- **Theme/màu thương hiệu** (định nghĩa ở `my-user/src/styles/variables.css`):
  - Primary: `#00589F` (xanh dương đậm, "Main Blue"), hover `#2B3E66`, light `#43A2E6`
  - Secondary: `#BAA7DE` (tím/lavender)
  - Success: `#3478C7`, Warning: `#F2994A`, Danger: `#EB5757`, Info: `#9B51E0`
  - Nền trang: `#E5EEF8` (xanh rất nhạt); nền tối: `#0A0A0A`
  - Font: Inter (nội dung/tiêu đề) + Arimo, cùng icon font Material Symbols Rounded và Bootstrap Icons
  - Toàn bộ token nằm trong CSS variables (`--color-*`, `--font-*`, `--spacing-*`, `--radius-*`) — 1 file design-system tập trung duy nhất, các component khác chỉ tham chiếu `var(--...)`.

---

## 6. Service Structure — `my-user` (`src/app/core/services/`, ~30 file)

| Service | Vai trò |
|---|---|
| `auth.service.ts` | State đăng nhập hiện tại (signal `currentUser`), lưu/đọc `localStorage` (`vitacare_user`), điều khiển modal đăng nhập/đăng xuất, banner thông báo |
| `auth-api.service.ts` | Gọi API `/api/auth/*` (login, register, otp, forgot/reset password, exchange OAuth code) |
| `product.service.ts` | CRUD/list sản phẩm, chuẩn hoá URL ảnh media |
| `category.service.ts`, `store.service.ts`, `promotion.service.ts` | Danh mục, cửa hàng, khuyến mãi |
| `cart.service.ts`, `cart-sidebar.service.ts`, `cart-animation.service.ts`, `buy-now.service.ts` | Giỏ hàng + hiệu ứng bay vào giỏ + mua ngay |
| `order.service.ts`, `order-detail-modal.service.ts` | Đơn hàng |
| `prescription.service.ts`, `consultation-cart.service.ts` | Tư vấn đơn thuốc |
| `disease.service.ts`, `doctor.service.ts`, `health-api.service.ts`, `health-test.service.ts` | Tra cứu bệnh, bác sĩ, hồ sơ sức khỏe, quiz sức khỏe |
| `reminder.service.ts`, `reminder-badge.service.ts` | Nhắc lịch uống thuốc + badge số lượng chưa đọc |
| `blog.service.ts`, `blog-popup.service.ts`, `blog-quick-view.service.ts` | Blog sức khỏe |
| `review-sync.service.ts`, `review-badge.service.ts` | Đánh giá sản phẩm |
| `notice.service.ts` | Thông báo hệ thống cho user |
| `coin.service.ts` | Điểm thưởng/xu (gamification) |
| `chat.service.ts` | Chatbot VitaBot |
| `account-menu.service.ts`, `quick-view.service.ts`, `confirm.service.ts`, `toast.service.ts` | UI state phụ trợ (menu tài khoản, xem nhanh, hộp thoại xác nhận, toast) |

**Pattern gọi API**: mỗi service tự khai `HttpClient`, một số dùng hằng số `const API = '/api'` (đi qua `proxy.conf.json` khi `ng serve`, proxy `/api/**` → `http://localhost:3000`), nhưng **một số service khác lại hardcode tuyệt đối** `http://localhost:3000/api/...` (ví dụ `product.service.ts`) — **không nhất quán** giữa các service, không có 1 `environment.ts`/`environment.prod.ts` tập trung cấu hình base URL.

**Quản lý state**: chủ yếu **luôn gọi server** (stateless theo từng lần gọi), chỉ vài state cục bộ/persist nhẹ dùng Signal + `localStorage` (user hiện tại, cờ đã xem popup...). Không có state management library toàn cục, không cache phức tạp — có 1 chỗ dùng `APP_INITIALIZER` để prefetch blog sớm (`app.config.ts`) nhằm "trúng cache" khi vào Home.

`my-admin` có service tương tự theo domain quản trị: `auth.service.ts`, `customer.service.ts`, `product.service.ts`, `order.service.ts`, `blog.service.ts`, `disease.service.ts`, `consultation.service.ts`, `promotion.service.ts`, `notice.service.ts`, `theme.service.ts`, `dashboard-preload.service.ts`, `dashboard-export.service.ts` (xuất PDF/Excel báo cáo), `quick-view.service.ts`.

---

## 7. Models/Interfaces

- **Không có thư mục "models" tách biệt kiểu TypeScript interface thuần** như thường thấy — thay vào đó, `my-user/src/app/core/models/` chứa chủ yếu **file `.js` định nghĩa Mongoose Schema** (`Product.js`, `Category.js`, `Blog.js`, `User.js`, `Order.js`, `Cart.js`, `HealthProfile.js`, `Prescription.js`, `Consultation.js`, `Review.js`, `HealthVideo.js`, `ProductFAQ.js`, `quiz.js`, `result.js`) — đây là **schema dùng chung giữa frontend và backend** (xem mục 9, backend `require()` thẳng các file này).
- Chỉ có **1 file** đúng nghĩa TypeScript model: `store.model.ts` (interface thuần cho dữ liệu cửa hàng).
- Các interface TypeScript khác (request/response DTO) được khai báo **rải rác ngay trong từng service** (ví dụ `AuthLoginRequest`, `AuthResponse` trong `auth-api.service.ts`; `Reminder`, `ReminderCreate` trong `reminder.service.ts`; `LoggedUser` trong `auth.service.ts`) — không tập trung vào 1 thư mục `models`/`interfaces` riêng cho kiểu dữ liệu FE.
- `my-admin` cũng theo pattern tương tự: interface khai trực tiếp trong file service dùng nó, không có thư mục model chung.

---

## 8. Authentication/Authorization Flow

- **Không dùng JWT/token**. Đăng nhập (`POST /api/auth/login`, nhận `phone` + `password`) → backend so khớp bằng `bcrypt.compare` (có fallback so sánh plain-text cho dữ liệu cũ chưa hash) → nếu đúng, trả thẳng **object user đầy đủ** (trừ field `password`) về client.
- Client (`my-user`) lưu nguyên object user vào `localStorage` key `vitacare_user`; `AuthService` khôi phục lại khi load app (`restoreUserFromStorage`) và giữ state hiện tại trong 1 **signal** `currentUser`.
- `my-admin` tương tự nhưng lưu key `admin`, phân biệt vai trò qua field `accountRole` (`'admin' | 'pharmacist'`) — `AuthService.isPharmacistAccount()` đọc trực tiếp từ `localStorage`.
- **OTP flow**: đăng ký (`/api/auth/register-otp` → sinh OTP 6 số lưu collection `otp_codes` với hạn 60s → `/api/auth/verify-otp*` → `/api/auth/register`), quên mật khẩu tương tự.
- **OAuth Google/Facebook**: đăng ký ở `backend/oauth-social.js`, redirect flow chuẩn, sau khi xong redirect về `my-user` kèm query `?oauth_code=...` → frontend gọi `POST /api/auth/oauth/exchange`.
- **Middleware xác thực backend**: **không tồn tại middleware auth toàn cục** — các route như `/api/orders`, `/api/reminders`, `/api/users/me` chủ yếu nhận `user_id`/`phone` trực tiếp từ query/body do client gửi lên, tin tưởng dữ liệu từ client.
- **Phân quyền admin/pharmacist**: kiểm tra ở tầng **component/UI** (`PharmacistOnlyShell` đọc `accountRole` từ `localStorage`), backend không có middleware chặn theo role ở route Express.
- **Guard ở frontend**: có (`my-user/core/guards/auth.guard.ts`, functional `CanActivateFn`), nhưng `my-admin` không dùng route guard mà dùng cách kiểm tra trong component.

---

## 9. API Pattern (Backend — `backend/`)

- Framework: **Express 5** (`server.js`), 1 file duy nhất, ~488KB, chứa hơn 200 endpoint khai trực tiếp bằng `app.get/post/put/patch/delete(...)` nối tiếp nhau — **không tách routes/controllers/services** theo pattern MVC thông thường.
- **Database**: MongoDB qua Mongoose (`db.js`, `mongodb://localhost:27019/VitaCare`), xen lẫn Mongoose Model và native driver collection helper.
- **Model dùng chung xuyên project**: `server.js` `require()` trực tiếp các file Mongoose Schema đặt trong `my-user/src/app/core/models/*.js` — schema DB được định nghĩa bên trong source Angular của app khách hàng, backend không có thư mục `models` độc lập cho các entity này.
- **Upload file**: `multer` với nhiều storage riêng theo mục đích (reminder, blog, promo).
- **Email**: `nodemailer` dùng cho OTP/khôi phục mật khẩu.
- **Chatbot "VitaBot"**: `backend/vitabot-chat.js` — xây ngữ cảnh từ MongoDB rồi gọi Replicate API (Qwen3) làm LLM chính, dự phòng Google Gemini.
- **Pattern xử lý lỗi**: mỗi route tự `try/catch`, trả JSON `{ success: false, message }`; không có error-handling middleware tập trung, không có validation middleware (không Joi/Zod).
- **Không tách middleware/utils thành thư mục riêng**.
- **Seed/import data**: `importData.js`, `scripts/seed-users.js` đọc file JSON trong `data/` (ở gốc repo) rồi nạp vào MongoDB.

---

## 10. Data Flow tổng quát

```
Component (Angular, standalone)
   │  gọi phương thức service (đồng bộ signal hoặc subscribe Observable)
   ▼
Service (core/services/*.ts, HttpClient)
   │  HTTP request tới '/api/...' (qua proxy.conf.json khi dev) hoặc URL tuyệt đối hardcode
   ▼
Express route trong backend/server.js (app.get/post/...)
   │  đọc/ghi qua Mongoose (Model hoặc native collection helper)
   ▼
MongoDB (mongodb://localhost:27019/VitaCare)
   │  trả JSON { success, data/user/... }
   ▼
Service parse response (map/catchError RxJS) → trả Observable/Promise cho component
   ▼
Component cập nhật signal/biến cục bộ → template re-render
```
Không có tầng cache/state store trung gian đáng kể; phần lớn thao tác là gọi thẳng server mỗi lần cần dữ liệu.

---

## 11. Layout & Shared Components

### `my-user`
- Layout gốc (`app.html`): `<app-header>` → `<router-outlet>` (bọc `main`) → `<app-footer>`, cộng thêm các overlay toàn cục: `<app-auth>` (modal đăng nhập/đăng ký), banner thành công header, toast hệ thống, `<app-cart>` (giỏ hàng dạng sidebar/drawer), `<app-floating-actions>` (nút nổi), `<app-product-quick-view>`, `<app-blog-quick-view>`.
- Widget dùng chung (`shared/`): `header` (kèm `header-search`, `header-icons`), `footer`, `floating-actions`, `vitabot` (chatbot nổi góc màn hình), `coin`, `date-picker`/`date-range-picker`, `loading-shipping`, `vc-searchable-select`.

### `my-admin`
- Layout gốc: `layout/layout.ts` — component cha có `<router-outlet>` cho toàn bộ route con `admin/*` (sidebar + topbar dạng admin dashboard chuẩn, theo cấu trúc `children` trong route).
- `pharmacist-only-shell`: shell trung gian bọc các route dành riêng cho dược sĩ.
- Widget dùng chung: `admin-mascot-loading`, `vc-flatpickr`, `vc-searchable-select`.
- Một số component UI dùng chung với `my-user` được **copy riêng** sang `my-admin` thay vì tách thư viện dùng chung — hai app hoàn toàn độc lập về code.

---

## 12. CSS/Styling Pattern

- **CSS thuần theo từng component** (`*.css` cạnh mỗi `*.ts`/`*.html`), không SCSS/LESS, không CSS-in-JS.
- **Design token tập trung**: `my-user/src/styles/variables.css` — toàn bộ màu sắc, font, spacing, radius, transition khai bằng CSS custom properties (`--color-primary`, `--font-family-base`, `--spacing-4`, `--radius-full`...). `styles.css` gốc import theo thứ tự: Google Fonts → `variables.css` → `utilities.css` → `breadcrumb.css` → global reset/style.
- **Bootstrap 5** làm nền tảng utility/grid/icon (không dùng component JS của Bootstrap, chỉ CSS + icon font).
- **Màu thương hiệu chủ đạo**: xanh dương đậm `#00589F` (primary), tím lavender `#BAA7DE` (secondary) — tông màu y tế/dược phẩm, nền trang xanh rất nhạt `#E5EEF8`.
- Có hiệu ứng animation CSS tuỳ biến đáng chú ý: "flying pill" (`vc-fly-pill`) — viên thuốc bay từ nút "Thêm vào giỏ" vào icon giỏ hàng bằng CSS `offset-path`/`offset-distance`.
- `my-admin` không có file `variables.css` riêng biệt rõ ràng như `my-user`, có `theme.service.ts` riêng — gợi ý admin có thể hỗ trợ đổi theme qua service thay vì chỉ CSS tĩnh.

---

## 13. Các Pattern quan trọng (tổng hợp)

1. **3 project độc lập trong 1 repo**, không phải Angular workspace/Nx monorepo chuẩn — không có code dùng chung qua thư viện nội bộ, mỗi app tự copy lại component cần thiết.
2. **Toàn bộ route công khai dùng tiếng Việt không dấu** để thân thiện SEO/người dùng Việt.
3. **Standalone component 100%**, không NgModule, lazy-load bằng `loadComponent()`.
4. **Angular Signals** làm cơ chế state chính (không Redux/NgRx), kết hợp RxJS cho lời gọi HTTP.
5. **Không có JWT/session token** — auth "tin tưởng client", lưu nguyên object user vào `localStorage`.
6. **Model Mongoose đặt trong source Angular** rồi backend `require()` chéo sang — ranh giới frontend/backend bị trộn lẫn ở tầng schema.
7. **Backend monolith 1-file** (`server.js` ~488KB, >200 route) — không tách controller/service/route theo module.
8. **Phân quyền theo vai trò xử lý ở tầng UI/component**, không phải ở guard route hay middleware backend.
9. **OTP-based auth** cho đăng ký/quên mật khẩu, song song **OAuth Google/Facebook**.
10. **AI chatbot tích hợp domain-aware** (VitaBot) — Replicate LLM chính, Gemini dự phòng, ngữ cảnh xây từ truy vấn MongoDB trực tiếp.
11. **3D visualization** (three.js + GLTFLoader + OrbitControls + raycasting) áp riêng cho tính năng tra cứu bệnh.
12. **Không có file `environment.ts` tập trung** — base URL API bị hardcode rải rác, không nhất quán.
13. **Seed data tách biệt khỏi runtime DB**: thư mục `data/*.json` chỉ phục vụ script import, không phải nguồn dữ liệu runtime.
14. **Gamification nhẹ**: hệ thống "xu/coin" thưởng khi review, hoàn thành đơn hàng, làm quiz.

---

## 14. Danh sách file quan trọng và vai trò

| File | Vai trò |
|---|---|
| `backend/server.js` | Toàn bộ API backend (>200 route Express) |
| `backend/db.js` | Kết nối MongoDB |
| `backend/oauth-social.js` | Đăng ký route OAuth Google/Facebook |
| `backend/vitabot-chat.js` | Logic chatbot VitaBot |
| `backend/importData.js`, `backend/scripts/seed-users.js` | Nạp dữ liệu mẫu từ `data/*.json` |
| `backend/.env.example` | Danh sách biến môi trường cần cấu hình |
| `my-user/src/app/app.routes.ts` | Bảng route đầy đủ của app khách hàng |
| `my-user/src/app/app.config.ts` | Providers gốc |
| `my-user/src/app/app.ts` / `app.html` | Shell gốc |
| `my-user/src/app/core/services/auth.service.ts` | State đăng nhập (signal) |
| `my-user/src/app/core/services/auth-api.service.ts` | Gọi API auth |
| `my-user/src/app/core/guards/auth.guard.ts` | Guard yêu cầu đăng nhập |
| `my-user/src/app/core/models/*.js` | Mongoose schema dùng chung cả frontend lẫn backend |
| `my-user/src/styles/variables.css` | Design token/màu thương hiệu tập trung |
| `my-user/proxy.conf.json` | Cấu hình proxy `/api` → backend khi `ng serve` |
| `my-admin/src/app/app.routes.ts` | Bảng route quản trị (nested, layout + pharmacist-only shell) |
| `my-admin/src/app/pharmacist-only-shell/pharmacist-only-shell.ts` | Kiểm soát truy cập theo vai trò dược sĩ ở tầng UI |
| `my-admin/src/app/services/auth.service.ts` | State đăng nhập admin |
| `data/collections.json` (trong `backend/`) | Khai danh sách collection dùng khi import |

---

## 15. Theo từng loại feature — nên tham khảo phần nào của VitaCare-main

VitaCare là ứng dụng **nhà thuốc online kết hợp chăm sóc sức khỏe**: bán sản phẩm (thuốc/thực phẩm chức năng/mỹ phẩm dược), tra cứu bệnh (có mô hình 3D), tư vấn đơn thuốc với dược sĩ, nhắc lịch uống thuốc, quiz/kiểm tra sức khỏe, blog sức khỏe, hệ thống cửa hàng offline, chatbot AI tư vấn.

| Muốn xây feature... | Nên xem phần nào của VitaCare-main |
|---|---|
| Đăng nhập bằng SĐT + OTP, quên mật khẩu | `backend/server.js` (route `/api/auth/*`), `my-user/src/app/core/services/auth-api.service.ts`, `auth.service.ts` |
| Đăng nhập mạng xã hội (Google/Facebook) | `backend/oauth-social.js`, xử lý callback ở `my-user/src/app/app.ts` |
| Phân quyền admin/dược sĩ | `my-admin/src/app/pharmacist-only-shell/`, `my-admin/src/app/services/auth.service.ts` |
| Danh sách/chi tiết sản phẩm, lọc/tìm kiếm | `my-user/src/app/features/products/*`, `product.service.ts`, route `/api/products*` |
| Giỏ hàng, mua ngay, hiệu ứng thêm vào giỏ | `my-user/src/app/features/accounts/cart/`, `cart.service.ts`, `cart-animation.service.ts`, animation CSS `vc-fly-pill` |
| Đặt hàng, theo dõi/huỷ/trả hàng đơn | `my-user/src/app/features/accounts/order*`, `order.service.ts`, route `/api/orders*` |
| Tư vấn đơn thuốc với dược sĩ | `my-user/src/app/features/accounts/prescriptions/`, `prescription.service.ts`; phía admin: `my-admin/src/app/consultationprescription/` |
| Tra cứu bệnh + mô hình 3D giải phẫu | `my-user/src/app/features/healthcare/disease*`, `disease.ts` (three.js/GLTFLoader/OrbitControls) |
| Nhắc lịch uống thuốc | `my-user/src/app/features/accounts/remind/`, `reminder.service.ts`, upload ảnh `multer` |
| Quiz/kiểm tra sức khỏe | `my-user/src/app/features/healthcare/health-test/`, route `/api/quizzes` |
| Blog sức khỏe | `my-user/src/app/features/blogs/*`; phía admin: `blogmanage/`, `blogdetail/` (dùng `ngx-quill`) |
| Chatbot tư vấn (AI) | `my-user/src/app/shared/vitabot/`, backend `backend/vitabot-chat.js` |
| Hệ thống cửa hàng/bản đồ | `my-user/src/app/features/pages/store-system/`; admin dùng `leaflet` trong `home/dashboard-vn-map` |
| Đánh giá sản phẩm/hỏi đáp | `my-user/src/app/features/accounts/reviews/`, `review-sync.service.ts` |
| Điểm thưởng/gamification | `my-user/src/app/shared/coin/`, `coin.service.ts` |
| Quản trị đơn hàng/khách hàng/sản phẩm (admin) | `my-admin/src/app/ordermanage/`, `customermanage/`, `productmanage/` |
| Xuất báo cáo PDF/Excel (admin) | `my-admin/src/app/services/dashboard-export.service.ts` |
| Khuyến mãi/banner | `promotion.service.ts`, route `/api/promotions*`; admin `promotionmanage/` |
