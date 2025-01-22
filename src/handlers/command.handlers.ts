import { InlineKeyboard } from "grammy";
import { supraService } from "../services/Supra";
import { SUPRA_NODE_URL, WHITELISTED_COINS } from "../utils/constants";
import { ClaimResponse, MyContext } from "../utils/types";
import { getTimeRemaining } from "../utils/helpers";

export async function handleRegister(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    if (supraService.hasAccount(userId)) {
      await ctx.reply("You already have a registered account!");
      return;
    }

    const account = await supraService.createAccount(userId);

    await ctx.reply(
      `Account created successfully!\nYour address: ${account.address}\nPlease store your private key safely (sent in next message)`
    );

    await ctx.reply(
      `Your private key: ${account.privateKey}\n⚠️ Never share this with anyone!`
    );
  } catch (error) {
    await ctx.reply(`Error creating account: ${error}`);
  }
}

export async function handleCheckBalance(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const account = supraService.getAccount(userId);
  if (!account) {
    await ctx.reply("Please register an account first!");
    return;
  }

  try {
    const balances = await supraService.getAllBalances(account.address);

    const balanceMessages = balances.map(
      ({ balance, symbol, name }) => `${name} (${symbol}): ${balance}`
    );

    await ctx.reply("Your balances:\n\n" + balanceMessages.join("\n"));
  } catch (error) {
    await ctx.reply(`Error fetching balances: ${error}`);
  }
}

export async function handleSendSupra(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!supraService.hasAccount(userId)) {
    await ctx.reply("Please register an account first!");
    return;
  }

  ctx.session.awaitingRecipient = true;
  await ctx.reply("Please send the recipient's address:");
}

export async function handleSwap(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!supraService.hasAccount(userId)) {
    await ctx.reply("Please register an account first!");
    return;
  }

  const keyboard = new InlineKeyboard();
  WHITELISTED_COINS.forEach((coin) => {
    keyboard.text(`${coin.symbol}`, `swap_from_${coin.symbol}`).row();
  });

  ctx.session.swapState = {
    step: "select_from",
  };

  await ctx.reply("Select the token you want to swap from:", {
    reply_markup: keyboard,
  });
}

export async function handleFaucet(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!supraService.hasAccount(userId)) {
    await ctx.reply("Please register an account first!");
    return;
  }

  const account = supraService.getAccount(userId);
  if (!account) return;

  const times: { [key: string]: number } = {};
  for (const token of WHITELISTED_COINS) {
    try {
      const encodedAddress = encodeURIComponent(token.type);
      const url = `${SUPRA_NODE_URL}rpc/v1/accounts/${account.address}/resources/0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7::faucet::Restricted<${encodedAddress}>`;

      const response = await fetch(url);
      const data: ClaimResponse = await response.json();

      if (data.result[0]?.since) {
        times[token.symbol] = parseInt(data.result[0].since);
      }
    } catch (error) {
      console.error(`Error fetching claim time for ${token.symbol}:`, error);
    }
  }

  ctx.session.lastClaimed = times;

  const keyboard = new InlineKeyboard();
  WHITELISTED_COINS.forEach((coin) => {
    const timeRemaining = getTimeRemaining(
      coin.symbol,
      ctx.session.lastClaimed
    );
    keyboard
      .text(`${coin.symbol} (${timeRemaining})`, `faucet_${coin.symbol}`)
      .row();
  });

  await ctx.reply("Select a token to claim from faucet:", {
    reply_markup: keyboard,
  });
}
