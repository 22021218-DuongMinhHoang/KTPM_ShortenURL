# URL Shortener Advance
## I. Giới thiệu chung

Hệ thống **URL Shortener Advance** là phiên bản cải tiến từ project rút gọn URL ban đầu, tập trung vào:
- Tăng hiệu năng đọc/ghi.
- Cải thiện độ ổn định, giảm timeout.
- Thiết kế lại kiến trúc để dễ mở rộng, dễ bảo trì.

---
### 1. Các tính năng


- **Rút gọn URL**: tạo ID ngắn và lưu lại vào CSDL.
- **Redirect** từ ID sang URL gốc.
- **Tracking lượt truy cập** của mỗi URL.
- **Lưu dữ liệu bằng ScyllaDB** giúp truy vấn nhanh, dễ mở rộng.
- **DragonFly** làm cache giúp truy xuất nhanh hơn.
- **Rate limiting** chống spam, giới hạn truy cập.
- **Retry với Exponential Backoff** để tăng độ tin cậy.
- **CQRS**: tách riêng service đọc và ghi.

## 2. Kiến trúc hệ thống

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

## 3. Cách chạy

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

## 4. Truy cập
   - Frontend: http://localhost:8090
   - Redirect Service: http://localhost:3001/health
   - Shorten Service: http://localhost:3002/health


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

## II. Bối cảnh và vấn đề của project cũ
### 1. Kiến trúc ban đầu
Ở phiên bản đầu tiên, hệ thống URL Shortener được xây dựng khá đơn giản:

- 1 service duy nhất (port `3000`) xử lý cả:
  - Rút gọn URL (write)
  - Redirect `/short/:id` (read)
- Cơ sở dữ liệu: SQLite (file `app.db` trên máy)
- Chưa có:
  - Cache
  - Rate limiting
  - Cơ chế retry
  - Phân tách đọc/ghi (CQRS)

Toàn bộ traffic đọc/ghi đi vào một process và một file SQLite.

### 2. Vấn đề hiệu năng & ổn định

Khi dùng công cụ `wrk` để benchmark với 12 threads, 400 connections trong 60 giây, hệ thống cũ bộc lộ nhiều hạn chế.

#### 2.1. Kết quả test Write (tạo URL rút gọn – port 3000)

- Requests/sec: `60.10`
- Latency trung bình: `1.38s`
- Socket timeout: `2,441` requests trong 60 giây

⇒ Việc tạo shortcode rất chậm, mỗi request mất hơn 1 giây, và rất nhiều request bị timeout.

#### 2.2. Kết quả test Read (redirect – port 3000)

- Requests/sec: `1,179.65`
- Latency trung bình: `320.05ms`
- Socket timeout: `216` requests trong 60 giây

⇒ Redirect cũng chậm (trung bình ~0.3s mỗi lần) và vẫn tồn tại timeout.

#### 2.3. Phân tích nguyên nhân

+ SQLite là dạng file-based DB, chỉ có single-writer.

⇒  Khi có nhiều kết nối đồng thời (400 connections), việc ghi/đọc trên cùng 1 file gây ra tranh chấp lock, dẫn đến tăng độ trễ và timeout.

+  Mỗi lần redirect `/short/:id`, hệ thống đều phải truy vấn DB do không có cache.

⇒  Các URL được truy cập nhiều vẫn phải query lại từ SQLite, dẫn đến vừa chậm vừa tốn tài nguyên không cần thiết.

+ Các truy vấn đọc và ghi chung một service nên khi luồng write bị chậm hoặc bị block, luồng read cũng bị ảnh hưởng do chia sẻ cùng tài nguyên (CPU, RAM, DB, connection pool…). =>CQRS

+ Nếu có script/bot bắn quá nhiều request, toàn bộ hệ thống dễ bị quá tải, dẫn đến timeout cho cả người dùng bình thường.
=> rate limiting

+ Các lỗi tạm thời (DB busy, network chập chờn…) làm request thất bại ngay lập tức (500, timeout), không có cơ chế thử lại khiến trải nghiệm UX không tốt, hệ thống kém tin cậy => Retry

---

## III. Kiến trúc mới & cách khắc phục

#### 1. UI

<img width="1905" height="906" alt="image" src="https://github.com/user-attachments/assets/4dd3f41d-cee4-4ffe-864a-94a26428a15d" />
<img width="1905" height="906" alt="image" src="https://github.com/user-attachments/assets/05130910-6bfd-4b9e-b46a-e81a915fceef" />
<img width="1905" height="906" alt="image" src="https://github.com/user-attachments/assets/ed0bf563-f99b-4527-95b4-0c181c05709f" />


#### 2. CSDL

- Chuyển từ sử dụng SQLite sang ScyllaDB với khả năng truy vấn nhanh và dễ ràng mở rộng

Ưu điểm:   ScyllaDB là NoSQL, được thiết kế cho throughput rất cao và độ trễ thấp, phù hợp với bài toán key value và tải đọc/ghi lớn .

- Khi nhận URL mới, service kiểm tra trong ScyllaDB xem URL đó đã tồn tại chưa để có thể tái sử dụng short_id.

#### 3. Cache

- Nhóm sử dụng DragonFly để lưu cache và tăng tốc độ của hệ thống

#### 4. Rate Limit

- Tích hợp thêm Rate Limit để giới hạn truy cập nhằm đảm bảo hệ thống hoạt động tốt khi có quá nhiều request
- Sử dụng service của Redis cho Rate Limit
- Rate limit hiện tại: giới hạn 20 requests trong 60s

#### 5. Retry

- Nhóm có cài thêm Retry ở những chỗ hợp lí nhằm đảm bảo hệ thống vẫn hoạt động bình thường khi gặp những lỗi tạm thời
- Retry sử dụng chiến lược Exponential với tối đa 3 lần
- Retry được sử dụng trong thao tác đọc và ghi, có sử dụng idempotency key

#### 6. CQRS

- Nhóm đã tách hệ thống ra 2 service đọc và ghi giúp cho hệ thống có thể dễ dàng được mở rộng hay chỉnh sửa

## V. Kết quả sau khi cải tiến
### 1. Cấu hình
- Công cụ: wrk
- Threads: 12
- Kết nối: 400 kết nối đồng thời
- Thời gian test: 60 giây

### 2. Test Write - Tạo URL rút gọn

| Metric             | Base (Port 3000) | Improved (Port 8090) | Cải thiện             |
| ------------------ | ---------------- | -------------------- | --------------------- |
| **Requests/sec**   | 60.10            | 8,027.97             | **~133x**             |
| **Latency (Avg)**  | 1.38s            | 49.33ms              | **~28x nhanh hơn**    |
| **Timeout Errors** | 2,441            | 0                    | **Loại bỏ hoàn toàn** |

### 3. Test Read - Redirect

| Metric             | Base (Port 3000) | Improved (Port 8090) | Cải thiện             |
| ------------------ | ---------------- | -------------------- | --------------------- |
| **Requests/sec**   | 1,179.65         | 6,172.06             | **~5.2x**             |
| **Latency (Avg)**  | 320.05ms         | 64.27ms              | **~5x nhanh hơn**     |
| **Timeout Errors** | 216              | 0                    | **Loại bỏ hoàn toàn** |

### 4.Chi tiết log

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
