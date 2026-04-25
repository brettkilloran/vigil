import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const WEBCLIP_ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const WEBCLIP_ALLOWED_PORTS = new Set(["", "80", "443"]);

export async function defaultWebclipDnsLookup(
  hostname: string
): Promise<readonly string[]> {
  const rows = await lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

function ipv4FromMappedIpv6(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith("::ffff:")) {
    return null;
  }
  return address.slice("::ffff:".length);
}

function parseIpv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4(address: string): boolean {
  const mapped = ipv4FromMappedIpv6(address);
  const raw = mapped ?? address;
  const octets = parseIpv4Octets(raw);
  if (!octets) {
    return false;
  }
  const [a, b] = octets;
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

function parseIpv6FirstHextet(address: string): number | null {
  const normalized = address.toLowerCase();
  const first = normalized.split(":")[0];
  if (!first) {
    return 0;
  }
  if (!/^[0-9a-f]{1,4}$/.test(first)) {
    return null;
  }
  return Number.parseInt(first, 16);
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::") {
    return true;
  }
  const first = parseIpv6FirstHextet(lower);
  if (first == null) {
    return false;
  }
  if ((first & 0xfe_00) === 0xfc_00) {
    return true; // fc00::/7
  }
  if ((first & 0xff_c0) === 0xfe_80) {
    return true; // fe80::/10
  }
  return false;
}

export function webclipAddressBlocked(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return isPrivateIpv4(address);
  }
  if (family === 6) {
    const mapped = ipv4FromMappedIpv6(address);
    if (mapped) {
      return isPrivateIpv4(mapped);
    }
    return isPrivateIpv6(address);
  }
  return false;
}

export async function assertWebclipFetchTargetAllowed(
  target: URL,
  options: {
    lookupHost?: (hostname: string) => Promise<readonly string[]>;
  } = {}
): Promise<void> {
  if (!WEBCLIP_ALLOWED_PROTOCOLS.has(target.protocol)) {
    throw new Error("Blocked webclip target: protocol");
  }
  if (!WEBCLIP_ALLOWED_PORTS.has(target.port)) {
    throw new Error("Blocked webclip target: port");
  }
  if (target.username || target.password) {
    throw new Error("Blocked webclip target: credentials in URL");
  }
  const host = target.hostname.trim().toLowerCase();
  if (!host || host === "localhost") {
    throw new Error("Blocked webclip target: localhost");
  }
  const lookupHost = options.lookupHost ?? defaultWebclipDnsLookup;
  const addresses = isIP(host) ? [host] : await lookupHost(host);
  if (!addresses.length) {
    throw new Error("Blocked webclip target: unresolved host");
  }
  for (const address of addresses) {
    if (webclipAddressBlocked(address)) {
      throw new Error("Blocked webclip target: private address");
    }
  }
}
