# 📱 Hướng Dẫn Tích Hợp Prescription Order Flow - React Native

> **Dành cho:** Frontend Team (React Native)  
> **Base URL:** `http://<server>/api`  
> **Auth:** Bearer Token (JWT) — gửi trong header `Authorization: Bearer <token>`

---

## 📋 Tổng Quan Luồng

```
[Customer]                    [Operation]                  [Staff]
    │                              │                           │
    │ 1. Upload đơn thuốc          │                           │
    │──────────────────────────►   │                           │
    │                              │ 2. Xem & gọi điện tư vấn │
    │                              │──────────────────────────►│
    │                              │ 3. Tạo báo giá (order)    │
    │◄─────────────────────────────│                           │
    │ 4. Xem báo giá & thanh toán  │                           │
    │──────────────────────────────────────────────────────►   │
    │ 5. Nhận xác nhận             │                           │
    │◄─────────────────────────────────────────────────────────│
    │                              │ 6. Sản xuất kính          │
    │                              │──────────────────────────►│
    │ 7. Nhận thông báo sẵn sàng   │                           │
    │◄─────────────────────────────────────────────────────────│
    │ 8. Đến cửa hàng nhận         │                           │
    │──────────────────────────────────────────────────────►   │
```

---

## 🔐 Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "fullName": "Nguyễn Văn A",
      "email": "customer@example.com",
      "role": "CUSTOMER",
      "phone": "0906666666"
    }
  }
}
```

**React Native Setup:**
```typescript
// api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  baseURL: 'http://<server>/api',
  timeout: 30000,
});

// Auto-attach token
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

---

## 📸 Phase 1: Customer Tạo Yêu Cầu Tư Vấn

### Màn hình: `PrescriptionRequestScreen`

**Chức năng:** Customer chụp/upload ảnh đơn thuốc và gửi yêu cầu tư vấn.

### 1.1 Lấy danh sách cửa hàng
```http
GET /stores
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000011",
      "name": "Chi nhánh Quận 1",
      "address": "123 Nguyễn Huệ, Q1, TP.HCM"
    }
  ]
}
```

### 1.2 Tạo Prescription Request (upload ảnh)

> ⚠️ **QUAN TRỌNG:** Request này dùng `multipart/form-data`, KHÔNG phải JSON

```http
POST /prescription-requests
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `phone` | string | ✅ | SĐT liên hệ (10-20 ký tự) |
| `storeId` | string (uuid) | ✅ | ID cửa hàng muốn nhận kính |
| `consultationType` | `PHONE` \| `IN_STORE` | ✅ | Hình thức tư vấn |
| `symptoms` | string | ❌ | Mô tả triệu chứng |
| `images` | File[] | ❌ | 1-3 ảnh đơn thuốc (JPG/PNG, max 5MB/ảnh) |

**React Native Code:**
```typescript
// api/prescriptionRequests.ts
import apiClient from './client';
import { ImagePickerAsset } from 'expo-image-picker';

