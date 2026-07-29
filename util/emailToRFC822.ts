import type { EmailDraft, EmailMessage } from "../EmailProvider.ts";
import { combineEmailAddressAndName, parseEmailAddress, parseEmailAddresses } from "./emailAddress.ts";

function parseHeadersAndBody(raw: string): { headers: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitIdx = normalized.indexOf("\n\n");
  const headerBlock = splitIdx !== -1 ? normalized.slice(0, splitIdx) : normalized;
  const body = splitIdx !== -1 ? normalized.slice(splitIdx + 2) : "";

  // Handle line folding in standard RFC 822 headers
  const unfoldedHeaders = headerBlock.replace(/\n[ \t]+/g, " ");
  const headers: Record<string, string> = {};

  for (const line of unfoldedHeaders.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      headers[key] = line.slice(colonIndex + 1).trim();
    }
  }

  return { headers, body };
}

export function emailToRFC822(message: EmailMessage): string {
  const lines: string[] = [];

  lines.push(`Message-ID: <${message.id}>`);
  if (message.threadId) {
    lines.push(`Thread-ID: ${message.threadId}`);
  }
  lines.push(`From: ${combineEmailAddressAndName(message.from)}`);
  if (message.to.length > 0) {
    lines.push(`To: ${message.to.map(combineEmailAddressAndName).join(", ")}`);
  }
  if (message.cc && message.cc.length > 0) {
    lines.push(`Cc: ${message.cc.map(combineEmailAddressAndName).join(", ")}`);
  }
  if (message.bcc && message.bcc.length > 0) {
    lines.push(`Bcc: ${message.bcc.map(combineEmailAddressAndName).join(", ")}`);
  }
  lines.push(`Subject: ${message.subject}`);
  if (message.sentAt) {
    lines.push(`Date: ${new Date(message.sentAt).toUTCString()}`);
  } else if (message.receivedAt) {
    lines.push(`Date: ${new Date(message.receivedAt).toUTCString()}`);
  }

  lines.push("");
  lines.push(message.textBody ?? message.htmlBody ?? "");

  return lines.join("\n");
}

export function rfc822ToEmail(raw: string): EmailMessage {
  const { headers, body } = parseHeadersAndBody(raw);

  const id = headers["message-id"] ? headers["message-id"].replace(/^<|>$/g, "") : "";
  const threadId = headers["thread-id"];
  const subject = headers.subject ?? "";
  const from = headers.from ? parseEmailAddress(headers.from) : { email: "" };
  const to = headers.to ? parseEmailAddresses(headers.to) : [];
  const cc = headers.cc ? parseEmailAddresses(headers.cc) : undefined;
  const bcc = headers.bcc ? parseEmailAddresses(headers.bcc) : undefined;

  let sentAt: number | undefined;
  if (headers.date) {
    const parsedDate = Date.parse(headers.date);
    if (!Number.isNaN(parsedDate)) {
      sentAt = parsedDate;
    }
  }

  return {
    id,
    ...(threadId ? { threadId } : {}),
    subject,
    from,
    to,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    textBody: body,
    isRead: true,
    ...(sentAt !== undefined ? { sentAt } : {}),
  };
}

export function draftToRFC822(draft: EmailDraft): string {
  const lines: string[] = [];

  lines.push(`X-Draft-ID: ${draft.id}`);
  if (draft.threadId) {
    lines.push(`Thread-ID: ${draft.threadId}`);
  }
  if (draft.to.length > 0) {
    lines.push(`To: ${draft.to.map(combineEmailAddressAndName).join(", ")}`);
  }
  if (draft.cc && draft.cc.length > 0) {
    lines.push(`Cc: ${draft.cc.map(combineEmailAddressAndName).join(", ")}`);
  }
  if (draft.bcc && draft.bcc.length > 0) {
    lines.push(`Bcc: ${draft.bcc.map(combineEmailAddressAndName).join(", ")}`);
  }
  lines.push(`Subject: ${draft.subject}`);
  lines.push(`Date: ${new Date(draft.updatedAt).toUTCString()}`);

  lines.push("");
  lines.push(draft.textBody ?? draft.htmlBody ?? "");

  return lines.join("\n");
}

export function rfc822ToDraft(raw: string): EmailDraft {
  const { headers, body } = parseHeadersAndBody(raw);

  const id = headers["x-draft-id"] ?? "";
  const threadId = headers["thread-id"];
  const subject = headers.subject ?? "";
  const to = headers.to ? parseEmailAddresses(headers.to) : [];
  const cc = headers.cc ? parseEmailAddresses(headers.cc) : undefined;
  const bcc = headers.bcc ? parseEmailAddresses(headers.bcc) : undefined;

  let timestamp = Date.now();
  if (headers.date) {
    const parsedDate = Date.parse(headers.date);
    if (!Number.isNaN(parsedDate)) {
      timestamp = parsedDate;
    }
  }

  return {
    id,
    ...(threadId ? { threadId } : {}),
    subject,
    to,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    textBody: body,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
