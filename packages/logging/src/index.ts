export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

function write(
  level: LogLevel,
  service: string,
  message: string,
  context?: LogContext,
): void {
  const payload: Record<string, unknown> = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

export function createLogger(service: string): Logger {
  return {
    debug(message, context) {
      write('debug', service, message, context);
    },
    info(message, context) {
      write('info', service, message, context);
    },
    warn(message, context) {
      write('warn', service, message, context);
    },
    error(message, context) {
      write('error', service, message, context);
    },
  };
}
