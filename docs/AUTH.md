# AUTH.md

## Overview

Auth is JWT + server-side session revocation.

- Passwords are hashed with `bcryptjs` (cost 12)
- Login returns bearer token
- JWT payload includes `sub`, `role`, `email`, `jti`
- `jti` is persisted in `sessions`; logout revokes session row

## Roles

- `client`: default portal access
- `admin`: can create users, create slots, view bookings, access admin overview

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout` (Bearer token required)
- `GET /api/auth/me` (Bearer token required)
- `POST /api/auth/register` (admin token required)

## Security notes

- Set strong `JWT_SECRET` in production
- Set short token expiry (`JWT_EXPIRY`) for stricter posture
- Rotate compromised users by setting `is_active=0` in DB
- Revoke active token with `/api/auth/logout`
