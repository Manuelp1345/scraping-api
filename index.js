const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const tiktoken = require("tiktoken");
const app = express();
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gptQuest = async (messages) => {
  const chatCompletion = await openai.chat.completions.create({
    messages,
    model: "gpt-3.5-turbo-16k",
  });
  return chatCompletion.choices;
};

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/scrape", async (req, res) => {
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

    const elements = `Product: ${$("[class*='product']")
      .first()
      .text()}  \t ${$("h1").first().text()} \n Prices: ${$(
      "[class*='price']"
    ).html()} \t ${$("[class*='price']").last().html()} `;

    const lines = elements.split(/[\n]/);
    const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
    const messages = [
      {
        role: "user",
        content: `From the following html, provide, product name and price ($) on JSON:`,
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

    const responseGPT = await gptQuest(messages);
    // return res.send(messages);

    return res.send(responseGPT[0].message.content);
  } else {
    console.log(
      "Failed to retrieve the webpage. Status code:",
      response.status
    );
  }
});

app.post("/quest-gpt", async (req, res) => {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: "user",
        content:
          "Please scrape the following website, give me product images, price and product name and description: https://www.nike.com/us/es/t/calzado-de-entrenamiento-legend-essential-2-b2RV7x/CQ9356-403 ",
      },
    ],
    model: "gpt-4",
  });

  console.log(chatCompletion.choices[0].message);
  res.send(chatCompletion.choices[0].message);
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
