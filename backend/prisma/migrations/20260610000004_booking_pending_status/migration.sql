-- Add PENDING status to BookingStatus enum
-- NOTE: ALTER TABLE SET DEFAULT cannot be in same transaction as ADD VALUE (PostgreSQL 55P04)
-- Prisma handles @default(PENDING) at the application layer; DB-level default is set separately.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING';
