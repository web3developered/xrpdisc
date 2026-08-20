import { useMemo, useState } from "react";
import { connectCrossmark, connectGemWallet, type WalletConnection } from "./wallets";

type Mode = "swap" | "bridge" | "stake";

const modes: { id: Mode; title: string; subtitle: string }[] = [
  { id: "swap", title: "Swap", subtitle: "Trade assets on XRPL" },
  { id: "bridge", title: "Bridge", subtitle: "Move assets across supported rails" },
  { id: "stake", title: "Stake", subtitle: "Put supported assets to work" }
];

const wallets = [
  { id: "xaman", name: "Xaman", note: "Mobile & QR signing", tone: "purple" },
  { id: "crossmark", name: "Crossmark", note: "Browser extension", tone: "blue" },
  { id: "gemwallet", name: "GemWallet", note: "Browser extension", tone: "green" },
  { id: "walletconnect", name: "WalletConnect", note: "Connector", tone: "cyan" },
  { id: "ledger", name: "Ledger", note: "Hardware wallet", tone: "orange" }
];

export default function App() {
  const [mode, setMode] = useState<Mode>("swap");
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [showWallets, setShowWallets] = useState(false);
  const [status, setStatus] = useState("");
  const [amount, setAmount] = useState("");

  const active = useMemo(() => modes.find((m) => m.id === mode)!, [mode]);

  async function chooseWallet(id: string) {
    setStatus("Connecting…");
    try {
      let result: WalletConnection;
      if (id === "crossmark") result = await connectCrossmark();
      else if (id === "gemwallet") result = await connectGemWallet();
      else {
        setStatus(`${wallets.find(w => w.id === id)?.name} adapter is staged for the next integration step.`);
        return;
      }
      setWallet(result);
      setShowWallets(false);
      setStatus("Wallet connected");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Wallet connection failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">X</span><span>XRPL<span className="muted">DEFI</span></span></div>
        <div className="network"><span className="dot" /> XRPL Testnet</div>
        <button className="wallet-pill" onClick={() => setShowWallets(true)}>
          {wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "Connect wallet"}
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow">XRP LEDGER · SELF-CUSTODIAL</div>
        <h1>Move capital with<br /><em>clarity.</em></h1>
        <p className="hero-copy">A secure transaction workspace for swapping, bridging and staking assets on XRPL.</p>

        <div className="mode-tabs">
          {modes.map(m => <button className={mode === m.id ? "active" : ""} key={m.id} onClick={() => setMode(m.id)}>{m.title}</button>)}
        </div>

        <div className="trade-card">
          <div className="card-head"><span>{active.title}</span><span className="badge">TESTNET</span></div>
          <label>YOU SEND</label>
          <div className="asset-row">
            <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            <button className="asset">XRP <span>⌄</span></button>
          </div>
          <div className="divider"><span>↓</span></div>
          <label>YOU RECEIVE</label>
          <div className="asset-row">
            <input readOnly value={amount ? "Quote pending" : ""} placeholder="—" />
            <button className="asset">Select <span>⌄</span></button>
          </div>
          <div className="quote-row"><span>Network</span><b>XRPL</b><span>Estimated fee</span><b>—</b></div>
          <button className="primary" onClick={() => setShowWallets(true)}>
            {wallet ? "Review transaction" : "Connect wallet to continue"}
          </button>
          {status && <div className="status">{status}</div>}
        </div>
      </section>

      <section className="feature-grid">
        <article><span>01</span><h3>User-controlled signing</h3><p>Transactions are constructed as unsigned payloads and presented for explicit wallet approval.</p></article>
        <article><span>02</span><h3>XRPL-native</h3><p>Built around the XRP Ledger transaction model and validated network responses.</p></article>
        <article><span>03</span><h3>Observable</h3><p>Every transaction can be tracked from request through validated ledger outcome.</p></article>
      </section>

      <footer>Prototype UI · Testnet only · Never enter or share a wallet secret</footer>

      {showWallets && <div className="modal-backdrop" onClick={() => setShowWallets(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head"><div><div className="eyebrow">SECURE CONNECTION</div><h2>Choose your wallet</h2></div><button className="close" onClick={() => setShowWallets(false)}>×</button></div>
          <div className="wallet-list">
            {wallets.map(w => <button className="wallet-option" key={w.id} onClick={() => chooseWallet(w.id)}>
              <span className={`wallet-icon ${w.tone}`}>{w.name[0]}</span><span><b>{w.name}</b><small>{w.note}</small></span><span className="arrow">→</span>
            </button>)}
          </div>
          <p className="security-note">Your private keys stay in your wallet. This application only requests the minimum information needed to connect and prepare transactions.</p>
        </div>
      </div>}
    </main>
  );
}
