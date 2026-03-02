# 📱 Hướng Dẫn Tích Hợp Return & Exchange Flow - React Native

> **Dành cho:** Frontend Team (React Native)  
> **Base URL:** `http://<server>/api`  
> **Auth:** Bearer Token (JWT) — gửi trong header `Authorization: Bearer <token>`

---

## 📋 Tổng Quan Luồng

```
[Customer]                    [Operation]                  [Staff]
    │                              │                           │
    │ 1. Tạo yêu cầu đổi/trả       │                           │
    │──────────────────────────►   │                           │
    │                              │ 2. Xem & phê duyệt        │
    │                              │──────────────────────────►│
    │                              │ 3. Tính chênh lệch (nếu đổi) │
    │◄─────────────────────────────│                           │
    │ 4. Xem kết quả phê duyệt     │                           │
    │                              │ 4. Nhận hàng & xử lý      │
    │                              │──────────────────────────►│
    │ 5. Nhận hoàn tiền/hàng mới   │                           │
    │◄─────────────────────────────────────────────────────────│
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

## 📦 Phase 1: Customer Tạo Yêu Cầu Đổi/Trả

### Màn hình: `CreateReturnRequestScreen`

**Chức năng:** Customer chọn đơn hàng đã hoàn thành, chọn sản phẩm muốn đổi/trả, upload ảnh chứng minh.

### 1.1 Lấy danh sách đơn hàng đã hoàn thành

```http
GET /orders?status=COMPLETED
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "order-uuid",
        "status": "COMPLETED",
        "totalAmount": "2300000",
        "createdAt": "2026-02-10T12:00:00Z",
        "orderItems": [
          {
            "id": "order-item-uuid-1",
            "productId": "product-uuid-1",
            "product": {
              "id": "product-uuid-1",
              "name": "Gọng kính Rayban Classic",
              "price": "1500000",
              "images": [
                { "imageUrl": "https://...", "isPrimary": true }
              ]
            },
            "quantity": 1,
            "unitPrice": "1500000"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 1.2 Tạo Return/Exchange Request (upload ảnh)

> ⚠️ **QUAN TRỌNG:** Request này dùng `multipart/form-data`, KHÔNG phải JSON

```http
POST /returns
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `orderId` | string (uuid) | ✅ | ID đơn hàng muốn đổi/trả |
| `type` | `RETURN` \| `EXCHANGE` \| `WARRANTY` | ✅ | Loại yêu cầu |
| `reason` | string | ✅ | Lý do đổi/trả (min 10, max 500 ký tự) |
| `description` | string | ❌ | Mô tả chi tiết (max 1000 ký tự) |
| `items` | string (JSON) | ✅ | JSON string của mảng items (xem bên dưới) |
| `images` | File[] | ❌ | 1-5 ảnh chứng minh (JPG/PNG, max 5MB/ảnh) |

**Format của `items` (JSON string):**
```json
[
  {
    "orderItemId": "order-item-uuid",
    "productId": "product-uuid",
    "quantity": 1,
    "condition": "NEW",
    "exchangeProductId": "new-product-uuid"  // Chỉ cần khi type = EXCHANGE
  }
]
```

**Các giá trị `condition` hợp lệ:**
- `NEW` - Hàng mới, chưa sử dụng
- `LIKE_NEW` - Như mới
- `GOOD` - Tốt
- `DEFECTIVE` - Bị lỗi

**React Native Code:**
```typescript
// api/returns.ts
import apiClient from './client';
import { ImagePickerAsset } from 'expo-image-picker';

export interface ReturnItem {
  orderItemId: string;
  productId: string;
  quantity: number;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'DEFECTIVE';
  exchangeProductId?: string;
}

export const createReturnRequest = async (params: {
  orderId: string;
  type: 'RETURN' | 'EXCHANGE' | 'WARRANTY';
  reason: string;
  description?: string;
  items: ReturnItem[];
  images?: ImagePickerAsset[];
}) => {
  const formData = new FormData();

  formData.append('orderId', params.orderId);
  formData.append('type', params.type);
  formData.append('reason', params.reason);
  if (params.description) {
    formData.append('description', params.description);
  }

  // ⚠️ QUAN TRỌNG: items phải là JSON string
  formData.append('items', JSON.stringify(params.items));

  // Append images
  params.images?.forEach((image) => {
    formData.append('images', {
      uri: image.uri,
      type: image.mimeType ?? 'image/jpeg',
      name: image.fileName ?? `return_${Date.now()}.jpg`,
    } as any);
  });

  const response = await apiClient.post('/returns', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};
```

**Response (201):**
```json
{
  "statusCode": 201,
  "message": "Tạo yêu cầu đổi/trả thành công",
  "data": {
    "id": "return-uuid",
    "orderId": "order-uuid",
    "customerId": "customer-uuid",
    "type": "RETURN",
    "status": "PENDING",
    "reason": "Sản phẩm không vừa với khuôn mặt",
    "description": "Gọng kính hơi rộng",
    "refundAmount": null,
    "priceDifference": null,
    "createdAt": "2026-02-20T12:00:00Z",
    "returnItems": [
      {
        "id": "return-item-uuid",
        "orderItemId": "order-item-uuid",
        "productId": "product-uuid",
        "quantity": 1,
        "condition": "NEW",
        "product": {
          "name": "Gọng kính Rayban Classic",
          "price": "1500000"
        }
      }
    ],
    "images": [
      {
        "id": "image-uuid",
        "imageUrl": "https://supabase.../return_proof.jpg",
        "imageType": "CUSTOMER_PROOF",
        "uploadedBy": "customer-uuid"
      }
    ]
  }
}
```

**Lưu `returnRequest.id`** vào state/storage để dùng ở các bước sau.

---

## 📋 Phase 2: Customer Theo Dõi Yêu Cầu

### Màn hình: `MyReturnsScreen`

### 2.1 Lấy danh sách returns của customer
```http
GET /returns/my?page=1&limit=10
Authorization: Bearer <token>
```

**Query params (optional):**
| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số lượng/trang (default: 10) |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Lấy danh sách yêu cầu thành công",
  "data": {
    "data": [
      {
        "id": "return-uuid",
        "orderId": "order-uuid",
        "type": "RETURN",
        "status": "PENDING",
        "reason": "Sản phẩm không vừa",
        "refundAmount": null,
        "priceDifference": null,
        "createdAt": "2026-02-20T12:00:00Z",
        "returnItems": [
          {
            "product": { "name": "Rayban Classic" },
            "quantity": 1
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

### 2.2 Xem chi tiết return request
```http
GET /returns/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Lấy thông tin yêu cầu thành công",
  "data": {
    "id": "return-uuid",
    "orderId": "order-uuid",
    "type": "RETURN",
    "status": "APPROVED",
    "reason": "Sản phẩm không vừa",
    "description": "Gọng kính hơi rộng",
    "refundAmount": "1500000",
    "refundMethod": "BANK_TRANSFER",
    "approvedAt": "2026-02-20T14:00:00Z",
    "returnItems": [
      {
        "id": "return-item-uuid",
        "product": {
          "name": "Gọng kính Rayban Classic",
          "images": [{ "imageUrl": "https://...", "isPrimary": true }]
        },
        "quantity": 1,
        "condition": "NEW"
      }
    ],
    "images": [
      {
        "imageUrl": "https://supabase.../proof.jpg",
        "imageType": "CUSTOMER_PROOF"
      }
    ],
    "order": {
      "id": "order-uuid",
      "status": "COMPLETED",
      "totalAmount": "2300000",
      "createdAt": "2026-02-10T12:00:00Z"
    }
  }
}
```

### Status Mapping cho UI:

```typescript
const RETURN_STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  PENDING:    { label: 'Chờ duyệt',      color: '#FFA500', description: 'Yêu cầu đang chờ xét duyệt' },
  APPROVED:   { label: 'Đã duyệt',       color: '#2196F3', description: 'Yêu cầu đã được phê duyệt, vui lòng gửi hàng về' },
  REJECTED:   { label: 'Đã từ chối',     color: '#F44336', description: 'Yêu cầu không được chấp nhận' },
  COMPLETED:  { label: 'Hoàn tất',       color: '#4CAF50', description: 'Đã hoàn tất xử lý' },
  CANCELLED:  { label: 'Đã hủy',         color: '#9E9E9E', description: 'Bạn đã hủy yêu cầu' },
};

const RETURN_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  RETURN:    { label: 'Trả hàng hoàn tiền', icon: '💰' },
  EXCHANGE:  { label: 'Đổi sản phẩm khác', icon: '🔄' },
  WARRANTY:  { label: 'Bảo hành',          icon: '🛡️' },
};
```

### 2.3 Hủy yêu cầu (chỉ khi status = PENDING)
```http
DELETE /returns/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Hủy yêu cầu thành công",
  "data": {
    "id": "return-uuid",
    "status": "CANCELLED"
  }
}
```

---

## 🖼️ Phase 3: Upload Thêm Ảnh (Optional)

### Màn hình: `ReturnDetailScreen`

**Chức năng:** Customer có thể upload thêm ảnh chứng minh sau khi tạo request (chỉ khi status = PENDING).

### 3.1 Upload thêm ảnh
```http
POST /returns/:id/images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `images` | File[] | ✅ | 1-5 ảnh (JPG/PNG, max 5MB/ảnh) |
| `imageType` | `CUSTOMER_PROOF` | ✅ | Loại ảnh |

