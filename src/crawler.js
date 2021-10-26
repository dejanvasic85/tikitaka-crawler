const chalk = require("chalk");
const puppeteer = require("puppeteer");

const NO_LADDER = "There is no ladder to view for this competition";

module.exports.withBrowserPage = async (fn, errCallback, doneCallback) => {
  const browser = await puppeteer.launch({ headless: true });
  const [page] = await browser.pages();

  try {
    await fn(page);
  } catch (err) {
    if (errCallback) {
      errCallback(err);
    }
  } finally {
    if (doneCallback) {
      doneCallback();
    }
    browser.close();
  }
};

module.exports.crawlLeague = async ({ page, leagueId }) => {
  console.log(chalk.gray(`Crawling league ${leagueId}`));

  const content = await page.content();
  if (content.indexOf(NO_LADDER) > -1) {
    console.log(chalk.bgYellow(`leagueId ${leagueId} does not have a ladder`));
    return null;
  }

  const [headingRow, ...clubRowHandles] = await page.$$(
    ".tableClass > tbody > tr"
  );

  const [leagueName] = await page.$$eval(".blockHeading", (heading) =>
    heading.map((h) => h.innerText.replace("CANCELLED - ", ""))
  );

  let clubs = [];

  for (const clubRowHandle of clubRowHandles) {
    const [clubName] = await clubRowHandle.$$eval(".ladder-team-col", (cell) =>
      cell.map((n) => n.innerText)
    );

    let [clubImg] = await clubRowHandle.$$eval("img", (cell) =>
      cell.map((n) => n.getAttribute("src"))
    );

    if (clubImg && clubImg.startsWith("//")) {
      clubImg = `https:${clubImg}`;
    }

    clubs.push({ clubName, clubImg });
  }

  const league = {
    leagueName,
    clubs,
  };

  console.log(
    chalk.green(`Completed. LeagueName ${leagueName} has ${clubs.length} clubs`)
  );

  return league;
};

module.exports.crawlClubsPage = async ({ page }) => {
  const clubs = await page.$$eval("tr", (rows) => {
    return Array.from(rows, (row) => {
      const [clubName, clubContact] = row.querySelectorAll("td");
      return {
        clubName: clubName.innerText.replace(/(VIC)/gi, ""),
        clubContact: clubContact.innerText,
      };
    });
  });

  return clubs.filter((c) => c.clubName !== "CLUB");
};

module.exports.crawlNplClubsPage = async ({ page }) => {
  const data = await page.$$eval(".logo_links", (el) => {
    return el.map((t) => {
      const [img] = t.querySelectorAll("img");
      const clubImg = img ? `https:${img.getAttribute("src")}` : null;
      return {
        clubName: t.getAttribute("title"),
        clubImg,
      };
    });
  });

  return data.filter((c) => c.clubName.indexOf("NPL") === -1);
};
