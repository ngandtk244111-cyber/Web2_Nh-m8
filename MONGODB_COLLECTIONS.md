# Tên collection & field trong MongoDB

Tài liệu tra cứu nhanh để **thêm dữ liệu** vào MongoDB (qua MongoDB Compass, `mongosh`, hoặc file seed).
Nguồn gốc: các schema trong [server/models/](server/models/) — nếu model đổi, cập nhật lại file này.

- **Database:** `deco3d` (local: `mongodb://127.0.0.1:27017/deco3d`, lấy từ `MONGODB_URI` trong `server/.env`)
- **Tên collection** = tên model viết thường + số nhiều (Mongoose tự đặt). Ví dụ model `Product` → collection `products`.

---

## Quy tắc chung (đọc trước khi thêm)

1. **Nhiều collection có field `id` riêng kiểu chuỗi** (`prod-1`, `room-1`, `post-1`...). Đây là khoá mà frontend dùng, **không phải `_id`** của Mongo. Khi tham chiếu chéo (vd `productId` trong hotspot, `taggedProductIds` trong bài viết) phải dùng **`id` chuỗi này**.
2. Field có ghi **unique** thì không được trùng với bản ghi đã có (thêm trùng sẽ báo lỗi `E11000 duplicate key`).
3. Field có **giá trị cho phép** (enum) phải gõ **đúng y hệt**, kể cả dấu tiếng Việt và chữ hoa/thường.
4. Giá tiền là **số nguyên VND**, không có dấu chấm: `1290000`, không phải `"1.290.000"`.
5. Ảnh là **URL chuỗi** (Unsplash, link CDN...) hoặc đường dẫn trong `assets/`.
6. Thêm bằng Compass/mongosh sẽ **bỏ qua validate của Mongoose** → thiếu field bắt buộc vẫn lưu được nhưng web có thể lỗi. Cách an toàn nhất là thêm vào file seed rồi chạy seed (xem cuối file).

---

## Nhóm 1 — Dữ liệu nội dung (thường thêm tay)

### `products` — Sản phẩm (model `Product`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | vd `prod-11` |
| `name` | string | ✅ | Tên hiển thị |
| `slug` | string | ✅ unique | Dùng trên URL, không dấu, nối `-`: `den-ngu-moon-lamp` |
| `category` | string | ✅ | Xem danh sách bên dưới |
| `categoryName` | string | ✅ | Tên danh mục hiển thị, vd `Đèn Ngủ` |
| `categoryGroup` | string | ✅ | `FURNITURE` hoặc `DECOR` |
| `productionType` | string | ✅ | `READY_STOCK` (có sẵn) hoặc `PRINT_ON_DEMAND` (in theo yêu cầu) |
| `customizable` | boolean | | mặc định `false` |
| `basePrice` | number | ✅ | Giá bán hiện tại |
| `originalPrice` | number | | Giá gốc (lớn hơn `basePrice` thì hiện giảm giá) |
| `description` | string | | |
| `story` | string | | Câu chuyện sản phẩm |
| `rating` | number | | 0–5, mặc định 5 |
| `reviewCount` | number | | |
| `inStock` | number | | Số lượng tồn kho |
| `images` | string[] | | Ảnh đầu tiên là ảnh chính |
| `badge` | string | | vd `Bán chạy`, `Mới`, `Thanh lý` |
| `dimensions` | string | | vd `Đường kính 50cm x Cao 50cm` |
| `materialInfo` | string | | |
| `weight` | string | | vd `5kg` |
| `features` | string[] | | Các ý nổi bật |
| `reviews` | object[] | | Xem cấu trúc **review** bên dưới |
| `customization` | object | | Chỉ khi `customizable: true` — xem cấu trúc bên dưới |
| `threeModelType` | string | | Có giá trị = có xem 3D: `moon_lamp`, `geometric_vase`, `desk_organizer`, `cube_stool`, `wall_shelf`, `abstract_sculpture` |
| `productionTime` | string | | Chỉ cho `PRINT_ON_DEMAND`, vd `3-5 ngày` |
| `printTechnology` | string | | Chỉ cho `PRINT_ON_DEMAND`, vd `FDM 0.16mm, PLA` |
| `flashSaleSlot` | number | | `0` hôm nay, `1` ngày mai, `2` ngày kia, `null` = không Flash Sale |
| `style` | string | | `Minimalist`, `Scandinavian`, `Vintage`, `Cute/Kawaii`, `Modern`, `Retro`, `Japanese` |
| `color` | string | | `Trắng`, `Đen`, `Xám`, `Be`, `Pastel`, `Xanh`, `Hồng` |
| `printMaterial` | string | | `PLA`, `PETG`, `Resin`, `Wood PLA`, `Nhựa tái chế` |
| `sizeCategory` | string | | `Mini`, `Nhỏ`, `Trung bình`, `Lớn`, `Theo yêu cầu` |
| `spaces` | string[] | | `phong-khach`, `phong-ngu`, `phong-lam-viec`, `phong-hoc`, `goc-chill`. Để trống thì web tự suy ra theo `category` |

