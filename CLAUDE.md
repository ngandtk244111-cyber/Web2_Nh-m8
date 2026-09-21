# CLAUDE.md

Hướng dẫn này áp dụng cho Claude Code khi làm việc trong repo này.

## Bối cảnh dự án

- **Lam-a-main** (thư mục này) là **project chính** đang được xây dựng. Mọi thay đổi code đều nhắm vào đây.
- **AuraPC-main** (`../AuraPC-main`, nằm ngoài thư mục này) là **project tham khảo**, dùng để lấy pattern và cách tổ chức kiến trúc. Nó **không phải** một phần của Lam-a-main.

## Quy tắc bắt buộc

1. **Không sửa AuraPC-main** trừ khi người dùng yêu cầu rõ ràng, cụ thể cho việc đó. Mặc định mọi tác vụ chỉ được đọc AuraPC-main, không ghi/sửa/xoá.
2. **Khi cần tham khảo AuraPC-main, đọc `REFERENCE_ARCHITECTURE.md` (ở thư mục gốc Lam-a-main) trước tiên.** File này là bản đồ kiến trúc đã khảo sát sẵn (stack, cấu trúc thư mục, routing, service, auth flow, pattern quan trọng, và bảng ánh xạ "feature → nên xem phần nào của AuraPC-main").
3. **Chỉ mở source code cụ thể trong AuraPC-main khi `REFERENCE_ARCHITECTURE.md` không đủ chi tiết** để quyết định cách implement (ví dụ cần xem chính xác logic 1 hàm, 1 API response shape). Khi đó, mở đúng file liên quan theo bảng ánh xạ trong REFERENCE_ARCHITECTURE.md, không đọc lan man.
4. **Không copy nguyên project hoặc copy code một cách máy móc.** Lấy pattern/ý tưởng tổ chức, sau đó viết lại cho phù hợp với code, quy ước, và ngữ cảnh hiện tại của Lam-a-main.
5. **Ưu tiên áp dụng pattern phù hợp vào architecture hiện tại của Lam-a-main** — không ép Lam-a-main phải giống AuraPC-main nếu điều đó phá vỡ cấu trúc/quy ước đã có sẵn trong Lam-a-main.
6. **Không tự ý refactor code không liên quan** đến yêu cầu đang làm, kể cả khi thấy chỗ đó "có thể cải thiện" theo hướng giống AuraPC-main.
7. **Không tự ý thêm thư viện/dependency mới** nếu tính năng không thực sự cần. Nếu AuraPC-main dùng một thư viện cho việc gì đó, không mặc nhiên thêm thư viện đó vào Lam-a-main — chỉ thêm khi cần thiết cho yêu cầu cụ thể và nên hỏi trước nếu không chắc.
8. **Trước khi implement bất kỳ feature nào**, phải:
   - Đọc code hiện tại của Lam-a-main liên quan đến feature đó (cấu trúc, service, component, convention đang dùng).
   - Đối chiếu với `REFERENCE_ARCHITECTURE.md` để xem AuraPC-main tổ chức feature tương tự thế nào.
   - Chỉ sau đó mới quyết định cách tổ chức code cho Lam-a-main, ưu tiên nhất quán với code hiện tại của Lam-a-main.
9. **Phạm vi thay đổi: chỉ sửa Lam-a-main**, trừ khi người dùng yêu cầu khác rõ ràng.
