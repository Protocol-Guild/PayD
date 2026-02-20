import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { StellarWalletsKit, WalletNetwork, AlbedoModule, FreighterModule, RabetModule, xBullModule } from "@creit.tech/stellar-wallets-kit";

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  kit: StellarWalletsKit | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);

  useEffect(() => {
    const newKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      modules: [
        new AlbedoModule(),
        new FreighterModule(),
        new RabetModule(),
        new xBullModule(),
      ]
    });
    setKit(newKit);
  }, []);

  const connect = async () => {
    if (!kit) return;
    try {
      const { address } = await kit.getAddress();
      setAddress(address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  return (
    <WalletContext.Provider value={{ address, connect, disconnect, kit }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
