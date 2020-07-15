const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const baiduocr = require('./src/ocr/baidu');

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('<a href="/">Arknights Toolbox</a>');
});

app.post('/tagocr/baidu', async (req, res) => {
  const { image } = req.body;
  if (!image) res.json({ code: 403, msg: 'No image' });
  res.json(await baiduocr(image));
});

module.exports = http.createServer(app);
