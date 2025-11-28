# URL Shortener System Advanced

## Các tính năng

- Rút gọn URL, tạo id và lưu lại
- Lấy URL gốc từ id đã tạo và redirect tới URL gốc
- Sử dụng ScyllaDB để lưu dữ liệu
- DragonFly để cache và truy xuất nhanh hơn
- RateLimiting để giới hạn truy cập nhằm chống spam
- Sử dụng Retry nhằm đảm bảo reliable của hệ thống
- Tách service đọc và ghi ra với CQRS

## Kiến trúc hệ thống

```
                            ┌─────────────────────┐
                            │   Nginx (8090)      │
                            │  Static + Proxy     │
                            └──────────┬──────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
     ┌──────────▼──────────┐                     ┌───────────▼──────────┐
     │  Redirect Service   │                     │  Shorten Service     │
     │    (Read/Query)     │                     │   (Write/Command)    │
     │    Port 3001        │                     │    Port 3002         │
     └──────────┬──────────┘                     └───────────┬──────────┘
                │                                             │
                │    ┌────────────────────┐                  │
                ├───▶│  Dragonfly Cache   │◀─────────────────┤
                │    │    (Port 6380)     │                  │
                │    └────────────────────┘                  │
                │                                             │
                │    ┌────────────────────┐                  │
                └───▶│    ScyllaDB        │◀─────────────────┘
                     │  (Port 9042)       │
                     └────────────────────┘
```

### Cách chạy

1. **Clone và di chuyển vào thư mục**:

   ```bash
   cd improve
   ```

2. **Cài đặt dependencies**:

   ```bash
   bun install
   ```

3. **Khởi động hạ tầng với Docker** (ScyllaDB, Dragonfly, Nginx):

   ```bash
   docker-compose up -d
   ```

4. **Đợi các dịch vụ sẵn sàng** (khoảng 30 giây):

   ```bash
   docker-compose logs -f
   ```

5. **Truy cập ứng dụng**:
   - Frontend: http://localhost:8090
   - Redirect Service: http://localhost:3001/health
   - Shorten Service: http://localhost:3002/health

## endpoints

### Redirect Service (Read - Port 3001)

- **GET `/short/:id`** - Chuyển hướng đến URL gốc

### Shorten Service (Write - Port 3002)

- **POST `/api/shorten`** - Tạo URL rút gọn
  ```json
  {
    "url": "https://example.com/long-url"
  }
  ```
- **GET `/health`** - Kiểm tra trạng thái

### Access database

```bash
docker exec -it urlshortener-scylla cqlsh

USE urlshortener;
SELECT COUNT(*) FROM urls;
```
## Các phần đã tối ưu
1. CSDL
- Nhóm chuyển từ sử dụng SQLite sang ScyllaDB với khả năng truy vấn nhanh và dễ ràng mở rộng.
2. Thêm cache
- Nhóm sử dụng DragonFly để lưu cache và tăng tốc độ của hệ thống.
3. Thêm rate limit
- Nhóm thêm rate limit để giới hạn truy cập nhằm đảm bảo hệ thống hoạt động tốt khi có quá nhiều request.
- rate limit cho read/write.
4. Thêm retry
- Nhóm có cài thêm retry ở những chỗ hợp lí nhằm đảm bảo hệ thống vẫn hoạt động bình thường khi gặp những lỗi ngắn hạn.
5. Sử dụng CQRS
- Nhóm đã tách hệ thống ra 2 service đọc và ghi giúp cho hệ thống có thể dễ dàng được mở rộng hay chỉnh sửa cũng như đảm bảo 2 thao tác đọc ghi không bị conflict với nhau