**Giá trị `category`:**
- Nhóm `FURNITURE`: `sofa`, `bed`, `table`, `side_table`, `chair`, `stool`, `cabinet`, `bookshelf`, `lamp`, `desk_lamp`, `night_lamp`, `pendant_lamp`, `organizer`
- Nhóm `DECOR`: `plant_pot`, `vase`, `sculpture`, `clock`, `frame`, `candle_holder`, `tray`, `bookend`

**Cấu trúc 1 review** (phần tử trong `reviews`):
```json
{
  "id": "prod-11-rev-1",
  "author": "Minh Anh",
  "avatar": "https://...",
  "rating": 5,
  "date": "12/09/2026",
  "comment": "Đẹp lắm shop ơi",
  "verifiedPurchase": true,
  "images": ["https://..."],
  "reply": { "text": "Cảm ơn bạn!", "date": "13/09/2026" },
  "pinned": false
}
```
`images`, `reply`, `pinned` có thể bỏ.

**Cấu trúc `customization`:**
```json
{
  "colors":    [{ "name": "Trắng", "hex": "#FDFBF7", "priceDelta": 0 }],
  "materials": [{ "id": "pla-matte", "name": "PLA Mờ", "description": "...", "priceDelta": 0, "roughness": 0.85, "metalness": 0.05 }],
  "sizes":     [{ "id": "s", "label": "Size S (15cm)", "scale": 1, "priceMultiplier": 1, "dimensions": "15cm" }],
  "finishes":  [{ "id": "matte", "label": "Mờ", "priceDelta": 0 }],
  "textOption": { "enabled": true, "maxChars": 20, "priceDelta": 30000 },
  "accessories": [{ "id": "remote", "name": "Remote", "priceDelta": 50000, "defaultSelected": false }]
}
```
Server tính lại giá đơn hàng dựa trên các option này (theo `hex` màu và `id` của từng option), nên `id`/`hex` phải khớp.

---

### `coupons` — Mã giảm giá (model `Coupon`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `code` | string | ✅ unique | **VIẾT HOA**, vd `SALE20` |
| `description` | string | | Mô tả hiển thị |
| `discountPercent` | number | ✅ | 0–100 |
| `maxDiscount` | number | ✅ | Số tiền giảm tối đa (VND) |
| `minSpend` | number | | Đơn tối thiểu để áp dụng |
| `active` | boolean | | `false` = tắt mã |

Mức giảm = `min(tạm tính × discountPercent / 100, maxDiscount)`.

---

### `rooms` — Phòng 3D / Shop the Room (model `Room`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | vd `room-4` |
| `name` | string | ✅ | |
| `theme`, `tagline`, `description`, `coverImage` | string | | |
| `cameraInitial` | object | ✅ | `{ "x": 3, "y": 2, "z": 4, "fov": 50 }` |
| `cameraLookAt` | number[3] | | `[0, 0.6, 0]` |
| `walkthroughMode`, `freeExploreMode` | boolean | | |
| `roomType` | string | ✅ | `minimal_study`, `cozy_bedroom`, `glb_scene` |
| `modelUrl` | string | | Chỉ cho `glb_scene`: đường dẫn file `.glb` |
| `modelFocusBounds` | object | | Chỉ cho `glb_scene`: `{ "min": [x,y,z], "max": [x,y,z] }` |
| `hotspots` | object[] | | Điểm gắn sản phẩm, xem bên dưới |
| `totalLookPrice` | number | | Tổng giá cả bộ |

