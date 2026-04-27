import type { DesktopApi } from "./contracts";
import { DESKTOP_API_METHODS, type DesktopApiMethod } from "./desktopApiMethods";

type DesktopApiInvoker = (method: DesktopApiMethod, ...args: unknown[]) => unknown;

type DesktopApiMethodFactory = (method: DesktopApiMethod) => (...args: unknown[]) => unknown;

export function createDesktopApiFromInvoker(invoke: DesktopApiInvoker): DesktopApi {
  const desktopApi: Partial<Record<DesktopApiMethod, (...args: unknown[]) => unknown>> = {};

  for (const method of DESKTOP_API_METHODS) {
    desktopApi[method] = (...args: unknown[]) => invoke(method, ...args);
  }

  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  return desktopApi as DesktopApi;
}

export function createDesktopApiForwarder(getDesktopApi: () => DesktopApi): DesktopApi {
  return createDesktopApiFromInvoker((method, ...args) => {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const handler = getDesktopApi()[method] as (...parameters: unknown[]) => unknown;
    return handler(...args);
  });
}

export function createDesktopApiWithDefaults(options: {
  fallback: DesktopApiMethodFactory;
  overrides?: Partial<DesktopApi>;
}): DesktopApi {
  const desktopApi: Partial<Record<DesktopApiMethod, (...args: unknown[]) => unknown>> = {};

  for (const method of DESKTOP_API_METHODS) {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const override = options.overrides?.[method] as ((...args: unknown[]) => unknown) | undefined;
    desktopApi[method] = override ?? options.fallback(method);
  }

  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  return desktopApi as DesktopApi;
}
