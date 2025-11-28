# url shortener

## kiến trúc

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

### chạy

1. **Clone và di chuyển vào thư mục**:

   ```bash
   cd improve
   ```

2. **Cài đặt dependencies**:

   ```bash
   bun install
   ```

3. **Khởi động hạ tầng** (ScyllaDB, Dragonfly, Nginx):

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

### access database

```bash
docker exec -it urlshortener-scylla cqlsh

USE urlshortener;
SELECT COUNT(*) FROM urls;
```
