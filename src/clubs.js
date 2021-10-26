const { uniqBy } = require("lodash");

module.exports.getClubsUniqByImg = ({ leagues }) => {
  const clubs = leagues.flatMap((l) => l.clubs);
  return uniqBy(clubs, (c) => c.clubImg);
};
