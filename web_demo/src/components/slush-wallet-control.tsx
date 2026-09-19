"use client";

import { useEffect, useState } from "react";
import {
  useCurrentClient,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from "@mysten/dapp-kit-react";
import { SLUSH_WALLET_NAME } from "@mysten/slush-wallet";
import { Loader2, Plus, WalletCards } from "lucide-react";

const DEFAULT_ESCROW_ID =
  "0x4b3d24770aaadbe2762c5ac5f442e6fe85c824f2e6282c68885d154e44f744d0";

function formatSui(balance: string) {
  const mist = BigInt(balance);
  const mistPerSui = BigInt(1_000_000_000);
  const whole = mist / mistPerSui;
  const fraction = (mist % mistPerSui)
    .toString()
    .padStart(9, "0")
    .slice(0, 4)
    .replace(/0+$/, "");
  return `${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function decodeEscrow(content: unknown) {
  if (!content || typeof content !== "object") return null;
  const bytes = Object.values(content).map(Number);
  if (bytes.length < 72 || bytes.some((byte) => !Number.isInteger(byte))) {
    return null;
  }
  const owner = `0x${bytes
    .slice(32, 64)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
  let mist = BigInt(0);
  for (let index = 0; index < 8; index += 1) {
    mist += BigInt(bytes[64 + index]) << BigInt(index * 8);
  }
  return { owner, balance: mist.toString() };
}

function EscrowBalance({ address }: { address: string }) {
  const client = useCurrentClient();
  const [balance, setBalance] = useState<string | null>(null);
  const [hasEscrow, setHasEscrow] = useState(false);
  const escrowId =
    process.env.NEXT_PUBLIC_HIREME_ESCROW_ID ?? DEFAULT_ESCROW_ID;

  useEffect(() => {
    let current = true;
    void client
      .getObject({
        objectId: escrowId,
        include: { content: true, owner: true },
      })
      .then((response) => {
        const escrow = decodeEscrow(response.object?.content);
        if (!current) return;
        if (!escrow || escrow.owner.toLowerCase() !== address.toLowerCase()) {
          setHasEscrow(false);
          setBalance("0");
          return;
        }
        setHasEscrow(true);
        setBalance(formatSui(escrow.balance));
      })
      .catch(() => {
        if (current) {
          setHasEscrow(false);
          setBalance("0");
        }
      });
    return () => {
      current = false;
    };
  }, [address, client, escrowId]);

  return (
    <strong
      title={hasEscrow ? "내 에스크로 잔액" : "연결된 에스크로가 없습니다."}
    >
      {balance === null ? (
        <Loader2 size={14} className="spin" />
      ) : (
        `${balance} SUI`
      )}
    </strong>
  );
}

export default function SlushWalletControl() {
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const [error, setError] = useState("");

  async function connectSlush() {
    const slush = wallets.find((wallet) => wallet.name === SLUSH_WALLET_NAME);
    if (!slush) {
      setError(
        "Slush Wallet을 불러오지 못했습니다. 확장 프로그램 또는 Slush 웹 지갑을 확인해주세요.",
      );
      return;
    }
    setError("");
    try {
      await dAppKit.connectWallet({ wallet: slush });
    } catch {
      setError("Slush Wallet 연결이 취소되었거나 완료되지 않았습니다.");
    }
  }

  if (connection.isConnected && connection.account) {
    return (
      <div className="wallet-control wallet-connected">
        <span className="wallet-address" title={connection.account.address}>
          <WalletCards size={14} /> {shortAddress(connection.account.address)}
        </span>
        <span className="escrow-label">내 에스크로</span>
        <EscrowBalance address={connection.account.address} />
        <button
          className="wallet-logout"
          onClick={() => void dAppKit.disconnectWallet()}
        >
          로그아웃
        </button>
        <button
          className="wallet-fund"
          onClick={() =>
            window.open("https://my.slush.app", "_blank", "noopener,noreferrer")
          }
        >
          <Plus size={14} /> 충전
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-control">
      <button
        className="wallet-login"
        disabled={connection.isConnecting}
        onClick={() => void connectSlush()}
      >
        {connection.isConnecting ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <WalletCards size={15} />
        )}
        {connection.isConnecting ? "연결 중..." : "Slush Wallet 로그인"}
      </button>
      {error && (
        <span className="wallet-error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
