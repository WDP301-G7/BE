# E-commerce Backend API

Backend API for E-commerce system built with Node.js, Express, TypeScript, Prisma, and MySQL.

## 🚀 Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Prisma ORM** - Database ORM
- **MySQL** - Database
- **JWT** - Authentication
- **Zod** - Validation
- **Swagger** - API documentation

## 📁 Project Structure

```
src/
├── app.ts                 # Express app configuration
├── server.ts             # Server entry point
├── config/               # Configuration files
├── modules/              # Business modules (MVC + Service + Repository)
├── middlewares/          # Express middlewares
├── utils/                # Utility functions
├── validations/          # Zod validation schemas
├── constants/            # Constants and enums
└── prisma/              # Prisma schema
```

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd BE-WDP
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```
Edit `.env` and configure your database and other settings.

4. **Setup database**
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

5. **Run the application**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## 📚 API Documentation

Access Swagger documentation at: `http://localhost:3000/api-docs`

## 🏗️ Architecture

This project follows **MVC + Service + Repository** pattern:

```
Request → Controller → Service → Repository → Database
```

- **Controller**: HTTP handling only
- **Service**: Business logic
- **Repository**: Database access

## 🔐 Authentication

- JWT Access Token + Refresh Token
- OAuth (Google & Facebook)
- Role-based access control (RBAC)

## 📝 Scripts

```bash
npm run dev          # Run in development mode
npm run build        # Build for production
npm start            # Run production build
npm run lint         # Lint code
npm run lint:fix     # Lint and fix code
npm run format       # Format code with Prettier
```

## 🗄️ Database

Using **Prisma ORM** with MySQL:

- Use Prisma for CRUD and simple queries
- Use raw SQL for complex joins and performance-critical queries

## 🔥 Features

- ✅ User authentication (JWT + OAuth)
- ✅ Role-based access control
- ✅ Product management
- ✅ Category management
- ✅ Shopping cart
- ✅ Order management
- ✅ Payment integration
- ✅ Inventory tracking
- ✅ Voucher system
- ✅ Product reviews

## 📋 API Response Format

All API responses follow this standard format:

**Success Response:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "error": null
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "Error message",
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "details": []
  }
}
```

## 🧪 Environment Variables

See `.env.example` for all required environment variables.

## 📄 License

ISC
