import { ILogger } from './ILogger.js';

export class ConsoleLogger implements ILogger {
  private formatMeta(meta?: Record<string, unknown>): string {
    return meta ? ` | ${JSON.stringify(meta)}` : '';
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO]  ${new Date().toISOString()} — ${message}${this.formatMeta(meta)}`);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN]  ${new Date().toISOString()} — ${message}${this.formatMeta(meta)}`);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${new Date().toISOString()} — ${message}${this.formatMeta(meta)}`);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} — ${message}${this.formatMeta(meta)}`);
    }
  }
}

export const logger = new ConsoleLogger();
