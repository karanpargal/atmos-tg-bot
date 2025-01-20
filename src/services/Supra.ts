import { HexString, SupraAccount, SupraClient } from "supra-l1-sdk";
import { SUPRA_NODE_URL, SUPRA_COIN_TYPE } from "../utils/constants";
import { UserAccount } from "../utils/types";

export class SupraService {
  private client: SupraClient;
  private userAccounts: Map<number, UserAccount>;

  constructor() {
    this.client = new SupraClient(SUPRA_NODE_URL);
    this.userAccounts = new Map();
  }

  public hasAccount(userId: number): boolean {
    return this.userAccounts.has(userId);
  }

  public async createAccount(userId: number): Promise<UserAccount> {
    if (this.hasAccount(userId)) {
      throw new Error("User already has an account");
    }

    const account = new SupraAccount();
    const userAccount = {
      privateKey: account.toPrivateKeyObject().privateKeyHex,
      address: account.address(),
      accountObject: account.toPrivateKeyObject(),
    };

    this.userAccounts.set(userId, userAccount);
    await this.client.fundAccountWithFaucet(account.address());

    return userAccount;
  }

  public getAccount(userId: number): UserAccount | undefined {
    return this.userAccounts.get(userId);
  }

  public async getBalance(address: HexString): Promise<{
    balance: number;
    symbol: string;
    name: string;
  }> {
    const balance = await this.client.getAccountSupraCoinBalance(address);
    const coinInfo = await this.client.getCoinInfo(SUPRA_COIN_TYPE);

    return {
      balance: Number(balance) / Math.pow(10, coinInfo.decimals),
      symbol: coinInfo.symbol,
      name: coinInfo.name,
    };
  }

  public async transferSupraCoin(
    userId: number,
    toAddress: HexString,
    amount: number
  ) {
    const userAccountObject = this.userAccounts.get(userId);
    if (!userAccountObject) {
      throw new Error("User account not found");
    }

    const account = SupraAccount.fromAptosAccountObject(
      userAccountObject.accountObject
    );
    const coinInfo = await this.client.getCoinInfo(SUPRA_COIN_TYPE);
    return await this.client.transferSupraCoin(
      account,
      toAddress,
      BigInt(amount * 10 ** coinInfo.decimals)
    );
  }
}

export const supraService = new SupraService();
