const s3 = require("../config/s3");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// UPLOAD OBJECT
exports.generateUploadUrl = async (key, mimeType) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300,
  });

  return uploadUrl;
};

// GET OBJECT
exports.generateDownloadUrl = async (key, contentType) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: "inline",
  };

  if (contentType) {
    params.ResponseContentType = contentType;
  }

  const command = new GetObjectCommand(params);

  return await getSignedUrl(s3, command, {
    expiresIn: 300,
  });
};

// DELETE OBJECT
exports.deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });
  await s3.send(command);
};
