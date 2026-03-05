/**
 * Load environment variables BEFORE any other module reads them.
 *
 * In ESM, module bodies are evaluated in depth-first import order.
 * By isolating dotenv here and importing this file first in index.ts,
 * we guarantee process.env is populated before auth.ts (or any other
 * module) tries to read JWT_SECRET or SMTP_HOST.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config();
