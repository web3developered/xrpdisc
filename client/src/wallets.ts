export type WalletConnection = {
  provider: "crossmark" | "gemwallet";
  address: string;
};

export async function connectCrossmark(): Promise<WalletConnection> {
  const sdk = (await import("@crossmarkio/sdk")).default;
  const result: any = await sdk.methods.signInAndWait();
  const address = result?.response?.data?.address;
  if (!address) throw new Error("Crossmark did not return an address.");
  return { provider: "crossmark", address };
}

export async function connectGemWallet(): Promise<WalletConnection> {
  const api: any = (window as any).GemWalletApi;
  if (!api) throw new Error("GemWallet extension/API is not available in this browser.");
  const connected = await api.isConnected();
  if (!connected) throw new Error("GemWallet is not connected.");
  const result = await api.getAddress();
  const address = result?.result?.address;
  if (!address) throw new Error("GemWallet did not return an address.");
  return { provider: "gemwallet", address };
}
