const AWS = require("aws-sdk");
const fs = require("fs");

AWS.config.update({
  region: "ap-southeast-2",
});

const s3 = new AWS.S3();

const uploadToS3 = async ({ fileName }) => {
  const fileStream = fs.createReadStream(fileName);

  const params = {
    ACL: "public-read",
    Bucket: "tikitaka",
    Key: fileName,
    Body: fileStream,
  };

  await s3.putObject(params).promise();
};

module.exports = { uploadToS3 };
