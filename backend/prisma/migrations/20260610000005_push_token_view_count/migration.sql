-- Add expoPushToken to User for push notifications
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT;

-- Add viewCount to Property for landlord statistics
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;
