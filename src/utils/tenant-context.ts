import { createContext } from 'ts-context';

export interface TenantContextData {
  tenantId: string;
  tenantSlug: string;
  plan: string;
  createdAt: Date;
}

const { context: tenantContext, Provider: TenantProvider } = createContext<TenantContextData>();

export function setTenantContext(context: TenantContextData): void {
  tenantContext.set(context);
}

export function getTenantId(req: { headers: Record<string, string | undefined>; tenant?: { id: string } }): string {
  if (req.tenant?.id) {
    return req.tenant.id;
  }
  return tenantContext.get()?.tenantId ?? '';
}

export function getTenantContext(): TenantContextData | null {
  return tenantContext.getOrNull();
}

export function withTenantScope<T>(context: TenantContextData, fn: () => T): T {
  return tenantContext.with(context, fn);
}
