import { Bot, session } from "grammy";
import { InlineKeyboard } from "grammy";
import { BOT_TOKEN, WHITELISTED_COINS } from "./utils/constants";
import { MyContext, SessionData, ClaimResponse } from "./utils/types";
import { supraService } from "./services/Supra";
import { HexString } from "supra-l1-sdk";
import "dotenv/config";
import {
  handleCheckBalance,
  handleFaucet,
  handleRegister,
  handleSendSupra,
  handleSwap,
} from "./handlers/command.handlers";
import { checkCooldown, getTimeRemaining } from "./utils/helpers";

const bot = new Bot<MyContext>(BOT_TOKEN);

bot.use(
  session({
    initial: (): SessionData => ({
      awaitingRecipient: false,
      awaitingAmount: false,
      recipientAddress: "",
      lastClaimed: {},
    }),
  })
);

bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const keyboard = new InlineKeyboard();

  if (!supraService.hasAccount(userId)) {
    keyboard.text("Register New Account", "register");
    await ctx.reply(
      "Welcome to Supra Wallet Bot!\nPlease register an account to get started:",
      {
        reply_markup: keyboard,
      }
    );
    return;
  }

  keyboard
    .text("Register New Account", "register")
    .row()
    .text("Check Balance", "balance")
    .row()
    .text("Send SUPRA", "send")
    .row()
    .text("Swap", "swap")
    .row()
    .text("Faucet", "faucet");

  await ctx.reply(
    "Welcome to Supra Wallet Bot!\nUse /menu anytime to access all features.",
    {
      reply_markup: keyboard,
    }
  );
});

bot.command("menu", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const keyboard = new InlineKeyboard();

  if (!supraService.hasAccount(userId)) {
    keyboard.text("Register New Account", "register");
    await ctx.reply("Please register an account to access all features:", {
      reply_markup: keyboard,
    });
    return;
  }

  keyboard
    .text("Register New Account", "register")
    .row()
    .text("Check Balance", "balance")
    .row()
    .text("Send SUPRA", "send")
    .row()
    .text("Swap", "swap")
    .row()
    .text("Faucet", "faucet");

  await ctx.reply("Select an action from the menu below:", {
    reply_markup: keyboard,
  });
});

bot.command("help", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!supraService.hasAccount(userId)) {
    await ctx.reply(
      "Available commands:\n" +
        "/start - Start the bot\n" +
        "/menu - Show main menu\n" +
        "/help - Show this help message\n\n" +
        "Please register an account first to access other features."
    );
    return;
  }

  await ctx.reply(
    "Available commands:\n" +
      "/start - Start the bot\n" +
      "/menu - Show main menu\n" +
      "/help - Show this help message\n\n" +
      "Use /menu to access all features through an interactive menu."
  );
});

