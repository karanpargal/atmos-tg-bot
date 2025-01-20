import "dotenv/config";

const SUPRA_NODE_URL = process.env.SUPRA_NODE_URL!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const SUPRA_COIN_TYPE =
  "0x0000000000000000000000000000000000000000000000000000000000000001::supra_coin::SupraCoin";
const WHITELISTED_COINS: {
  name: string;
  type: string;
  symbol: string;
  decimals: number;
}[] = [
  {
    name: "tUSDC",
    type: "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7::test_usdc::TestUSDC",
    symbol: "tUSDC",
    decimals: 6,
  },
  {
    name: "tUSDT",
    type: "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7::test_usdt::TestUSDT",
    symbol: "tUSDT",
    decimals: 6,
  },
  {
    name: "tETH",
    type: "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7::test_eth::TestETH",
    symbol: "tETH",
    decimals: 18,
  },
  {
    name: "tBTC",
    type: "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7::test_btc::TestBTC",
    symbol: "tBTC",
    decimals: 8,
  },
];

export { SUPRA_NODE_URL, BOT_TOKEN, SUPRA_COIN_TYPE, WHITELISTED_COINS };