**1 hotspot:**
```json
{ "id": "hs-1", "productId": "prod-1", "label": "Đèn Ngủ Moon Lamp", "position": [-1.2, 0.45, 0.2], "annotationNote": "..." }
```
`productId` = `id` của sản phẩm trong `products`. Toạ độ `position` lấy bằng công cụ in toạ độ trong `room-viewer.component.ts`.

---

### `newsarticles` — Bài viết Tin tức / Luméa Living (model `NewsArticle`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | vd `news-15` |
| `title` | string | ✅ | |
| `slug` | string | ✅ unique | |
| `excerpt` | string | | Đoạn tóm tắt |
| `content` | string | | Nội dung (Markdown/HTML) |
| `coverImage` | string | | |
| `videoUrl` | string | | |
| `category` | string | ✅ | `Xu hướng`, `Mẹo sống`, `Phong cách`, `Phong thủy`, `Cảm hứng`, `3D & Design` |
| `readTime` | string | | vd `5 phút đọc` |
| `publishedAt` | string | | Ngày hiển thị |
| `author` | object | ✅ | `{ "name": "...", "role": "...", "avatar": "https://..." }` |
| `featured` | boolean | | Bài nổi bật |
| `tags` | string[] | | |
| `taggedProductIds` | string[] | | `id` sản phẩm liên quan |
| `viewsCount` | number | | |

---

### `communityposts` — Bài đăng Cộng đồng (model `CommunityPost`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | vd `post-10` |
| `userId` | ObjectId | | `_id` của user nếu do khách đăng |
| `author` | object | ✅ | `{ "id": "u-1", "name": "...", "avatar": "...", "handle": "@...", "badge": "Top Creator" }` |
| `title` | string | ✅ | |
| `caption` | string | | |
| `imageUrl` | string | ✅ | |
| `tags` | string[] | | |
| `productTags` | object[] | | `{ "productId": "prod-1", "xPercent": 28, "yPercent": 42, "note": "..." }` — vị trí % trên ảnh |
| `likesCount`, `commentsCount` | number | | |
| `comments` | object[] | | `{ "id", "authorName", "authorAvatar", "text", "createdAt" }` |
| `createdAt` | string | | Nhãn hiển thị, vd `2 giờ trước` |
| `postedAt` | Date | | Thời điểm đăng thật |
| `status` | string | | `PUBLISHED` (mặc định), `HIDDEN`, `REJECTED` — chỉ `PUBLISHED` hiện ra web |
| `isStaffPick` | boolean | | |

---

### `videos` — Video chủ đề trang chủ (model `Video`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | |
| `title` | string | ✅ | |
| `description` | string | | |
| `youtubeId` | string | ✅ | Phần ID trong link YouTube, vd `OLT1QLyJc0w` |
| `poster` | string | | Ảnh bìa |
| `link` | string | | Link nút CTA, vd `/orders/track` |
| `ctaLabel` | string | | mặc định `Xem thêm` |
| `active` | boolean | | `false` = ẩn |
| `order` | number | | Thứ tự hiển thị (nhỏ trước) |

---