bot.callbackQuery(/^swap_from_(.+)$/, async (ctx) => {
  const fromToken = ctx.match[1];
  ctx.session.swapState = {
    fromToken,
    step: "select_to",
  };

  const keyboard = new InlineKeyboard();
  WHITELISTED_COINS.filter((coin) => coin.symbol !== fromToken).forEach(
    (coin) => {
      keyboard.text(`${coin.symbol}`, `swap_to_${coin.symbol}`).row();
    }
  );

  await ctx.reply("Select the token you want to swap to:", {
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^swap_to_(.+)$/, async (ctx) => {
  const toToken = ctx.match[1];
  ctx.session.swapState = {
    ...ctx.session.swapState,
    toToken,
    step: "enter_amount",
  };

  await ctx.reply(
    `Enter the amount of ${ctx.session.swapState.fromToken} you want to swap:`
  );
  await ctx.answerCallbackQuery();
});

bot.on("message:text", async (ctx) => {
  if (ctx.session.awaitingRecipient) {
    ctx.session.recipientAddress = ctx.message.text;
    ctx.session.awaitingRecipient = false;
    ctx.session.awaitingAmount = true;
    await ctx.reply("Please enter the amount of SUPRA to send:");
    return;
  }

  if (ctx.session.awaitingAmount) {
    const amount = parseFloat(ctx.message.text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("Please enter a valid positive number!");
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const tx = await supraService.transferSupraCoin(
        userId,
        new HexString(ctx.session.recipientAddress!),
        amount
      );
      await ctx.reply(
        `Transaction sent successfully!\nTransaction hash: ${tx.txHash}`
      );
    } catch (error) {
      await ctx.reply(`Error sending SUPRA: ${error}`);
    }

    ctx.session.awaitingAmount = false;
    ctx.session.recipientAddress = "";
    return;
  } else if (ctx.session.swapState?.step === "enter_amount") {
    const amount = parseFloat(ctx.message.text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("Please enter a valid positive number!");
      return;
    }

    const { fromToken, toToken } = ctx.session.swapState;

    await ctx.reply(
      `Swap Request Logged:\n` +
        `From: ${amount} ${fromToken}\n` +
        `To: ${toToken}\n`
    );

    const fromTokenType = WHITELISTED_COINS.find(
      (coin) => coin.symbol === fromToken
    )?.type;

    if (!fromTokenType) {
      await ctx.reply("Invalid token selected");
      return;
    }

    const accountBalance = await supraService.getCoinBalance(
      supraService.userAccounts.get(ctx.from?.id)?.address!,
      fromTokenType
    );

    if (accountBalance < amount) {
      await ctx.reply("Insufficient balance");
      return;
    }

    const swapRequest = await fetch(
      "https://swap-backend-prod-340342993997.asia-south2.run.app/api/swap",
      {
        method: "POST",
        body: JSON.stringify({
          inputToken: WHITELISTED_COINS.find(
            (coin) => coin.symbol === fromToken
          )?.type,
          outputToken: WHITELISTED_COINS.find((coin) => coin.symbol === toToken)
            ?.type,
          amountIn: amount,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const swapResponse = await swapRequest.json();

    console.log(swapResponse);
    console.log(swapResponse.data.txnData.typeArguments);
    console.log(swapResponse.data.txnData.arguments);

    const tx = await supraService.sendTransaction({
      userId: ctx.from?.id,
      moduleAddr:
        "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7",
      moduleName: "entry",
      functionName: "swap_exact_in_multihop",
      functionTypeArgs: swapResponse.data.txnData.typeArguments,
      functionArgs: swapResponse.data.txnData.arguments,
    });

    await ctx.reply(
      `Swap transaction sent successfully!\nTransaction hash: ${tx.txHash}`
    );

    ctx.session.swapState = {
      step: null,
    };
  }
});

bot.callbackQuery("register", async (ctx) => {
  await handleRegister(ctx);

  const keyboard = new InlineKeyboard()
    .text("Check Balance", "balance")
    .row()
    .text("Send SUPRA", "send")
    .row()
    .text("Swap", "swap")
    .row()
    .text("Faucet", "faucet");

  await ctx.reply("Your account is ready! Here's what you can do:", {
    reply_markup: keyboard,
  });

  await ctx.answerCallbackQuery();
});

bot.callbackQuery("balance", async (ctx) => {
  await handleCheckBalance(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("send", async (ctx) => {
  await handleSendSupra(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("swap", async (ctx) => {
  await handleSwap(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("faucet", async (ctx) => {
  await handleFaucet(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^faucet_(.+)$/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const tokenSymbol = ctx.match[1];
  const selectedToken = WHITELISTED_COINS.find(
    (coin) => coin.symbol === tokenSymbol
  );

  if (!selectedToken) {
    await ctx.reply("Invalid token selected");
    await ctx.answerCallbackQuery();
    return;
  }

  if (!checkCooldown(tokenSymbol, ctx.session.lastClaimed)) {
    const timeRemaining = getTimeRemaining(
      tokenSymbol,
      ctx.session.lastClaimed
    );
    await ctx.reply(
      `Please wait ${timeRemaining} before claiming ${tokenSymbol} again`
    );
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const tx = await supraService.sendTransaction({
      userId,
      moduleAddr:
        "0x8ede5b689d5ac487c3ee48ceabe28ae061be74071c86ffe523b7f42acda2fcb7",
      moduleName: "faucet",
      functionName: "request",
      functionTypeArgs: [selectedToken.type],
      functionArgs: [],
    });

    ctx.session.lastClaimed[tokenSymbol] = Math.floor(Date.now() / 1000);
    await ctx.reply(
      `Faucet claim transaction sent successfully!\nTransaction hash: ${tx.txHash}`
    );
  } catch (error) {
    await ctx.reply(`Error claiming from faucet: ${error}`);
  }

  await ctx.answerCallbackQuery();
});

async function startBot() {
  try {
    console.log("Registering bot commands...");
    await bot.api.setMyCommands([
      { command: "start", description: "Start the bot" },
      { command: "menu", description: "Show main menu" },
      { command: "help", description: "Show help message" },
    ]);
    console.log("Bot commands registered successfully");

    console.log("Starting bot...");
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started successfully`);
      },
    });
  } catch (error) {
    console.error("Error starting bot:", error);
    throw error;
  }
}

startBot().catch((error) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
