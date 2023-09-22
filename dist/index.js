"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
const cheerio_1 = __importDefault(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const gptQuest = async (messages) => {
    const chatCompletion = await openai.chat.completions.create({
        messages,
        model: "gpt-3.5-turbo-16k",
    });
    return chatCompletion.choices;
};
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.post("/scrape", async (req, res) => {
    const { url } = req.body;
    const response = await axios_1.default.get(url);
    if (response.status === 200) {
        const html = response.data;
        //count the number of characters in the html
        const $ = cheerio_1.default.load(html);
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
            .text()}  \t ${$("h1").first().text()} \n Prices: ${$("[class*='price']").html()} \t ${$("[class*='price']").last().html()} `;
        const lines = elements.split(/[\n]/);
        const datosFiltrados = lines.filter((objeto) => objeto.trim() !== "");
        const messages = [
            {
                role: "user",
                content: `From the following html, provide, product name and price ($) on JSON example { productName: '', price:''}:`,
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
        return responseGPT[0].message.content;
    }
    else {
        console.log("Failed to retrieve the webpage. Status code:", response.status);
    }
});
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
//# sourceMappingURL=index.js.map