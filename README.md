# Luméa — Interior & 3D

Website thương mại điện tử nội thất và đồ decor, có phòng mẫu 3D, đặt làm/in 3D theo yêu cầu và trợ lý AI tư vấn.

Gồm 3 phần trong cùng một repo:

| Phần | Thư mục | Công nghệ | Cổng khi chạy local |
|---|---|---|---|
| Web khách hàng | `projects/my-client` | Angular 19, Tailwind CSS, Three.js | http://localhost:4200 |
| Trang quản trị | `projects/my-admin` | Angular 19, Chart.js | http://localhost:4201 |
| Backend API | `server` | Node.js, Express 5, MongoDB (Mongoose), Socket.IO | http://localhost:4300 |

## Yêu cầu

- Node.js 20 trở lên
- MongoDB: dùng MongoDB Atlas của nhóm hoặc MongoDB cài trên máy

## Cài đặt và chạy

```bash
npm install          # cài thư viện cho Angular
npm run dev          # chạy cùng lúc backend (4300) và web khách hàng (4200)
```

Lần đầu chạy, `npm run dev` sẽ tự cài thư viện cho `server/` và tạo `server/.env` từ `server/.env.example`.
Mở `server/.env` và điền ít nhất `MONGODB_URI` rồi chạy lại.

Trang quản trị chạy riêng ở một terminal khác:

```bash
npx ng serve my-admin    # http://localhost:4201
```

## Biến môi trường (`server/.env`)

File `server/.env` chứa key thật, **không đưa lên Git**. Danh sách đầy đủ và hướng dẫn lấy key có trong `server/.env.example`.

| Biến | Dùng cho | Bắt buộc |
|---|---|---|
| `MONGODB_URI` | Kết nối MongoDB | Có |
| `PORT`, `CORS_ORIGINS` | Cổng backend, domain frontend được phép gọi API | Có sẵn giá trị mặc định |
| `ADMIN_TOKEN_SECRET` | Khoá ký token đăng nhập. Để trống thì mỗi lần khởi động lại server phải đăng nhập lại | Nên có |
| `GEMINI_API_KEY` | Chatbot AI. Lấy miễn phí tại https://aistudio.google.com/apikey | Không |
| `SMTP_USER`, `SMTP_PASS` | Gửi email OTP qua Gmail. Để trống thì mã OTP hiện ngay trên màn hình (chế độ dev) | Không |
| `ESMS_*` | Gửi SMS OTP | Không |
| `GOOGLE_CLIENT_ID`, `FACEBOOK_*` | Đăng nhập bằng Google / Facebook | Không |
| `MOMO_*`, `ZALOPAY_*` | Cổng thanh toán MoMo, ZaloPay (sandbox) | Không |

Địa chỉ API phía Angular nằm trong `projects/*/src/environments/`:
`environment.ts` khi chạy local, `environment.prod.ts` khi build deploy.

## Dữ liệu

### Vì sao nhóm dùng MongoDB Atlas

Atlas là MongoDB đặt trên cloud, cả nhóm và bản deploy cùng kết nối vào **một database chung**:

- **Làm việc nhóm:** sản phẩm, phòng 3D, bài viết, đơn hàng do một thành viên tạo thì máy các thành viên khác thấy ngay, không phải gửi file dữ liệu qua lại.
- **Deploy:** backend chạy trên Render dùng chính database này, nên web online và web chạy local có cùng dữ liệu.
- **Dễ chạy:** `server/.env.example` đã trỏ sẵn tới database của nhóm. Tải repo về, chạy `npm run dev` là có đủ dữ liệu, **không cần seed**.

### Vì sao vẫn có lệnh seed

Database trên cloud có lúc không kết nối được: mạng trường hoặc công ty chặn cổng MongoDB, Atlas bảo trì, cụm miễn phí bị tạm dừng... Khi đó web không có dữ liệu để hiển thị.
Lệnh seed là **phương án dự phòng**: dựng một database ngay trên máy, không cần Internet, có cùng nội dung với web thật.

Phần nội dung (sản phẩm, phòng 3D, tin tức...) khớp với web từ monggo Atlas (`server/seed/snapshot/`).
Tài khoản, đơn hàng, bình luận dùng dữ liệu mẫu để không đưa thông tin cá nhân của thành viên lên Git.
Sau khi nạp, `npm run seed:verify --prefix server` kiểm tra lại: số bản ghi, dữ liệu đúng schema, liên kết giữa các bảng, không trùng khoá.

### Cách chạy bản dự phòng

Cần MongoDB cài trên máy.

1. Trong `server/.env`, đổi `MONGODB_URI=mongodb://127.0.0.1:27017/lumea`
2. Nạp dữ liệu:

   ```bash
   npm run seed:backup --prefix server   # nạp dữ liệu
   npm run seed:verify --prefix server   # kiểm tra dữ liệu đã đúng và đủ
   ```

3. Chạy lại `npm run dev`.

`seed:backup` làm 2 bước:
- Nạp phần nội dung từ bản chụp web thật trong `server/seed/snapshot/`: 1471 sản phẩm, phòng 3D, tin tức, video, mã giảm giá, câu hỏi trắc nghiệm, cấu hình danh mục và phân quyền.
- Thêm dữ liệu mẫu: tài khoản demo, đơn hàng, bảo hành, bài cộng đồng, bình luận, thông báo...


Tài khoản sau khi nạp:

| Trang | Tài khoản | Mật khẩu |
|---|---|---|
| Quản trị (4201) | `admin` | `admin123` |
| Khách hàng (4200) | `thaomy.nguyen@gmail.com` | `Lumea@123` |

Đổi tài khoản quản trị bằng `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` trong `.env`. **Đổi mật khẩu trước khi deploy thật.**

## Build và kiểm thử

```bash
npm run build                    # build web khách hàng vào dist/
npx ng build my-admin            # build trang quản trị
npm test --prefix server         # test backend (unit + integration)
```

## Cấu trúc thư mục

```
projects/
  my-client/src/app/
    pages/        trang: home, catalog, product-detail, cart-checkout, shop-the-room, community, account...
    components/   thành phần dùng chung: header, product-card, ai-modal...
    core/         services, models, data tĩnh (danh mục...)
    shared/       directives, pipes
  my-admin/src/app/
    pages/        dashboard, orders, products, inventory, customers, staff, roles, articles...
server/
  index.js        khởi động Express + Socket.IO
  routes/         API theo từng nhóm (/api/products, /api/orders, /api/auth...)
  models/         schema Mongoose
  middleware/     xác thực khách hàng và nhân viên, phân quyền
  seed/           script nạp dữ liệu mẫu
  test/           test unit và integration
scripts/dev.js    script cho `npm run dev`
MONGODB_COLLECTIONS.md   tra cứu tên collection và field trong MongoDB
```

## Deploy

| Phần | Nơi chạy | Link |
|---|---|---|
| Web khách hàng | Vercel | https://web2-nh-m8-five.vercel.app |
| Trang quản trị | Vercel | https://web2-nh-m8-2vnw.vercel.app |
| Backend API | Render | https://web2-nh-m8-2.onrender.com/api |

- Bản online dùng chung database MongoDB Atlas với bản chạy local.
- Gói miễn phí của Render tự tắt backend khi lâu không có ai truy cập. Lần mở đầu tiên có thể mất khoảng 1 phút để server khởi động lại.
- `vercel.json` chuyển mọi đường dẫn về `index.html`, để mở thẳng hoặc F5 ở trang con (như `/checkout`) không bị lỗi 404.
