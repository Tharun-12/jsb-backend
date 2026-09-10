# JSB Backend - Dynamic Admin Login (JWT)

## 1. Install
```bash
npm install
```

If npm reports a lock-file mismatch because this project was copied from an older install, run:
```bash
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` and set your MySQL credentials and a strong `JWT_SECRET`.

## 3. Create the users table
Run `database/users.sql` in `jsb-database`.

## 4. Create the first admin
Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`, then run:
```bash
node createAdmin.js
```
The password is stored using bcrypt hashing.

## 5. Start
```bash
npm start
```

## Login API
`POST /api/admin/login`
```json
{"email":"admin@gmail.com","password":"1234"}
```

Successful response contains a JWT `token` and basic user information.

## Protected API
Send:
```http
Authorization: Bearer YOUR_JWT
```

`/api/admin/me`, `/api/admin/protected-test`, global search, and dashboard count endpoints are protected by JWT/admin middleware in this update.

Other customer/public CRUD routes are intentionally not globally protected because they may be used by the public website. Add the middleware to individual admin-only routes as needed.

Forgot-password endpoints added: POST /api/admin/forgot-password, /verify-otp, /reset-password. OTP expires in 5 minutes and reset requires successful OTP verification.
