import { Bot, session } from "grammy";
import { InlineKeyboard } from "grammy";
import { BOT_TOKEN } from "./utils/constants";
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
  await ctx.reply("Swap is not implemented yet!");
}

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
