const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
const app = express();
dotenv.config();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("scrape", (req, res) => {
  const { url } = req.body;

  axios
    .get(url)
    .then((response) => {
      if (response.status === 200) {
        const html = response.data;
        const $ = cheerio.load(html);

        // Extract the information you need
        const title = $("title").text().trim();
        const description = $('meta[name="description"]').attr("content");
        const price = $(".product-price").text().trim();
        const mainImageURL = $('meta[property="og:image"]').attr("content");

        const productData = {
          Title: title,
          Description: description,
          Price: price,
          MainImageURL: mainImageURL,
        };

        // Convert the data to JSON
        const productJson = JSON.stringify(productData, null, 2);

        res.send(productJson);
      } else {
        console.log(
          "Failed to retrieve the webpage. Status code:",
          response.status
        );
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      res.send(
        `error, status:${error.response.status}, message:${error.response.message}`
      );
    });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
