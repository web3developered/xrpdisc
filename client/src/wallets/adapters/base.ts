import {
  unsupportedCapability,
  walletUnavailable
} from "../errors";
import type {
  SignedXrplTransaction,
  UnsignedXrplTransaction,
  WalletAdapter,
  WalletAvailability,
  WalletCapabilities,
  WalletConnection,
  WalletId
} from "../types";

export abstract class BaseWalletAdapter implements WalletAdapter {
  abstract readonly id: WalletId;
  abstract readonly name: string;
  abstract readonly capabilities: WalletCapabilities;

  protected connection: WalletConnection | null = null;

  abstract isAvailable(): Promise<WalletAvailability>;

  async connect(): Promise<WalletConnection> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      throw walletUnavailable(this.id, availability.reason ?? `${this.name} is not available.`);
    }
    throw unsupportedCapability(this.id, `${this.name} connect is not implemented by this adapter.`);
  }

  async disconnect(): Promise<void> {
    this.connection = null;
  }

  async getAddress(): Promise<string> {
    if (!this.connection) {
      throw walletUnavailable(this.id, `${this.name} is not connected.`);
    }
    return this.connection.address;
  }

  async signTransaction(
    _transaction: UnsignedXrplTransaction
  ): Promise<SignedXrplTransaction> {
    throw unsupportedCapability(
      this.id,
      `${this.name} transaction signing is not enabled for this adapter.`
    );
  }

  protected rememberConnection(connection: WalletConnection): WalletConnection {
    this.connection = connection;
    return connection;
  }
}

