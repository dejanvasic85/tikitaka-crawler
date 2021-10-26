const request = require("request");
const xml = require("xml2js");
const fs = require("fs");

module.exports.downloadImage = async ({ uri, filename }) => {
  return new Promise((resolve, reject) => {
    request.head(uri, function (err, res, body) {
      console.log("content-type:", res.headers["content-type"]);
      console.log("content-length:", res.headers["content-length"]);

      request(uri)
        .pipe(fs.createWriteStream(filename))
        .on("close", () => resolve());
    });
  });
};

module.exports.parseXml = async ({ file }) => {
  const fileData = fs.readFileSync(file).toString("utf-8");
  return await xml.parseStringPromise(fileData);
};

module.exports.saveToFile = ({ data, fileName }) => {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(fileName, json);
};
