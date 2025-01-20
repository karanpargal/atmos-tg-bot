import { Context, SessionFlavor } from "grammy";
import { HexString } from "supra-l1-sdk";

export interface SessionData {
  awaitingRecipient?: boolean;
  awaitingAmount?: boolean;
  recipientAddress?: string;
  swapState?: {
    fromToken?: string;
    toToken?: string;
    amount?: number;
    step: "select_from" | "select_to" | "enter_amount" | null;
  };
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
