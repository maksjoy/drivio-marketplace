// Vercel overwrites x-real-ip and x-vercel-forwarded-for. x-forwarded-for is ignored
// because a client can prepend an address before the request reaches Vercel.

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isIpv4(value: string): boolean {
  if (!IPV4.test(value)) return false;
  return value.split(".").every((part) => Number(part) <= 255);
}

function isIpAddress(value: string): boolean {
  if (value.length < 2 || value.length > 64 || /\s/.test(value)) return false;
  if (isIpv4(value)) return true;

  const separator = value.lastIndexOf(":");
  const tail = separator >= 0 ? value.slice(separator + 1) : "";
  let head = value;
  if (tail.includes(".")) {
    if (!isIpv4(tail)) return false;
    head = value.slice(0, separator);
  }
  if (head.includes(".") || !head.includes(":") || !/^[0-9a-f:]+$/i.test(head)) return false;
  if (head.split("::").length > 2) return false;
  return head.split(":").every((group) => group.length <= 4);
}

export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const realIp = headers.get("x-real-ip")?.trim() ?? "";
  if (realIp && !realIp.includes(",") && isIpAddress(realIp)) return realIp;

  const vercelForwarded = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (vercelForwarded && isIpAddress(vercelForwarded)) return vercelForwarded;

  return "unknown";
}
