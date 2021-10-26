const chalk = require("chalk");
const dotenv = require("dotenv");
const fs = require("fs");
const { partition } = require("lodash");

const { crawlLeague, crawlClubsPage } = require("./src/crawler");
const { parseXml, readFromFile, saveToFile } = require("./src/files");
const { sleep } = require("./src/sleep");
const { uploadToS3 } = require("./src/s3");
const { getClubsUniqByImg } = require("./src/clubs");

dotenv.config();

const urls = {
  clubListingPage: "https://www.footballvictoria.com.au/club-contacts",
  leagueLadderPage: `https://websites.mygameday.app/comp_info.cgi?c={{id}}&a=LADDER`,
};

const mapLeagues = ({ data }) =>
  data.select.option.map(({ $: { value } }) => value);

const transformLeagueClubsToClubWithImages = () => {
  const leagues = readFromFile({ fileName: "./data/leagues.json" });
  const clubs = getClubsUniqByImg({ leagues });
  saveToFile({ data: clubs, fileName: "./data/clubImages.json" });
};

const transformClubsToClubsWithImages = () => {
  const clubImages = readFromFile({ fileName: "./data/clubImages.json" });
  const clubs = readFromFile({ fileName: "./data/clubs.json" });

  const result = clubs.map(({ clubName, clubContact }) => {
    const clubImgData = clubImages.find(
      (c) => c.clubName.indexOf(clubName) > -1
    );

    const targetImgName = clubImgData
      ? `${clubName.replace(/ /gi, "-").toLowerCase().trim()}.jpg`
      : null;

    return {
      clubName,
      clubContact,
      targetImgName,
      sourceImg: clubImgData?.clubImg ?? null,
    };
  });

  const [clubsWithImages, clubsWithoutImgs] = partition(
    result,
    (c) => c.sourceImg !== null
  );

  saveToFile({
    data: [...clubsWithImages, ...clubsWithoutImgs],
    fileName: "./data/clubsWithImages.json",
  });
};

/**
 * Runs the crawler on all the league ladders
 */
const downloadLeagues = async () => {
  const startTime = Date.now();
  withBrowserPage(
    async (page) => {
      const xmlData = await parseXml({ file: "./data/ffv.html" });
      const leagueIds = mapLeagues({ data: xmlData });

      const leagues = [];

      for (const leagueId of leagueIds) {
        await page.goto(urls.leagueLadderPage.replace("{{id}}", leagueId));
        const league = await crawlLeague({
          page,
          leagueId,
        });

        if (league) {
          leagues.push(league);
        }

        await sleep({ ms: 400 });
      }

      console.log(chalk.bgGreen("Crawler completed saving to file"));
      saveToFile({ data: leagues, fileName: "./data/leagues.json" });
    },
    null,
    () => {
      const taken = Date.now() - startTime;
      const takenMoments = moment.duration(taken);
      console.log(chalk.blue(`Time taken: ${takenMoments.humanize()}`));
      browser.close();
    }
  );
};

const downloadClubFromListing = async () => {
  await withBrowserPage(async (page) => {
    await page.goto(urls.clubListingPage);
    const clubs = await crawlClubsPage({ page });
    saveToFile({ data: clubs, fileName: "./data/clubs.json" });
  });
};

transformClubsToClubsWithImages();