**React Native Code:**
```typescript
export const uploadReturnImages = async (
  returnId: string,
  images: ImagePickerAsset[]
) => {
  const formData = new FormData();

  formData.append('imageType', 'CUSTOMER_PROOF');

  images.forEach((image) => {
    formData.append('images', {
      uri: image.uri,
      type: image.mimeType ?? 'image/jpeg',
      name: image.fileName ?? `return_${Date.now()}.jpg`,
    } as any);
  });

  const response = await apiClient.post(
    `/returns/${returnId}/images`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return response.data;
};
```

**Response (201):**
```json
{
  "statusCode": 201,
  "message": "Upload ảnh thành công",
  "data": {
    "images": [
      {
        "id": "image-uuid",
        "imageUrl": "https://supabase.../image.jpg",
        "imageType": "CUSTOMER_PROOF"
      }
    ]
  }
}
```

### 3.2 Xóa ảnh
```http
DELETE /returns/:id/images/:imageId
Authorization: Bearer <token>
```

---

## 💰 Phase 4: Xem Kết Quả Phê Duyệt

### Màn hình: `ReturnDetailScreen`

Khi `status === 'APPROVED'`, hiển thị thông tin phê duyệt:

### 4.1 Trường hợp RETURN (Trả hàng)
```typescript
// Hiển thị thông tin hoàn tiền
const renderReturnInfo = (returnRequest) => (
  <View>
    <Text>✅ Yêu cầu đã được phê duyệt</Text>
    <Text>Số tiền hoàn: {formatCurrency(returnRequest.refundAmount)}</Text>
    <Text>Phương thức: {returnRequest.refundMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}</Text>
    <Text>Vui lòng gửi hàng về cửa hàng để nhận hoàn tiền</Text>
  </View>
);
```

