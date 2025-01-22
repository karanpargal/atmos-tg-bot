import { HexString, SupraAccount, SupraClient } from "supra-l1-sdk";
import {
  SUPRA_NODE_URL,
  SUPRA_COIN_TYPE,
  WHITELISTED_COINS,
} from "../utils/constants";
import { UserAccount } from "../utils/types";
import { TypeTagParser } from "aptos";
import { BCS } from "supra-l1-sdk";

export class SupraService {
  private client: SupraClient;
  public userAccounts: Map<number, UserAccount>;

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

  public async getCoinBalance(
    address: HexString,
    coinType: string
  ): Promise<number> {
    try {
      const balance = await this.client.getAccountCoinBalance(
        address,
        coinType
      );
      const coinInfo = await this.client.getCoinInfo(coinType);

      return Number(balance) / Math.pow(10, coinInfo.decimals);
    } catch (error) {
      return 0;
    }
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

  public async sendTransaction(params: {
    userId: number;
    moduleAddr: string;
    moduleName: string;
    functionName: string;
    functionTypeArgs: string[];
    functionArgs: any[];
    enableSimulation?: boolean;
    waitForTx?: boolean;
  }) {
    const userAccount = this.userAccounts.get(params.userId);
    if (!userAccount) {
      throw new Error("User account not found");
    }

    const account = SupraAccount.fromAptosAccountObject(
      userAccount.accountObject
    );
    const senderAddr = account.address();

    const accountInfo = await this.client.getAccountInfo(senderAddr);
    const type_arguments = params.functionTypeArgs.map((arg) =>
      new TypeTagParser(arg).parseTypeTag()
    );

    const convertedArgs = params.functionArgs.map((arg) => {
      if (typeof arg === "string" && arg.startsWith("0x")) {
        return new HexString(arg).toUint8Array();
      } else if (typeof arg === "number" || typeof arg === "bigint") {
        return BCS.bcsSerializeUint64(BigInt(arg));
      } else if (Array.isArray(arg)) {
        const serializer = new BCS.Serializer();
        serializer.serializeU32AsUleb128(arg.length);
        arg.forEach((item: number | bigint) => {
          serializer.serializeU64(BigInt(item));
        });
        return serializer.getBytes();
      } else if (typeof arg === "string" && Number(arg) > 0) {
        return BCS.bcsSerializeUint64(BigInt(arg));
      }
      throw new Error(`Unsupported argument type: ${typeof arg}`);
    });

    const serializedRawTx = await this.client.createSerializedRawTxObject(
      senderAddr,
      accountInfo.sequence_number,
      params.moduleAddr,
      params.moduleName,
      params.functionName,
      type_arguments,
      convertedArgs
    );

    return await this.client.sendTxUsingSerializedRawTransaction(
      account,
      serializedRawTx,
      {
        enableTransactionSimulation: false,
        enableWaitForTransaction: true,
      }
    );
  }

  public async getAllBalances(address: HexString): Promise<
    Array<{
      balance: number;
      symbol: string;
      name: string;
    }>
  > {
    const balances = [];

    const supraCoinBalance = await this.getBalance(address);
    balances.push(supraCoinBalance);

    for (const coin of WHITELISTED_COINS) {
      try {
        const balance = await this.getCoinBalance(address, coin.type);
        balances.push({
          balance,
          symbol: coin.symbol,
          name: coin.name,
        });
      } catch (error) {
        console.error(`Error fetching balance for ${coin.symbol}:`, error);
        balances.push({
          balance: 0,
          symbol: coin.symbol,
          name: coin.name,
        });
      }
    }

    return balances;
  }
}

export const supraService = new SupraService();
