-- Add REVISION status for iterative submission flow
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'REVISION';