### 4.2 Trường hợp EXCHANGE (Đổi hàng)
```typescript
// Hiển thị thông tin đổi hàng
const renderExchangeInfo = (returnRequest) => {
  const isPriceHigher = returnRequest.priceDifference > 0;
  
  return (
    <View>
      <Text>✅ Yêu cầu đã được phê duyệt</Text>
      
      {/* Sản phẩm cũ */}
      <Text>Sản phẩm trả lại:</Text>
      {returnRequest.returnItems.map(item => (
        <ProductCard key={item.id} product={item.product} />
      ))}
      
      {/* Sản phẩm mới */}
      <Text>Sản phẩm nhận:</Text>
      {returnRequest.returnItems.map(item => 
        item.exchangeProduct && (
          <ProductCard key={item.exchangeProductId} product={item.exchangeProduct} />
        )
      )}
      
      {/* Chênh lệch giá */}
      {isPriceHigher ? (
        <Text style={{ color: 'red' }}>
          Bạn cần thanh toán thêm: {formatCurrency(returnRequest.priceDifference)}
        </Text>
      ) : returnRequest.priceDifference < 0 ? (
        <Text style={{ color: 'green' }}>
          Bạn sẽ được hoàn: {formatCurrency(Math.abs(returnRequest.priceDifference))}
        </Text>
      ) : (
        <Text>Không có chênh lệch giá</Text>
      )}
    </View>
  );
};
```

