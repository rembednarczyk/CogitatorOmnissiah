export const formatETA = (current: number, total: number, startTime: number | null) => {
  if (!startTime || current <= 0 || current >= total) return null;
  const elapsed = Date.now() - startTime;
  const estimatedTotal = (elapsed / current) * total;
  const remaining = estimatedTotal - elapsed;
  
  const seconds = Math.floor((remaining / 1000) % 60);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  
  if (minutes > 0) {
    return `pozostało: ~${minutes}m ${seconds}s`;
  }
  return `pozostało: ~${seconds}s`;
};
