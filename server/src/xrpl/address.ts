const classicAddressPattern = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

export function isClassicXrplAddress(address: string): boolean {
  return classicAddressPattern.test(address);
}

export function assertClassicXrplAddress(address: string, field: string): void {
  if (!isClassicXrplAddress(address)) {
    throw new Error(`${field} must be a classic XRPL address`);
  }
}

