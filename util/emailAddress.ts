import type { EmailAddress } from "../EmailProvider.ts";

export function combineEmailAddressAndName(address: EmailAddress): string {
  if (address.name) {
    return `${address.name} <${address.email}>`;
  }
  return address.email;
}

export function parseEmailAddress(str: string): EmailAddress {
  const match = str.match(/^(?:(.*)<([^>]+)>|([^<>\s]+))$/);
  if (!match) {
    return { email: str.trim() };
  }
  if (match[2]) {
    const name = match[1]!.trim().replace(/^["']|["']$/g, "");
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
  }
  return { email: (match[3] || str).trim() };
}

export function parseEmailAddresses(str: string): EmailAddress[] {
  if (!str.trim()) return [];
  // Split on commas not enclosed within quotes or angle brackets
  const rawAddresses: string[] = [];
  let current = "";
  let inAngle = false;
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !inAngle) inQuotes = !inQuotes;
    else if (char === "<" && !inQuotes) inAngle = true;
    else if (char === ">" && !inQuotes) inAngle = false;

    if (char === "," && !inQuotes && !inAngle) {
      if (current.trim()) rawAddresses.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) rawAddresses.push(current.trim());

  return rawAddresses.map(parseEmailAddress);
}
