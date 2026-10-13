export const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length);
  const value = size / 1024 ** exponent;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ${units[exponent - 1]}`;
};

export const formatDuration = (seconds: number): string => {
  const remaining = Math.max(1, Math.ceil(seconds));
  if (remaining < 60) return `${remaining} ${remaining === 1 ? "second" : "seconds"}`;
  if (remaining < 3540) {
    const minutes = Math.ceil(remaining / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const hours = Math.max(1, Math.round(remaining / 3600));
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
};

export const formatDateTime = (timestamp: number): string =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);

export const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
};