### 4.3 Trường hợp WARRANTY (Bảo hành)
```typescript
// Hiển thị thông tin bảo hành
const renderWarrantyInfo = (returnRequest) => (
  <View>
    <Text>✅ Yêu cầu bảo hành đã được chấp nhận</Text>
    <Text>Vui lòng gửi sản phẩm về để được sửa chữa/thay thế</Text>
    <Text>Thời gian dự kiến: 3-5 ngày làm việc</Text>
  </View>
);
```

### 4.4 Trường hợp REJECTED (Bị từ chối)
```json
{
  "data": {
    "status": "REJECTED",
    "rejectedAt": "2026-02-20T15:00:00Z",
    "rejectionReason": "Sản phẩm đã qua sử dụng, không còn nguyên vẹn"
  }
}
```

```typescript
const renderRejectedInfo = (returnRequest) => (
  <View style={{ backgroundColor: '#FFEBEE', padding: 16 }}>
    <Text style={{ color: '#F44336', fontWeight: 'bold' }}>
      ❌ Yêu cầu đã bị từ chối
    </Text>
    <Text>Lý do: {returnRequest.rejectionReason}</Text>
  </View>
);
```

---

## 📦 Phase 5: Hoàn Tất (Staff xử lý)

### Màn hình: `ReturnDetailScreen`

Khi `status === 'COMPLETED'`, hiển thị thông tin hoàn tất:

```json
{
  "data": {
    "status": "COMPLETED",
    "completedAt": "2026-02-21T10:00:00Z",
    "refundAmount": "1500000",
    "refundMethod": "BANK_TRANSFER",
    "refundedAt": "2026-02-21T10:30:00Z",
    "completionNote": "Đã hoàn tiền vào tài khoản",
    "images": [
      {
        "imageUrl": "https://supabase.../staff_received.jpg",
        "imageType": "STAFF_RECEIVED"
      }
    ]
  }
}
```

```typescript
const renderCompletedInfo = (returnRequest) => (
  <View style={{ backgroundColor: '#E8F5E9', padding: 16 }}>
    <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>
      ✅ Đã hoàn tất xử lý
    </Text>
    <Text>Hoàn tất lúc: {formatDate(returnRequest.completedAt)}</Text>
    
    {returnRequest.type === 'RETURN' && (
      <>
        <Text>Số tiền đã hoàn: {formatCurrency(returnRequest.refundAmount)}</Text>
        <Text>Hoàn tiền lúc: {formatDate(returnRequest.refundedAt)}</Text>
      </>
    )}
    
    {returnRequest.completionNote && (
      <Text>Ghi chú: {returnRequest.completionNote}</Text>
    )}
    
    {/* Ảnh nhân viên chụp khi nhận hàng */}
    {returnRequest.images.filter(img => img.imageType === 'STAFF_RECEIVED').length > 0 && (
      <View>
        <Text>Ảnh hàng đã nhận:</Text>
        <ImageGallery images={returnRequest.images.filter(img => img.imageType === 'STAFF_RECEIVED')} />
      </View>
    )}
  </View>
);
```

---

## 📊 Phase 6: Thống Kê (Admin)

### Màn hình: `ReturnStatsScreen` (Admin only)

### 6.1 Lấy thống kê tổng quan
```http
GET /returns/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Lấy thống kê thành công",
  "data": {
    "totalReturns": 45,
    "totalExchanges": 23,
    "totalWarranties": 12,
    "pendingCount": 8,
    "approvedCount": 15,
    "completedCount": 50,
    "rejectedCount": 7,
    "totalRefundAmount": "67500000",
    "averageProcessingDays": 2.5
  }
}
```

### 6.2 Lấy tất cả returns (Admin/Operation)
```http
GET /returns?page=1&limit=10&status=PENDING&type=RETURN
Authorization: Bearer <token>
```

**Query params (optional):**
| Param | Type | Mô tả |
|-------|------|-------|
| `page` | number | Trang |
| `limit` | number | Số lượng/trang |
| `status` | string | Filter theo status |
| `type` | string | Filter theo type |
| `customerId` | string | Filter theo customer |
| `orderId` | string | Filter theo order |
| `startDate` | ISO date | Từ ngày |
| `endDate` | ISO date | Đến ngày |