export const createPrescriptionRequest = async (params: {
  phone: string;
  storeId: string;
  consultationType: 'PHONE' | 'IN_STORE';
  symptoms?: string;
  images?: ImagePickerAsset[];
}) => {
  const formData = new FormData();

  formData.append('phone', params.phone);
  formData.append('storeId', params.storeId);
  formData.append('consultationType', params.consultationType);
  if (params.symptoms) {
    formData.append('symptoms', params.symptoms);
  }

  // Append images
  params.images?.forEach((image) => {
    formData.append('images', {
      uri: image.uri,
      type: image.mimeType ?? 'image/jpeg',
      name: image.fileName ?? `prescription_${Date.now()}.jpg`,
    } as any);
  });

  const response = await apiClient.post('/prescription-requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "4aa4e382-10da-4b9e-aa23-c8b7c134131e",
    "status": "PENDING",
    "phone": "0906666666",
    "consultationType": "PHONE",
    "symptoms": "Mắt mờ khi nhìn xa",
    "images": [
      { "id": "img-uuid", "imageUrl": "https://supabase.../prescription.jpg" }
    ],
    "store": { "name": "Chi nhánh Quận 1", "address": "..." },
    "createdAt": "2026-02-18T12:00:00Z"
  }
}
```

**Lưu `request.id`** vào state/storage để dùng ở các bước sau.

---

## 📋 Phase 2: Customer Theo Dõi Request

### Màn hình: `MyPrescriptionRequestsScreen`

### 2.1 Lấy danh sách requests của customer
```http
GET /prescription-requests
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "request-uuid",
      "status": "PENDING",           // PENDING | CONTACTING | QUOTED | ACCEPTED | EXPIRED | LOST
      "consultationType": "PHONE",
      "symptoms": "Mắt mờ...",
      "orderId": null,               // Có giá trị khi đã tạo order
      "createdAt": "2026-02-18T..."
    }
  ]
}
```

### 2.2 Xem chi tiết request
```http
GET /prescription-requests/:id
Authorization: Bearer <token>
```

### Status Mapping cho UI:

```typescript
const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  PENDING:     { label: 'Chờ tư vấn',     color: '#FFA500', description: 'Tư vấn viên sẽ liên hệ trong 1-2 giờ' },
  CONTACTING:  { label: 'Đang tư vấn',    color: '#2196F3', description: 'Tư vấn viên đang liên hệ với bạn' },
  QUOTED:      { label: 'Đã báo giá',     color: '#9C27B0', description: 'Bạn có báo giá mới, vui lòng thanh toán' },
  ACCEPTED:    { label: 'Đã xác nhận',    color: '#4CAF50', description: 'Đơn hàng đã được xác nhận' },
  SCHEDULED:   { label: 'Đã đặt lịch',   color: '#00BCD4', description: 'Bạn có lịch hẹn tại cửa hàng' },
  EXPIRED:     { label: 'Đã hết hạn',    color: '#9E9E9E', description: 'Báo giá đã hết hạn' },
  LOST:        { label: 'Đã đóng',       color: '#F44336', description: 'Yêu cầu đã được đóng' },
};
```

---

## 💰 Phase 3: Customer Xem Báo Giá & Thanh Toán

> Khi `PrescriptionRequest.status === 'QUOTED'` và `orderId` có giá trị → điều hướng đến màn hình thanh toán.

### Màn hình: `OrderDetailScreen`

### 3.1 Xem chi tiết order
```http
GET /orders/:orderId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "id": "order-uuid",
    "orderType": "PRESCRIPTION",
    "status": "WAITING_CUSTOMER",
    "paymentStatus": "UNPAID",
    "totalAmount": "2300000",
    "expiresAt": "2026-02-21T12:00:00Z",
    "expectedReadyDate": "2026-03-01T00:00:00Z",
    "orderItems": [
      {
        "product": {
          "name": "Gọng kính Rayban Classic",
          "images": [{ "imageUrl": "https://...", "isPrimary": true }]
        },
        "quantity": 1,
        "unitPrice": "1500000"
      },
      {
        "product": {
          "name": "Tròng kính cận Essilor",
          "images": [{ "imageUrl": "https://...", "isPrimary": true }]
        },
        "quantity": 1,
        "unitPrice": "800000"
      }
    ],
    "prescription": {
      "rightEyeSphere": "-2.50",
      "rightEyeCylinder": "-0.50",
      "rightEyeAxis": 90,
      "leftEyeSphere": "-2.75",
      "leftEyeCylinder": "-0.75",
      "leftEyeAxis": 85,
      "pupillaryDistance": "62.0",
      "notes": "Tròng chống ánh sáng xanh"
    },
    "pickupStore": {
      "name": "Chi nhánh Quận 1",
      "address": "123 Nguyễn Huệ, Q1, TP.HCM"
    }
  }
}
```

**Hiển thị countdown đến `expiresAt`:**
```typescript
const getTimeRemaining = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Đã hết hạn';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `Còn ${hours}h ${minutes}m để thanh toán`;
};
```

### 3.2 Tạo Payment (VNPay)
```http
POST /payments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "order-uuid"
}
```

**Response:**
```json
{
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
    "paymentId": "payment-uuid",
    "orderId": "order-uuid",
    "amount": 2300000
  }
}
```

**Mở VNPay trong WebView:**
```typescript
import { WebView } from 'react-native-webview';
import { Linking } from 'react-native';

