import express, { Request, Response } from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import cheerio from "cheerio";
import axios from "axios";
import { CreateChatCompletionRequestMessage } from "openai/resources/chat";
import puppeteer from "puppeteer";

const app = express();
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gptQuest = async (messages: CreateChatCompletionRequestMessage[]) => {
  let chatCompletion;
  try {
    chatCompletion = await openai.chat.completions.create({
      messages,
      model: "gpt-3.5-turbo-16k",
    });
  } catch (error) {
    console.log(error);
    throw new Error("Failed to complete chat");
  }

  return chatCompletion.choices;
};

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World! 2");
});

app.post("/scraping/product-old", async (req: Request, res: Response) => {
  console.log(req.body);
  const { url } = req.body;

  if (!url) {
    return res.send("url empty");
  }
  const response = await axios.get(url);

  if (response.status === 200) {
    const html = response.data;
    //count the number of characters in the html

    const $ = cheerio.load(html);

    //remove form
    $("form").remove();
    //remove header
    $("header").remove();
    //remove nav
    $("nav").remove();
    //remove footer
    $("footer").remove();

    // remove all the scripts from the html
    $("script").remove();

    // delete all the comments from the html
    $("*")
      .contents()
      .each(function () {
        if (this.nodeType === 8) {
          $(this).remove();
        }
      });

    //@ts-ignore
    const prices = [];

    $("[class*='price']").each((i, el) => {
      prices.push(`${el.attributes}`);
    });
    //@ts-ignore

    console.log(prices);

    const elements = `Product: ${$("[class*='product']")
      .first()
      //@ts-ignore
      .text()}  \t ${$("h1").first().text()} \n Prices: ${prices} \t ${$(
      "[class*='price']"
    )
      .last()
      .html()} `;

    const lines = elements.split(/[\n]/);
    const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
    const messages: CreateChatCompletionRequestMessage[] = [
      {
        role: "user",
        content: `From the following html, provide, product name and prices ($) on JSON example { productName: string, price:string | string[]}:`,
      },
    ];
    for (let i = 0; i < datosFiltrados.length; i++) {
      const line = datosFiltrados[i];
      //if line is empty, skip
      if (line.length === 0) {
        continue;
      }
      messages.push({
        role: "user",
        content: line,
      });
    }

    console.log(messages);

    let responseGPT;

    try {
      responseGPT = await gptQuest(messages);
    } catch (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    console.log(responseGPT);

    if (JSON.parse(responseGPT[0].message.content as string)) {
      return res.send(JSON.parse(responseGPT[0].message.content as string));
    } else {
      return res.send({ productName: "", price: "" });
    }
  } else {
    console.log(
      "Failed to retrieve the webpage. Status code:",
      response.status
    );
  }
});
app.post("/scraping/desc-old", async (req: Request, res: Response) => {
  const { url } = req.body;
  const response = await axios.get(url);

  if (response.status === 200) {
    const html = response.data;
    //count the number of characters in the html

    const $ = cheerio.load(html);

    //remove input tags
    $("input").remove();
    //remove form
    $("form").remove();
    //remove header
    $("header").remove();
    //remove nav
    $("nav").remove();
    //remove footer
    $("footer").remove();

    // remove all the scripts from the html
    $("script").remove();

    // delete all the comments from the html
    $("*")
      .contents()
      .each(function () {
        if (this.nodeType === 8) {
          $(this).remove();
        }
      });

    const images: string[] = [];
    $("img").each((i, el) => {
      images.push(`${$(el).attr("alt")}: ${$(el).attr("src")} \t`);
    });

    console.log(images);

    const elements = `Product: ${$("[class*='product']")
      .first()
      .text()}  \t ${$(
      "[class*='description']"
    ).html()} \n image: ${images} \n rating: ${$(
      "[class*='rating']"
    ).text()}   `;

    const lines = elements.split(/[\n]/);
    const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
    const messages: CreateChatCompletionRequestMessage[] = [
      {
        role: "user",
        content: `In the following HTML, provide the product description, product image, and the total rating (optional) and average rating (optional) in the JSON example { productDescription: string, ProductImage:string, totalRating:string | null, AverageRating:string | null } only return json:`,
      },
    ];
    for (let i = 0; i < datosFiltrados.length; i++) {
      const line = datosFiltrados[i];
      //if line is empty, skip
      if (line.length === 0) {
        continue;
      }
      messages.push({
        role: "user",
        content: line,
      });
    }

    console.log(messages);

    let responseGPT;

    try {
      responseGPT = await gptQuest(messages);
    } catch (error) {
      console.log(error);
      return res.sendStatus(500);
    }

    console.log(responseGPT);

    if (JSON.parse(responseGPT[0].message.content as string)) {
      return res.send(JSON.parse(responseGPT[0].message.content as string));
    } else {
      return res.send({
        productDescription: "",
        ProductImage: "",
        totalRating: "",
        AverageRating: "",
      });
    }
  } else {
    console.log(
      "Failed to retrieve the webpage. Status code:",
      response.status
    );
  }
});

app.post("/scraping/product", async (req: Request, res: Response) => {
  console.log(req.body);
  const { url } = req.body;

  if (!url) {
    return res.send("url empty");
  }
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();

  //wait for page to load completely

  page.setDefaultNavigationTimeout(0);
  page.waitForNavigation();

  try {
    await page.goto(url);
  } catch (error) {
    console.error("Error navigating to URL:", error);
    await browser.close();
    return res.sendStatus(500);
  }

  const html = await page.content();
  await page.close();
  await browser.close();
  //count the number of characters in the html

  const $ = cheerio.load(html);

  //remove footer
  $("footer").remove();

  // remove all the scripts from the html
  $("script").remove();

  // delete all the comments from the html
  $("*")
    .contents()
    .each(function () {
      if (this.nodeType === 8) {
        $(this).remove();
      }
    });

  //@ts-ignore
  const prices = [];

  $("[class*='price']")
    .get()
    .forEach((el) => {
      prices.push($(el).text());
    });

  console.log($("[class*='a-price']").get());

  $("[class*='a-price']")
    .get()
    .forEach((el) => {
      console.log("el", el);
      prices.push($(el).text());
    });

  //@ts-ignore

  const elements = `Product: ${$("[class*='product']")
    .first()
    //@ts-ignore
    .text()}  \t ${$("h1").first().text()} \n possible-prices: ${prices}} `;

  const lines = elements.split(/[\n]/);
  const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
  const messages: CreateChatCompletionRequestMessage[] = [
    {
      role: "user",
      content: `From the following html, provide, product name and price (only numbers after of $) on JSON example { productName: string, price:string | string[]}:`,
    },
  ];
  for (let i = 0; i < datosFiltrados.length; i++) {
    const line = datosFiltrados[i];
    //if line is empty, skip
    if (line.length === 0) {
      continue;
    }
    messages.push({
      role: "user",
      content: line,
    });
  }

  console.log(messages);

  let responseGPT;

  try {
    responseGPT = await gptQuest(messages);
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
  console.log(responseGPT);

  let responseGPT2;
  try {
    responseGPT2 = JSON.parse(responseGPT[0].message.content as string);
  } catch (error) {
    responseGPT2 = { productName: "", price: "" };
  }

  return res.send(responseGPT2);
});

app.post("/scraping/desc", async (req: Request, res: Response) => {
  console.log(req.body);
  const { url } = req.body;

  if (!url) {
    return res.send("url empty");
  }
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();

  //wait for page to load completely

  page.setDefaultNavigationTimeout(0);
  page.waitForNavigation();

  try {
    await page.goto(url);
  } catch (error) {
    console.error("Error navigating to URL:", error);
    await browser.close();
    return res.sendStatus(500);
  }

  const html = await page.content();
  await page.close();
  await browser.close();
  //count the number of characters in the html

  const $ = cheerio.load(html);

  //remove input tags
  $("input").remove();
  //remove form
  $("form").remove();
  //remove header
  $("header").remove();
  //remove nav
  $("nav").remove();
  //remove footer
  $("footer").remove();

  // remove all the scripts from the html
  $("script").remove();

  // delete all the comments from the html
  $("*")
    .contents()
    .each(function () {
      if (this.nodeType === 8) {
        $(this).remove();
      }
    });

  const images: string[] = [];
  $("img")
    .get()
    .forEach((el) => {
      images.push(`${$(el).attr("alt")}: ${$(el).attr("src")} \t`);
    });

  console.log(images);

  const elements = `Product: ${$("[class*='product']").first().text()}  \t ${$(
    "[class*='description']"
  ).html()} \n image: ${images} \n rating: ${$("[class*='rating']").text()}   `;

  const lines = elements.split(/[\n]/);
  const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
  const messages: CreateChatCompletionRequestMessage[] = [
    {
      role: "user",
      content: `In the following HTML, provide the product description, product images (images limit for array 6 and avoid thumbnail images), and the total rating (optional) and average rating (optional) in the JSON example { productDescription: string, ProductImage:string | string[], totalRating:string | null, AverageRating:string | null } only return json:`,
    },
  ];
  for (let i = 0; i < datosFiltrados.length; i++) {
    const line = datosFiltrados[i];
    //if line is empty, skip
    if (line.length === 0) {
      continue;
    }
    messages.push({
      role: "user",
      content: line,
    });
  }

  console.log(messages);

  let responseGPT;

  try {
    responseGPT = await gptQuest(messages);
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }

  console.log(responseGPT);

  if (JSON.parse(responseGPT[0].message.content as string)) {
    return res.send(JSON.parse(responseGPT[0].message.content as string));
  } else {
    return res.send({
      productDescription: "",
      ProductImage: "",
      totalRating: "",
      AverageRating: "",
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
