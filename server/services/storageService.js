const s3 = require("../config/s3");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Helper to resolve bucket name across variable naming conventions
const getBucketName = () => process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET;

// UPLOAD OBJECT
exports.generateUploadUrl = async (key, mimeType) => {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: mimeType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300,
  });

  return uploadUrl;
};

// GET OBJECT
exports.generateDownloadUrl = async (key, contentType) => {
  const params = {
    Bucket: getBucketName(),
    Key: key,
    ResponseContentDisposition: "inline",
  };

  if (contentType) {
    params.ResponseContentType = contentType;
  }

  const command = new GetObjectCommand(params);

  return await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });
};

// DELETE OBJECT
exports.deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  await s3.send(command);
};
