export const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length);
  const value = size / 1024 ** exponent;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ${units[exponent - 1]}`;
};

export const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
};
