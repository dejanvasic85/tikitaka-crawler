const chalk = require("chalk");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");

const { crawlLeague } = require("./src/crawler");
const { parseXml, saveToFile } = require("./src/files");
const { sleep } = require("./src/sleep");
const { uploadToS3 } = require("./src/s3");

dotenv.config();

const mapLeagues = ({ data }) =>
  data.select.option.map(({ $: { value } }) => value);

const main = async () => {
  const startTime = Date.now();
  const browser = await puppeteer.launch({ headless: false });

  try {
    const [browserPage] = await browser.pages();

    const xmlData = await parseXml({ file: "./data/ffv.html" });
    const leagueIds = mapLeagues({ data: xmlData });

    const leagues = [];

    for (const leagueId of leagueIds) {
      const league = await crawlLeague({
        browser: browserPage,
        leagueId,
      });

      if (league) {
        leagues.push(league);
      }

      await sleep({ ms: 400 });
    }

    console.log(chalk.bgGreen("Crawler completed saving to file"));
    saveToFile({ data: leagues, fileName: "./data/leagues.json" });
  } catch (err) {
    console.error(chalk.red(err));
  } finally {
    const taken = Date.now() - startTime;
    const takenMoments = moment.duration(taken);
    console.log(chalk.blue(`Time taken: ${takenMoments.humanize()}`));
    browser.close();
  }
};

main();