---

## 🗂️ Tổng Hợp Tất Cả API Endpoints

### Customer APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `POST` | `/returns` | Tạo yêu cầu đổi/trả | Customer |
| `GET` | `/returns/my` | Danh sách returns của tôi | Customer |
| `GET` | `/returns/:id` | Chi tiết return | Customer |
| `POST` | `/returns/:id/images` | Upload thêm ảnh | Customer |
| `DELETE` | `/returns/:id/images/:imageId` | Xóa ảnh | Customer |
| `DELETE` | `/returns/:id` | Hủy yêu cầu | Customer |

### Operation APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/returns?status=PENDING` | Danh sách returns chờ duyệt | Operation |
| `GET` | `/returns/:id` | Chi tiết return | Operation |
| `PUT` | `/returns/:id/approve` | Phê duyệt yêu cầu | Operation |
| `PUT` | `/returns/:id/reject` | Từ chối yêu cầu | Operation |

### Staff APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/returns?status=APPROVED` | Danh sách returns đã duyệt | Staff |
| `GET` | `/returns/:id` | Chi tiết return | Staff |
| `PUT` | `/returns/:id/complete` | Hoàn tất xử lý | Staff |

### Admin APIs

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| `GET` | `/returns` | Tất cả returns (có filter) | Admin |
| `GET` | `/returns/stats` | Thống kê tổng quan | Admin |
| `GET` | `/returns/:id` | Chi tiết return | Admin |

---

## 🔔 Xử Lý Lỗi

```typescript
// api/errorHandler.ts
export const handleReturnApiError = (error: any): string => {
  if (error.response) {
    const { statusCode, message, error: errorDetails } = error.response.data;
    
    // Validation errors
    if (statusCode === 400 && errorDetails?.code === 'VALIDATION_ERROR') {
      const details = errorDetails.details || [];
      return details.map((d: any) => d.message).join('\n') || message;
    }
    
    switch (statusCode) {
      case 400: 
        // Business rule violations
        if (message.includes('Order chưa hoàn thành')) {
          return 'Chỉ có thể đổi/trả đơn hàng đã hoàn thành';
        }
        if (message.includes('đã quá hạn')) {
          return 'Đơn hàng đã quá hạn đổi/trả (7 ngày cho trả hàng, 15 ngày cho bảo hành)';
        }
        if (message.includes('không thể đổi/trả')) {
          return 'Sản phẩm này không được phép đổi/trả';
        }
        if (message.includes('đã có yêu cầu')) {
          return 'Đơn hàng này đã có yêu cầu đổi/trả đang xử lý';
        }
        return message || 'Dữ liệu không hợp lệ';
        
      case 401: 
        return 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại';
        
      case 403: 
        return 'Bạn không có quyền thực hiện thao tác này';
        
      case 404: 
        if (message.includes('Order')) return 'Không tìm thấy đơn hàng';
        if (message.includes('Return')) return 'Không tìm thấy yêu cầu đổi/trả';
        return 'Không tìm thấy dữ liệu';
        
      case 409: 
        return message || 'Dữ liệu đã tồn tại';
        
      default:  
        return 'Đã có lỗi xảy ra, vui lòng thử lại';
    }
  }
  
  if (error.code === 'ECONNABORTED') {
    return 'Kết nối quá chậm, vui lòng thử lại';
  }
  
  return 'Không thể kết nối đến server';
};
```

**Sử dụng trong component:**
```typescript
import { handleReturnApiError } from './api/errorHandler';

try {
  await createReturnRequest(params);
  Alert.alert('Thành công', 'Tạo yêu cầu đổi/trả thành công');
} catch (error) {
  const errorMessage = handleReturnApiError(error);
  Alert.alert('Lỗi', errorMessage);
}
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
    ├── OrdersTab
    │   ├── OrderListScreen              ← Danh sách đơn hàng
    │   ├── OrderDetailScreen            ← Chi tiết đơn hàng
    │   │   └── CreateReturnScreen       ← Phase 1: Tạo yêu cầu đổi/trả
    │   └── OrderTrackingScreen
    │
    ├── ReturnsTab
    │   ├── ReturnListScreen             ← Phase 2: Danh sách returns
    │   └── ReturnDetailScreen           ← Phase 3-5: Chi tiết & theo dõi
    │       ├── UploadImagesScreen       ← Upload thêm ảnh
    │       └── ImageGalleryScreen       ← Xem ảnh full screen
    │
    └── ProfileTab
        └── ProfileScreen
```

