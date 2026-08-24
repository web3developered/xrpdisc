import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

vi.stubGlobal("fetch", vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: "ok", service: "xrpl-defi-api", version: "0.1.0" })
  })
));

afterEach(() => {
  cleanup();
});

describe("client shell", () => {
  it("renders Sell All as the primary action without showing wallets by default", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: /Sell All Assets/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Select Wallet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xaman/i })).not.toBeInTheDocument();
  });

  it("opens and closes the wallet selector from the Sell All action", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Sell All Assets/i }));

    expect(screen.getByRole("dialog", { name: /Select Wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xaman/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GemWallet/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /Select Wallet/i })).not.toBeInTheDocument();
  });

  it("can render an empty strict mode root", () => {
    const element = document.createElement("div");
    const root = ReactDOM.createRoot(element);
    root.render(<React.StrictMode />);
    expect(element).toBeDefined();
  });
});