// Option 1: WebView (recommended)
const PaymentWebView = ({ paymentUrl, onSuccess, onCancel }) => {
  const handleNavChange = (navState) => {
    const { url } = navState;
    // Detect return URL sau khi thanh toán
    if (url.includes('/payments/vnpay-return')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const responseCode = params.get('vnp_ResponseCode');
      if (responseCode === '00') {
        onSuccess();
      } else {
        onCancel();
      }
    }
  };

  return (
    <WebView
      source={{ uri: paymentUrl }}
      onNavigationStateChange={handleNavChange}
    />
  );
};

// Option 2: Mở browser ngoài (đơn giản hơn)
await Linking.openURL(paymentUrl);
```

### 3.3 Kiểm tra trạng thái sau thanh toán

Sau khi VNPay callback, poll order status:

```typescript
const pollOrderStatus = async (orderId: string, maxRetries = 10) => {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2s
    const response = await apiClient.get(`/orders/${orderId}`);
    const order = response.data.data;

    if (order.status === 'CONFIRMED' && order.paymentStatus === 'PAID') {
      return order; // ✅ Thanh toán thành công
    }
    if (order.paymentStatus === 'FAILED') {
      throw new Error('Thanh toán thất bại');
    }
  }
  throw new Error('Timeout kiểm tra thanh toán');
};
```

**Sau thanh toán thành công:**
- `Order.status`: `WAITING_CUSTOMER` → **`CONFIRMED`**
- `Order.paymentStatus`: `UNPAID` → **`PAID`**
- `PrescriptionRequest.status`: `QUOTED` → **`ACCEPTED`**

---

## 📦 Phase 4 & 5: Theo Dõi Sản Xuất & Nhận Hàng

### Màn hình: `OrderTrackingScreen`

### 4.1 Xem chi tiết đơn thuốc
```http
GET /orders/:orderId/prescription
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "order": { "id": "...", "status": "PROCESSING", ... },
    "prescription": {
      "rightEyeSphere": "-2.50",
      "leftEyeSphere": "-2.75",
      "pupillaryDistance": "62.0",
      "prescriptionImageUrl": "https://supabase.../image.jpg"
    }
  }
}
```

### Order Status Timeline cho UI:

```typescript
const ORDER_TIMELINE = [
  { status: 'CONFIRMED',        label: 'Đã xác nhận',       icon: '✅' },
  { status: 'PROCESSING',       label: 'Đang sản xuất',      icon: '⚙️' },
  { status: 'READY',            label: 'Sẵn sàng nhận',      icon: '📦' },
  { status: 'COMPLETED',        label: 'Đã nhận hàng',       icon: '🎉' },
];

// Statuses đặc biệt
const SPECIAL_STATUSES = {
  WAITING_CUSTOMER: { label: 'Chờ thanh toán', icon: '💳', color: '#FFA500' },
  EXPIRED:          { label: 'Đã hết hạn',     icon: '⏰', color: '#9E9E9E' },
  CANCELLED:        { label: 'Đã hủy',          icon: '❌', color: '#F44336' },
};
```

---

## 🗂️ Tổng Hợp Tất Cả API Endpoints

### Customer APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/prescription-requests` | Tạo yêu cầu tư vấn | Customer |
| `GET` | `/prescription-requests` | Danh sách requests của tôi | Customer |
| `GET` | `/prescription-requests/:id` | Chi tiết request | Customer |
| `GET` | `/orders/:id` | Chi tiết order | Customer |
| `POST` | `/payments/create` | Tạo payment VNPay | Customer |
| `GET` | `/orders/:id/prescription` | Xem đơn thuốc | Customer |

