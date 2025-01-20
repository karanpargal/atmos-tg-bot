import { Context, SessionFlavor } from "grammy";
import { HexString } from "supra-l1-sdk";

export interface SessionData {
  awaitingRecipient?: boolean;
  awaitingAmount?: boolean;
  recipientAddress?: string;
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
