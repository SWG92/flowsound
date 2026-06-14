type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  const prefix = `[FlowSound][${entry.level.toUpperCase()}][${entry.timestamp}]`;
  if (entry.data !== undefined) {
    return `${prefix} ${entry.message}`;
  }
  return `${prefix} ${entry.message}`;
}

function log(level: LogLevel, message: string, data?: unknown) {
  const entry: LogEntry = {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  // 在开发环境保留 console 输出，生产环境可替换为远程日志服务
  if (process.env.NODE_ENV === "development") {
    const formatted = formatLog(entry);
    switch (level) {
      case "error":
        console.error(formatted, data ?? "");
        break;
      case "warn":
        console.warn(formatted, data ?? "");
        break;
      case "info":
        console.log(formatted, data ?? "");
        break;
    }
  }
  // 生产环境：可接入远程日志服务（如 Sentry、Datadog 等）
}

export function logInfo(message: string, data?: unknown) {
  log("info", message, data);
}

export function logWarn(message: string, data?: unknown) {
  log("warn", message, data);
}

export function logError(message: string, data?: unknown) {
  log("error", message, data);
}

export const logger = { info: logInfo, warn: logWarn, error: logError };