### Operation APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/prescription-requests?status=PENDING` | Danh sách requests | Operation |
| `GET` | `/prescription-requests/:id` | Chi tiết request | Operation |
| `PATCH` | `/prescription-requests/:id/contact` | Cập nhật trạng thái tư vấn | Operation |
| `POST` | `/prescription-requests/:id/create-order` | Tạo order báo giá | Operation |
| `PATCH` | `/prescription-requests/:id/schedule` | Đặt lịch hẹn | Operation |
| `PATCH` | `/prescription-requests/:id/close` | Đóng request | Operation |

### Staff APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/orders/:id/start-processing` | Bắt đầu sản xuất | Staff |
| `POST` | `/orders/:id/mark-ready` | Đánh dấu sẵn sàng | Staff |
| `GET` | `/orders/:id/verify?phone=xxx` | Verify khách hàng | Staff |
| `PATCH` | `/orders/:id/complete-with-notes` | Hoàn thành đơn | Staff |

---

## 🔔 Xử Lý Lỗi

```typescript
// api/errorHandler.ts
export const handleApiError = (error: any): string => {
  if (error.response) {
    const { statusCode, message } = error.response.data;
    switch (statusCode) {
      case 400: return message || 'Dữ liệu không hợp lệ';
      case 401: return 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại';
      case 403: return 'Bạn không có quyền thực hiện thao tác này';
      case 404: return 'Không tìm thấy dữ liệu';
      case 409: return message || 'Dữ liệu đã tồn tại';
      default:  return 'Đã có lỗi xảy ra, vui lòng thử lại';
    }
  }
  if (error.code === 'ECONNABORTED') return 'Kết nối quá chậm, vui lòng thử lại';
  return 'Không thể kết nối đến server';
};
```

---

## 📐 Gợi Ý Cấu Trúc Navigation

```
Stack Navigator
├── Auth
│   ├── LoginScreen
│   └── RegisterScreen
│
└── Main (Tab Navigator)
    ├── HomeTab
    │   └── HomeScreen
    │
    ├── PrescriptionTab
    │   ├── PrescriptionListScreen      ← Danh sách requests
    │   ├── CreatePrescriptionScreen    ← Phase 1: Upload đơn thuốc
    │   ├── PrescriptionDetailScreen    ← Xem chi tiết request
    │   └── OrderDetailScreen           ← Phase 3: Xem báo giá
    │       └── PaymentWebViewScreen    ← Thanh toán VNPay
    │
    └── OrdersTab
        ├── OrderListScreen             ← Danh sách đơn hàng
        └── OrderTrackingScreen         ← Phase 4-5: Theo dõi
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Upload ảnh:** Dùng `multipart/form-data`, field name phải là `images` (số nhiều)
2. **Token hết hạn:** Dùng `refreshToken` để lấy token mới, tránh logout người dùng
3. **Countdown timer:** Order `WAITING_CUSTOMER` có `expiresAt` = 3 ngày, cần hiển thị countdown
4. **Poll sau thanh toán:** VNPay callback về server, FE cần poll `GET /orders/:id` để biết kết quả
5. **WebView vs Browser:** Dùng WebView để giữ người dùng trong app, xử lý redirect URL để detect kết quả
6. **Image size:** Compress ảnh trước khi upload (khuyến nghị max 1MB/ảnh)
7. **Offline handling:** Cache danh sách orders/requests để hiển thị khi mất mạng

---

## 🧪 Test Credentials

| Role | Email | Password | Phone |
|------|-------|----------|-------|
| Customer | `customer@example.com` | `Admin@123` | `0906666666` |
| Operation | `operation@wdp.com` | `Admin@123` | `0903333333` |
| Staff | `staff1@wdp.com` | `Admin@123` | `0904444444` |

**Fixed IDs (từ seed data):**
```
store_id:         00000000-0000-0000-0000-000000000011
frame_product_id: 00000000-0000-0000-0000-000000000021
lens_product_id:  00000000-0000-0000-0000-000000000023
```

**VNPay Sandbox Test Card:**
```
Ngân hàng: NCB
Số thẻ:    9704198526191432198
Tên:       NGUYEN VAN A
Ngày PH:   07/15
OTP:       123456
```
