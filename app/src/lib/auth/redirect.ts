export function safeNext(value?: string | null): string {
  return value && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value) && !value.startsWith("/login") && !value.startsWith("/mfa") ? value : "/overview";
}
