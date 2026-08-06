// Prosty strukturalny logger. Jedna linia na wpis, czytelna w logach Rendera,
// z komponentem, poziomem i opcjonalnym kontekstem (bez sekretów).

type Level = "info" | "warn" | "error";

const LEVEL_TAG: Record<Level, string> = {
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

function emit(level: Level, component: string, message: string, context?: Record<string, unknown>) {
  // Nie logujemy sekretów — kontekst powinien zawierać tylko metadane.
  const parts = [`[${LEVEL_TAG[level]}]`, `[${component}]`, message];
  let line = parts.join(" ");
  if (context && Object.keys(context).length > 0) {
    try {
      line += " " + JSON.stringify(context);
    } catch {
      line += " [context not serializable]";
    }
  }
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line);
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(component: string): Logger {
  return {
    info: (m, c) => emit("info", component, m, c),
    warn: (m, c) => emit("warn", component, m, c),
    error: (m, c) => emit("error", component, m, c),
  };
}

/**
 * Klasyfikuje błąd żądania HTTP (axios/network) do zrozumiałej kategorii.
 * Używane, by odróżnić blokadę IP/Cloudflare od zwykłego timeoutu czy
 * błędu aplikacyjnego — kluczowe przy diagnozie "sync nie działa".
 */
export type ErrorClass =
  | "ip_blocked"        // 403 / Cloudflare challenge — najczęstsza przyczyna na hostingu
  | "rate_limited"      // 429
  | "server_error"      // 5xx po stronie wiki
  | "timeout"           // przekroczony czas / zerwane połączenie
  | "dns"               // nie rozwiązano hosta
  | "http_error"        // inny status HTTP
  | "unknown";

export function classifyHttpError(error: any): { class: ErrorClass; status?: number; code?: string; hint: string; snippet?: string } {
  const status: number | undefined = error?.response?.status ?? error?.status;
  const code: string | undefined = error?.code;
  const bodyRaw = error?.response?.data;
  const body = typeof bodyRaw === "string" ? bodyRaw : bodyRaw != null ? safeStringify(bodyRaw) : "";
  const looksCloudflare = /cloudflare|cf-ray|attention required|captcha|checking your browser|just a moment/i.test(body);
  const snippet = body ? body.slice(0, 300) : undefined;

  if (status === 403 || (status === 503 && looksCloudflare) || looksCloudflare) {
    return {
      class: "ip_blocked",
      status,
      code,
      snippet,
      hint: "Encyklopedia odrzuciła żądanie (403/Cloudflare). Najprawdopodobniej IP serwera (np. Render) jest blokowane. Rozwiązania: uruchom lokalnie/z innej sieci, użyj proxy o zaufanym IP, albo hostuj tam, gdzie IP nie jest zablokowane.",
    };
  }
  if (status === 429) {
    return { class: "rate_limited", status, code, snippet, hint: "Zbyt wiele żądań (429). Odczekaj i spróbuj ponownie." };
  }
  if (status && status >= 500) {
    return { class: "server_error", status, code, snippet, hint: `Błąd po stronie encyklopedii (${status}).` };
  }
  if (code === "ETIMEDOUT" || code === "ECONNABORTED" || code === "ECONNRESET" || /timeout|socket hang up/i.test(error?.message || "")) {
    return { class: "timeout", status, code, hint: "Przekroczono czas połączenia z encyklopedią. Sieć wolna lub host niedostępny." };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { class: "dns", status, code, hint: "Nie udało się rozwiązać adresu encyklopedii (DNS/sieć)." };
  }
  if (status) {
    return { class: "http_error", status, code, snippet, hint: `Nieoczekiwany status HTTP ${status}.` };
  }
  return { class: "unknown", status, code, hint: error?.message || "Nieznany błąd sieciowy." };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
