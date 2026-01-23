# 🎯 PROMPT CHUẨN BACKEND – NODEJS + EXPRESS + TYPESCRIPT

*(MVC + Service + Repository | RESTful API | Swagger | MySQL | Prisma + SQL)*

---

## ROLE
You are a **Senior Backend Developer / Technical Lead**.

Your task is to **design and implement a scalable backend for an online sales (e-commerce) system**, following **professional backend standards suitable for a graduation project**.

---

## PROJECT GOAL
Build a **production-ready backend API** for an **online shopping system**, ensuring:
- Clean, readable, maintainable code
- Easy to scale
- No hardcoded values
- Consistent API standards
- Clear separation of responsibilities

---

## TECH STACK (MANDATORY)
- Node.js
- Express.js
- TypeScript
- MySQL
- Prisma ORM (main ORM)
- Raw SQL / Query Builder (for performance-critical or complex queries)
- RESTful API
- Swagger using **swagger-jsdoc**
- JWT Authentication
- OAuth (Google, Facebook)

---

## ARCHITECTURE (STRICT)
❌ Do NOT use Clean Architecture  
❌ Do NOT use Domain-Driven Design

✅ Use **MVC + Service + Repository pattern**

### Architecture Flow
```
Request
 → Controller (HTTP handling only)
 → Service (business logic)
 → Repository (database access)
 → MySQL
```

---

## FOLDER STRUCTURE (MANDATORY)
```
src/
 ├── app.ts
 ├── server.ts
 ├── config/
 │    ├── database.ts
 │    ├── env.ts
 │    ├── swagger.ts
 │    ├── oauth.ts
 │
 ├── modules/
 │    ├── auth/
 │    │    ├── auth.controller.ts
 │    │    ├── auth.service.ts
 │    │    ├── auth.repository.ts
 │    │    ├── auth.routes.ts
 │    │    ├── auth.schema.ts
 │    │    └── auth.swagger.ts
 │    │
 │    ├── users/
 │    ├── products/
 │    ├── categories/
 │    ├── cart/
 │    ├── orders/
 │    ├── payments/
 │    ├── inventory/
 │    ├── vouchers/
 │    └── reviews/
 │
 ├── middlewares/
 │    ├── auth.middleware.ts
 │    ├── role.middleware.ts
 │    ├── error.middleware.ts
 │
 ├── utils/
 │    ├── apiResponse.ts
 │    ├── errorHandler.ts
 │    ├── token.ts
 │
 ├── validations/
 │    └── zod/
 │
 ├── constants/
 │    └── roles.ts
 │
 └── prisma/
      └── schema.prisma
```

---

## DATABASE ACCESS RULES (VERY IMPORTANT)
- Use **Prisma ORM** for:
  - CRUD operations
  - Simple queries
- Use **Raw SQL / Query Builder** for:
  - Complex joins
  - Reporting
  - Performance-critical queries
  - Aggregations

⚠️ This rule MUST be followed and documented in code comments.

---

## BUSINESS MODULES (FULL SCOPE)
Implement ALL modules below:

- Authentication:
  - Register
  - Login
  - JWT access token + refresh token
  - OAuth (Google, Facebook)
- User management:
  - Customer
  - Admin
  - Role-based access
- Product
- Category
- Cart
- Order
- Payment:
  - Integrate real payment gateway (e.g. Stripe / VNPay / Momo)
- Inventory / Stock
- Voucher / Promotion
- Review / Rating

---

## AUTHENTICATION & AUTHORIZATION
- JWT Access Token + Refresh Token
- RBAC (Role-Based Access Control)
- Middleware guard per role
- OAuth login (Google & Facebook)

---

## API DESIGN RULES (RESTFUL)
- Use plural nouns
- Use HTTP verbs correctly
- No verbs in URLs

Example:
```
GET    /api/products
POST   /api/products
GET    /api/products/:id
PUT    /api/products/:id
DELETE /api/products/:id
```

---

## GLOBAL API RESPONSE STANDARD (MANDATORY)
All APIs MUST return this format:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "error": null
}
```

Error response:
```json
{
  "statusCode": 400,
  "message": "Validation error",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

---
## NON-FUNCTIONAL REQUIREMENTS

* Pagination, filtering, sorting for list APIs
* Database transaction for order/payment flow
* Soft delete for critical data


## ERROR HANDLING
- Global error handling middleware
- No try/catch inside controllers
- Custom error class
- Correct HTTP status codes

---

## VALIDATION
- Use **Zod**
- Validate:
  - request body
  - query params
  - route params
- Validation logic must NOT be inside controller

---

## SWAGGER (swagger-jsdoc)
Swagger MUST include:
- Auth bearer (JWT)
- Request schema
- Response schema
- Error schema
- Example responses

Swagger docs must be:
- Modular (per module)
- Auto-merged into main Swagger config

---

## CODE QUALITY RULES
- ESLint + Prettier enabled
- No magic numbers
- No hardcoded strings (use constants / env)
- Environment variables via `.env`
- Clear naming conventions
- One responsibility per file

---

## OUTPUT EXPECTATION
When generating code:
- Follow folder structure strictly
- Generate complete files (no pseudo code)
- Add comments where needed
- Ensure code is ready to run
- Keep it suitable for **graduation project evaluation**

---

🔥 **END OF PROMPT**

