import { Context, SessionFlavor } from "grammy";
import { HexString } from "supra-l1-sdk";

export interface SessionData {
  awaitingRecipient: boolean;
  awaitingAmount: boolean;
  recipientAddress: string;
  swapState?: {
    step: string | null;
    fromToken?: string;
    toToken?: string;
  };
  lastClaimed: { [key: string]: number };
}

export type MyContext = Context & SessionFlavor<SessionData>;

export interface UserAccount {
  privateKey: string;
  accountObject: {
    address?: string;
    publicKeyHex?: string;
    privateKeyHex: string;
  };
  address: HexString;
}

export interface ClaimResponse {
  result: Array<{
    since?: string;
  }>;
}
