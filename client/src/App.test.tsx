import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import ReactDOM from "react-dom/client";

vi.stubGlobal("fetch", vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: "ok", service: "xrpl-defi-api", version: "0.1.0" })
  })
));

describe("client shell", () => {
  it("renders the Phase 2 wallet-boundary language", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import("./main");
    expect(await screen.findByText("XRPL DeFi")).toBeInTheDocument();
    expect(screen.getByText(/Connecting a wallet only identifies the account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xaman/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GemWallet/i })).toBeInTheDocument();
  });

  it("can render an empty strict mode root", () => {
    const element = document.createElement("div");
    const root = ReactDOM.createRoot(element);
    root.render(<React.StrictMode />);
    expect(element).toBeDefined();
  });
});
