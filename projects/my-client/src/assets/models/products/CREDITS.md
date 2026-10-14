# Mô hình 3D sản phẩm — nguồn & giấy phép

Các file `.glb` trong thư mục này được gán cho sản phẩm qua trường `Product.modelUrl`
(ví dụ `assets/models/products/glam-velvet-sofa.glb`).

| File | Gán cho | Nguồn | Giấy phép |
|---|---|---|---|
| `glam-velvet-sofa.glb` | prod-22 — Sofa Nhung 3 Chỗ Verde | [Khronos glTF-Sample-Assets / GlamVelvetSofa](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa) — Eric Chadwick, © 2021 Wayfair, LLC | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — bắt buộc ghi nguồn (đang hiển thị trong phòng xem 3D) |
| `sheen-chair.glb` | prod-25 — Ghế Bành Armchair | [Khronos glTF-Sample-Assets / SheenChair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair) — Eric Chadwick, © 2020 Wayfair, LLC | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

| `tu-ho-so-hr1800.glb` | prod-26 — Tủ Quần Áo Walden (tạm) | Chuyển từ file 3ds Max `AT120.max` của Luméa: tách nhóm tủ hồ sơ HR1800, import bằng Blender 4.2 + add-on [io_scene_max](https://github.com/nrgsille76/io_scene_max), gắn lại vật liệu PBR (vân gỗ `M1 - FUll size.jpg` trong `maps/`) và 3 phiên bản: Gỗ sồi sáng / Gỗ óc chó / Trắng tinh | Tài sản nội bộ |

Lưu ý: bàn AT120 trong cùng file chưa chuyển được (add-on mã nguồn mở không đọc được mặt bàn/tấm gỗ dựng
bằng modifier của 3ds Max). Muốn đúng bàn AT120: mở file trong 3ds Max → File › Export › glTF (.glb).

Các mô hình Khronos là mô hình mẫu để kiểm thử luồng xem 3D. Khi có file dựng từ sản phẩm thật của Luméa, thay file
hoặc đổi `modelUrl` của sản phẩm sang file mới (xem phần "Cung cấp mô hình 3D" trong báo cáo / README).
