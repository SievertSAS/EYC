type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  timestamp: string;
  detail?: unknown;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 200;

function log(level: LogLevel, context: string, message: string, detail?: unknown) {
  const entry: LogEntry = {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    detail,
  };

  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();

  if (process.env.NODE_ENV !== "production") {
    const prefix = { info: "ℹ", warn: "⚠", error: "✖" }[level];
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](`${prefix} [${context}] ${message}`, detail ?? "");
  }
}

export const logger = {
  info: (context: string, message: string, detail?: unknown) =>
    log("info", context, message, detail),
  warn: (context: string, message: string, detail?: unknown) =>
    log("warn", context, message, detail),
  error: (context: string, message: string, detail?: unknown) =>
    log("error", context, message, detail),
  getEntries: (level?: LogLevel): LogEntry[] =>
    level ? LOG_BUFFER.filter((e) => e.level === level) : [...LOG_BUFFER],
  clear: () => {
    LOG_BUFFER.length = 0;
  },
};
