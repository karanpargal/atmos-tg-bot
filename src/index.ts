import { Bot, session } from "grammy";
import { InlineKeyboard } from "grammy";
import { BOT_TOKEN, WHITELISTED_COINS } from "./utils/constants";
import { MyContext, SessionData } from "./utils/types";
import { supraService } from "./services/Supra";
import { HexString } from "supra-l1-sdk";
import "dotenv/config";

const bot = new Bot<MyContext>(BOT_TOKEN);

bot.use(
  session({
    initial: (): SessionData => ({
      awaitingRecipient: false,
      awaitingAmount: false,
      recipientAddress: "",
    }),
  })
);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("Register New Account", "register")
    .row()
    .text("Check Balance", "balance")
    .row()
    .text("Send SUPRA", "send")
    .row()
    .text("Swap", "swap");

  await ctx.reply("Welcome to Supra Wallet Bot!\nWhat would you like to do?", {
    reply_markup: keyboard,
  });
});

async function handleRegister(ctx: MyContext) {
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

async function handleCheckBalance(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const account = supraService.getAccount(userId);
  if (!account) {
    await ctx.reply("Please register an account first!");
    return;
  }

  try {
    const { balance, symbol, name } = await supraService.getBalance(
      account.address
    );
    await ctx.reply(`Your balance: ${balance} ${symbol} (${name})`);
  } catch (error) {
    await ctx.reply(`Error fetching balance: ${error}`);
  }
}

async function handleSendSupra(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!supraService.hasAccount(userId)) {
    await ctx.reply("Please register an account first!");
    return;
  }

  ctx.session.awaitingRecipient = true;
  await ctx.reply("Please send the recipient's address:");
}

async function handleSwap(ctx: MyContext) {
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

bot.start();
