/** React-free route helpers shared by the dashboard definition and the views. */

export const EMAIL_BASE_PATH = "/email";
export const COMPOSE_SEGMENT = "compose";

export function providerPath(provider: string | null | undefined): string {
  return provider ? `${EMAIL_BASE_PATH}/${encodeURIComponent(provider)}` : EMAIL_BASE_PATH;
}

export function messagePath(provider: string, box: string, messageId: string): string {
  return `${providerPath(provider)}/${encodeURIComponent(box)}/${encodeURIComponent(messageId)}`;
}

export function composePath(provider: string): string {
  return `${providerPath(provider)}/${COMPOSE_SEGMENT}`;
}

export function isComposePath(pathname: string): boolean {
  return pathname.endsWith(`/${COMPOSE_SEGMENT}`);
}
