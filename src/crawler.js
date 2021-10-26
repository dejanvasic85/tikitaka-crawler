const chalk = require("chalk");

const leagueLadderPage = `https://websites.mygameday.app/comp_info.cgi?c={{id}}&a=LADDER`;
const NO_LADDER = "There is no ladder to view for this competition";

module.exports.crawlLeague = async ({ browser, leagueId }) => {
  console.log(chalk.gray(`Crawling league ${leagueId}`));

  await browser.goto(leagueLadderPage.replace("{{id}}", leagueId));
  const content = await browser.content();

  if (content.indexOf(NO_LADDER) > -1) {
    console.log(chalk.bgYellow(`leagueId ${leagueId} does not have a ladder`));
    return null;
  }

  const [headingRow, ...clubRowHandles] = await browser.$$(
    ".tableClass > tbody > tr"
  );

  const [leagueName] = await browser.$$eval(".blockHeading", (heading) =>
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