---

## 🎨 UI Components Suggestions

### 1. ReturnTypeSelector
```typescript
const ReturnTypeSelector = ({ value, onChange }) => (
  <View style={styles.typeSelector}>
    <TouchableOpacity
      style={[styles.typeButton, value === 'RETURN' && styles.typeButtonActive]}
      onPress={() => onChange('RETURN')}
    >
      <Text style={styles.typeIcon}>💰</Text>
      <Text style={styles.typeLabel}>Trả hàng</Text>
      <Text style={styles.typeDesc}>Hoàn tiền</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={[styles.typeButton, value === 'EXCHANGE' && styles.typeButtonActive]}
      onPress={() => onChange('EXCHANGE')}
    >
      <Text style={styles.typeIcon}>🔄</Text>
      <Text style={styles.typeLabel}>Đổi hàng</Text>
      <Text style={styles.typeDesc}>Đổi sản phẩm khác</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={[styles.typeButton, value === 'WARRANTY' && styles.typeButtonActive]}
      onPress={() => onChange('WARRANTY')}
    >
      <Text style={styles.typeIcon}>🛡️</Text>
      <Text style={styles.typeLabel}>Bảo hành</Text>
      <Text style={styles.typeDesc}>Sửa chữa/thay thế</Text>
    </TouchableOpacity>
  </View>
);
```

### 2. ProductConditionSelector
```typescript
const CONDITIONS = [
  { value: 'NEW', label: 'Mới', icon: '✨', description: 'Chưa sử dụng, nguyên seal' },
  { value: 'LIKE_NEW', label: 'Như mới', icon: '⭐', description: 'Đã mở hộp nhưng chưa dùng' },
  { value: 'GOOD', label: 'Tốt', icon: '👍', description: 'Đã sử dụng, không có lỗi' },
  { value: 'DEFECTIVE', label: 'Bị lỗi', icon: '⚠️', description: 'Có vấn đề cần bảo hành' },
];

const ProductConditionSelector = ({ value, onChange }) => (
  <View>
    {CONDITIONS.map(condition => (
      <TouchableOpacity
        key={condition.value}
        style={[styles.conditionItem, value === condition.value && styles.conditionItemActive]}
        onPress={() => onChange(condition.value)}
      >
        <Text style={styles.conditionIcon}>{condition.icon}</Text>
        <View style={styles.conditionInfo}>
          <Text style={styles.conditionLabel}>{condition.label}</Text>
          <Text style={styles.conditionDesc}>{condition.description}</Text>
        </View>
        {value === condition.value && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    ))}
  </View>
);
```

### 3. ReturnStatusBadge
```typescript
const ReturnStatusBadge = ({ status }: { status: string }) => {
  const config = RETURN_STATUS_LABELS[status] || { label: status, color: '#999' };
  
  return (
    <View style={[styles.badge, { backgroundColor: config.color }]}>
      <Text style={styles.badgeText}>{config.label}</Text>
    </View>
  );
};
```

