# URL Shortener Advance

## Các tính năng

- Rút gọn URL, tạo id và lưu lại
- Lấy URL gốc từ id đã tạo và redirect tới URL gốc
- Track lượng truy cập của URL
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

## Các phần đã thêm

#### 1. UI

- Nhóm có tạo 1 UI đơn giản dành cho hệ thống

#### 2. CSDL

- Nhóm chuyển từ sử dụng SQLite sang ScyllaDB với khả năng truy vấn nhanh và dễ ràng mở rộng
- Nhóm đã thêm tính năng kiểm tra URL có tồn tại trong DB chưa

#### 3. Cache

- Nhóm sử dụng DragonFly để lưu cache và tăng tốc độ của hệ thống

#### 4. Rate Limit

- Nhóm thêm Rate Limit để giới hạn truy cập nhằm đảm bảo hệ thống hoạt động tốt khi có quá nhiều request
- Nhóm có sử dụng service của Redis cho Rate Limit
- Hiện tại, rate limit giới hạn 20 requests trong 60s

#### 5. Retry

- Nhóm có cài thêm Retry ở những chỗ hợp lí nhằm đảm bảo hệ thống vẫn hoạt động bình thường khi gặp những lỗi tạm thời
- Retry sử dụng chiến lược Exponential với tối đa 3 lần
- Retry được sử dụng ở thao tác đọc, không thực hiện đối với ghi để tránh bị duplicate data

#### 6. CQRS

- Nhóm đã tách hệ thống ra 2 service đọc và ghi giúp cho hệ thống có thể dễ dàng được mở rộng hay chỉnh sửa
- Đồng thời việc tách ra cũng đảm bảo không bị mắc những lỗi khi dùng đọc ghi trong thiết kế, VD như Retry ở trên

### Kết quả đo được

Nhóm đã sử dụng công cụ **wrk** để kiểm tra hiệu năng của hệ thống với cấu hình:

- 12 threads
- 400 kết nối đồng thời
- Thời gian test: 60 giây

#### 1. Test Write (Tạo URL rút gọn)

| Metric             | Base (Port 3000) | Improved (Port 8090) | Cải thiện             |
| ------------------ | ---------------- | -------------------- | --------------------- |
| **Requests/sec**   | 60.10            | 8,027.97             | **~133x**             |
| **Latency (Avg)**  | 1.38s            | 49.33ms              | **~28x nhanh hơn**    |
| **Timeout Errors** | 2,441            | 0                    | **Loại bỏ hoàn toàn** |

#### 2. Test Read (Redirect)

| Metric             | Base (Port 3000) | Improved (Port 8090) | Cải thiện             |
| ------------------ | ---------------- | -------------------- | --------------------- |
| **Requests/sec**   | 1,179.65         | 6,172.06             | **~5.2x**             |
| **Latency (Avg)**  | 320.05ms         | 64.27ms              | **~5x nhanh hơn**     |
| **Timeout Errors** | 216              | 0                    | **Loại bỏ hoàn toàn** |

#### Chi tiết log

<details>
<summary>Xem chi tiết kết quả test</summary>

**Base - Write:**

```bash
Running 1m test @ http://localhost:3000
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     1.38s   430.77ms   2.00s    61.74%
    Req/Sec    18.68     27.47   180.00     89.55%
  3612 requests in 1.00m, 0.85MB read
  Socket errors: connect 0, read 0, write 0, timeout 2441
Requests/sec:     60.10
Transfer/sec:     14.56KB
```

**Improved - Write:**

```bash
Running 1m test @ http://localhost:8090
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    49.33ms   15.53ms 139.62ms   72.30%
    Req/Sec   672.30    172.90     1.08k    61.82%
  482061 requests in 1.00m, 128.26MB read
Requests/sec:   8027.97
Transfer/sec:      2.14MB
```

**Base - Read:**

```bash
Running 1m test @ http://localhost:3000
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   320.05ms  104.42ms   2.00s    76.21%
    Req/Sec   102.64     58.04   720.00     72.51%
  70855 requests in 1.00m, 23.19MB read
  Socket errors: connect 0, read 0, write 0, timeout 216
Requests/sec:   1179.65
Transfer/sec:    395.42KB
```

**Improved - Read:**

```bash
Running 1m test @ http://localhost:8090
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    64.27ms   25.08ms 222.70ms   64.56%
    Req/Sec   517.44    217.76     1.31k    81.66%
  370911 requests in 1.00m, 66.15MB read
Requests/sec:   6172.06
Transfer/sec:      1.10MB
```

</details>
