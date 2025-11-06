# KTPM_ShortenURL
- Chúng ta sử dụng các plugins để mở rộng dự án, cụ thể là thêm các pattern Cache, Retry, Rate Limiting
- Pattern CQRS sẽ làm việc với file db.js
## Sơ sơ
- services/urlService.js chứa 2 phương thức findOrigin và shortUrl
  - findOrigin: tìm url gốc từ url rút gọn
  - shortUrl: tạo url rút gọn từ url gốc
- infrastructure/db.js làm việc với CSDL
## Plugins
- Trong folder plugins đã có sẵn các folder cho các pattern với file chạy chính là index.js
- Thứ tự thực hiện các plugins sẽ được DMH chỉnh sau, nhiệm vụ của ae là làm sao để cài được pattern ae đã chọn vào trong index.js với yêu cầu như sau
```
module.exports = {
  meta: { priority: NUMBER, phase: 'read'|'write'|'both' },
  register: async ({app}) => { /* optional middleware setup */ },
  decorate: (service) => { /* optional: return wrapped service */ }
}
```
- Mẫu là file example/exp.js
## CQRS
- Pattern này làm việc trực tiếp với db.js
- Cần đảm bảo là sẽ trả về 2 phương thức findOrigin và shortUrl như đã nói ở trên

## Chú ý
- **Ai làm phần nào sửa đúng phần đó**
- VD: DMH làm Rate Limiting thì chỉ chỉnh sửa trong folder pugins/ratelimiting
- CQRS thì làm với db.js và có thể tùy chỉnh thêm file nếu cần thiết
