const chalk = require("chalk");
const dotenv = require("dotenv");
const fs = require("fs");
const { partition, unionBy } = require("lodash");

const {
  crawlLeague,
  crawlClubsPage,
  crawlNplClubsPage,
  withBrowserPage,
} = require("./src/crawler");
const {
  parseXml,
  readFromFile,
  saveToFile,
  downloadImage,
} = require("./src/files");
const { sleep } = require("./src/sleep");
const { uploadToS3 } = require("./src/s3");
const { getClubsUniqByImg } = require("./src/clubs");

dotenv.config();

const urls = {
  clubListingPage: "https://www.footballvictoria.com.au/club-contacts",
  clubNplPage: "https://websites.mygameday.app/assoc_page.cgi?c=0-10178-0-0-0",
  leagueLadderPage: `https://websites.mygameday.app/comp_info.cgi?c={{id}}&a=LADDER`,
};

const mapLeagues = ({ data }) =>
  data.select.option.map(({ $: { value } }) => value);

// 1
const downloadClubs = async () => {
  await withBrowserPage(async (page) => {
    await page.goto(urls.clubListingPage);
    const clubs = await crawlClubsPage({ page });

    saveToFile({ data: clubs, fileName: "./data/clubs.json" });
  });
};

// 2 (long process)
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

// 3
const transformLeagueClubsToClubWithImages = async () => {
  await withBrowserPage(async (page) => {
    const leagues = readFromFile({ fileName: "./data/leagues.json" });
    const clubs = getClubsUniqByImg({ leagues });

    await page.goto(urls.clubNplPage);
    const nplClubs = await crawlNplClubsPage({ page });

    const merged = unionBy(nplClubs, clubs, "clubName");

    saveToFile({ data: merged, fileName: "./data/clubImages.json" });
  });
};

// 4
const transformClubsToClubsAndImages = () => {
  const clubImages = readFromFile({ fileName: "./data/clubImages.json" });
  const clubs = readFromFile({ fileName: "./data/clubs.json" });

  const result = clubs.map(({ clubName, clubContact }) => {
    const clubImgData = clubImages.find(
      (c) =>
        c.clubName.indexOf(clubName) > -1 || clubName.indexOf(c.clubName) > -1
    );

    const targetImgName = clubImgData
      ? `${clubName.replace(/ /gi, "-").toLowerCase().trim()}.jpg`
      : null;

    return {
      clubName,
      clubContact: clubContact ?? null,
      targetImgName,
      sourceImg: clubImgData?.clubImg ?? null,
    };
  });

  const [clubsWithImages, clubsWithoutImgs] = partition(
    result,
    (c) => c.sourceImg !== null
  );

  console.log(
    chalk.bgGreen(`Clubs with images [${clubsWithImages.length}]`),
    chalk.bgYellow(`Clubs without images [${clubsWithoutImgs.length}]`)
  );

  saveToFile({
    data: [...clubsWithImages, ...clubsWithoutImgs],
    fileName: "./data/clubsAndImages.json",
  });
};

// 5
const uploadClubImagesToS3 = async () => {
  const clubsWithImages = readFromFile({
    fileName: "./data/clubsAndImages.json",
  });

  for (const club of clubsWithImages) {
    if (!club.sourceImg) {
      continue;
    }

    await downloadImage({
      uri: club.sourceImg,
      filename: `./img/${club.targetImgName}`,
    });

    await uploadToS3({
      originalFile: `./img/${club.targetImgName}`,
      targetFileName: club.targetImgName,
    });

    console.log(chalk.green(`File ${club.targetFile} upload completed`));
  }

  console.log(chalk.bgGreen("Completed"));
};

uploadClubImagesToS3();