### 4. ImageUploader
```typescript
import * as ImagePicker from 'expo-image-picker';

const ImageUploader = ({ images, onChange, maxImages = 5 }) => {
  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Thông báo', `Chỉ được upload tối đa ${maxImages} ảnh`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: maxImages - images.length,
    });

    if (!result.canceled) {
      onChange([...images, ...result.assets]);
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <View>
      <ScrollView horizontal>
        {images.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {images.length < maxImages && (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Text style={styles.addImageIcon}>📷</Text>
            <Text style={styles.addImageText}>Thêm ảnh</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      
      <Text style={styles.imageHint}>
        {images.length}/{maxImages} ảnh (JPG/PNG, max 5MB/ảnh)
      </Text>
    </View>
  );
};
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Upload ảnh:** Dùng `multipart/form-data`, field name phải là `images` (số nhiều)
2. **Field `items`:** Phải là **JSON string**, không phải object thuần. Dùng `JSON.stringify(items)`
3. **ProductId matching:** `productId` trong `items` phải khớp với `productId` trong `orderItem` của order
4. **Deadline validation:**
   - RETURN: 7 ngày kể từ khi order COMPLETED
   - EXCHANGE: 7 ngày kể từ khi order COMPLETED
   - WARRANTY: 15 ngày kể từ khi order COMPLETED
5. **Không thể đổi/trả:**
   - Sản phẩm theo toa (có prescription)
   - Sản phẩm dịch vụ (type = SERVICE)
   - Order chưa COMPLETED
6. **Image size:** Compress ảnh trước khi upload (khuyến nghị max 1MB/ảnh)
7. **Offline handling:** Cache danh sách returns để hiển thị khi mất mạng
8. **Pull to refresh:** Implement pull-to-refresh cho danh sách returns
9. **Real-time updates:** Có thể dùng polling hoặc WebSocket để cập nhật status real-time

---

## 🧪 Test Credentials

| Role | Email | Password | Phone |
|------|-------|----------|-------|
| Customer | `customer@example.com` | `Admin@123` | `0906666666` |
| Operation | `operation@wdp.com` | `Admin@123` | `0903333333` |
| Staff | `staff1@wdp.com` | `Admin@123` | `0904444444` |
| Admin | `admin@wdp.com` | `Admin@123` | `0901111111` |

**Fixed IDs (từ seed data):**
```
store_id:         00000000-0000-0000-0000-000000000011
frame_product_id: 00000000-0000-0000-0000-000000000021
lens_product_id:  00000000-0000-0000-0000-000000000023
```

---

## 📝 Test Scenarios

### Scenario 1: Trả hàng hoàn tiền (RETURN)
1. Login as Customer
2. Tạo order → Thanh toán → Complete order
3. Tạo return request với type = RETURN
4. Upload ảnh chứng minh
5. Đợi Operation approve
6. Gửi hàng về cửa hàng
7. Staff complete → Nhận hoàn tiền

### Scenario 2: Đổi sản phẩm (EXCHANGE)
1. Login as Customer
2. Tạo order Rayban (300k) → Complete
3. Tạo exchange request đổi sang Gucci (800k)
4. Operation approve → Chênh lệch +500k
5. Thanh toán thêm 500k (nếu cần)
6. Gửi hàng cũ về
7. Staff complete → Nhận hàng mới

### Scenario 3: Bảo hành (WARRANTY)
1. Login as Customer
2. Tạo order → Complete (trong vòng 15 ngày)
3. Tạo warranty request với condition = DEFECTIVE
4. Upload ảnh lỗi
5. Operation approve
6. Gửi hàng về sửa chữa
7. Staff complete → Nhận hàng đã sửa

### Scenario 4: Từ chối yêu cầu (REJECTED)
1. Customer tạo return request
2. Operation xem và từ chối với lý do
3. Customer nhận thông báo từ chối

### Scenario 5: Hủy yêu cầu (CANCELLED)
1. Customer tạo return request
2. Customer đổi ý và hủy yêu cầu (khi còn PENDING)

---

## 🎯 Performance Tips

1. **Image Optimization:**
```typescript
import * as ImageManipulator from 'expo-image-manipulator';

const compressImage = async (uri: string) => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }], // Resize to max width 1024px
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result;
};
```

2. **Pagination:**
```typescript
const [returns, setReturns] = useState([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  if (!hasMore) return;
  
  const response = await apiClient.get(`/returns/my?page=${page}&limit=10`);
  const newReturns = response.data.data.data;
  
  setReturns([...returns, ...newReturns]);
  setPage(page + 1);
  setHasMore(newReturns.length === 10);
};
```

3. **Debounce Search:**
```typescript
import { useDebounce } from 'use-debounce';

const [searchText, setSearchText] = useState('');
const [debouncedSearch] = useDebounce(searchText, 500);

useEffect(() => {
  if (debouncedSearch) {
    searchReturns(debouncedSearch);
  }
}, [debouncedSearch]);
```

---

🎉 **Ready to integrate Returns & Exchange system!**