### `customrequests` — Yêu cầu thiết kế riêng (model `CustomRequest`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ unique | |
| `requestCode` | string | ✅ unique | vd `REQ-2026-003` |
| `title`, `customerName`, `customerEmail` | string | ✅ | |
| `customerPhone` | string | | |
| `status` | string | | `PENDING_REVIEW`, `QUOTED`, `IN_DISCUSSION`, `PREVIEW_READY`, `APPROVED`, `CONVERTED_TO_ORDER`, `REJECTED` |
| `brief` | object | ✅ | `{ productType, theme, style, color, size, usage, customText?, estimatedBudget?, notes? }` |
| `customerImages` | string[] | | |
| `aiConceptImage` | string | | |
| `quotationPrice`, `estimatedDays` | number | | |
| `adminNote` | string | | |
| `preview3dModelType` | string | | `moon_lamp`, `geometric_vase`, `abstract_sculpture`, `desk_organizer` |
| `messages` | object[] | | `{ id, sender: "CUSTOMER"/"SHOP_SPECIALIST"/"AI_ASSISTANT", senderName, avatar, text, timestamp, attachments? }` |
| `createdAt`, `updatedAt` | string | | Nhãn hiển thị |

---

### `notifications` — Thông báo (model `Notification`)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `userId` | string | | `null` = thông báo chung cho mọi người |
| `title`, `message` | string | ✅ | |
| `link` | string | | Link khi bấm vào |
| `read` | boolean | | |
| `visibleAt` | Date | | Hẹn giờ hiện; `null` = hiện ngay |
| `refKey` | string | | Khoá tham chiếu nội bộ |

---

## Nhóm 2 — Dữ liệu do hệ thống tự tạo (không nên thêm tay)

Các collection này được tạo khi người dùng thao tác trên web. Thêm tay dễ sai dữ liệu liên kết.

| Collection | Model | Sinh ra khi |
|---|---|---|
| `users` | `User` | Khách đăng ký / đăng nhập Google (mật khẩu băm bcrypt, **không** nhập tay mật khẩu thường) |
| `admins` | `Admin` | Seed tạo tài khoản mặc định từ `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` |
| `orders` | `Order` | Khách đặt hàng (server tự tính lại giá) |
| `warranties` | `Warranty` | Kích hoạt bảo hành cho đơn hàng |
| `cointransactions` | `CoinTransaction` | Cộng/trừ xu (quiz, đơn hàng, newsletter...) |
| `chatmessages` | `ChatMessage` | Chat hỗ trợ khách ↔ nhân viên |
| `newscomments` | `NewsComment` | Bạn đọc bình luận dưới bài viết |
| `newslettersubscribers` | `NewsletterSubscriber` | Đăng ký nhận bản tin |
| `otpcodes` | `OtpCode` | Mã OTP (tự xoá khi hết hạn) |

---

## Cách thêm dữ liệu

**Cách 1 — Thêm qua file seed (khuyên dùng, giữ được dữ liệu khi dựng DB mới):**
1. Thêm object vào mảng tương ứng trong [projects/my-client/src/app/core/data/mock-data.ts](projects/my-client/src/app/core/data/mock-data.ts) (`MOCK_PRODUCTS`, `MOCK_ROOMS`, `MOCK_NEWS_ARTICLES`, `MOCK_COMMUNITY_POSTS`, `MOCK_CUSTOM_REQUESTS`, `MOCK_COUPONS`) hoặc [product-detail.mock.ts](projects/my-client/src/app/core/data/product-detail.mock.ts).
2. Chạy trong thư mục `server/`:
   ```bash
   node seed/convert-mock-data.js   # chuyển file .ts sang .js cho seed
   node seed/seed-missing.js        # chỉ thêm bản ghi chưa có, không ghi đè
   ```
   `seed-missing.js` hiện nạp: `products`, `communityposts`, `newsarticles`, `coupons`. Với `rooms`, `customrequests` thì `seed.js` chỉ nạp khi collection đang rỗng.

**Cách 2 — Thêm trực tiếp bằng MongoDB Compass:** mở database `deco3d` → chọn collection → *Add Data* → *Insert Document* → dán JSON theo đúng bảng field ở trên.

**Cách 3 — `mongosh`:**
```js
use deco3d
db.coupons.insertOne({ code: "SALE20", description: "Giảm 20%", discountPercent: 20, maxDiscount: 100000, minSpend: 300000, active: true })
```

> Nhớ: DB trên production (Render) là DB khác. Muốn dữ liệu có trên web đã deploy thì chạy seed / thêm dữ liệu với `MONGODB_URI` của production.
