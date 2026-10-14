const s3 = require("../config/s3");

const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// GET BUCKET NAME
const getBucketName = () => {
  const bucketName =
    process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET;

  if (!bucketName) {
    throw new Error(
      "S3 bucket name is missing. Set AWS_BUCKET_NAME or AWS_BUCKET."
    );
  }

  return bucketName;
};

// VALIDATE STORAGE KEY
const validateKey = (key) => {
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("A valid S3 object key is required.");
  }
};

// GENERATE UPLOAD URL
exports.generateUploadUrl = async (key, mimeType) => {
  validateKey(key);

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: mimeType || "application/octet-stream",
  });

  return getSignedUrl(s3, command, {
    expiresIn: 300,
  });
};

// GET OBJECT METADATA
// Returns null if the object does not exist.
// Other S3 errors are allowed to propagate.
exports.getObjectMetadata = async (key) => {
  validateKey(key);

  const command = new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  try {
    const result = await s3.send(command);

    return {
      key,
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
    };
  } catch (error) {
    const statusCode = error.$metadata?.httpStatusCode;

    if (
      statusCode === 404 ||
      error.name === "NotFound" ||
      error.name === "NoSuchKey"
    ) {
      return null;
    }

    throw error;
  }
};

// GENERATE DOWNLOAD URL
exports.generateDownloadUrl = async (key, contentType) => {
  validateKey(key);

  const params = {
    Bucket: getBucketName(),
    Key: key,
    ResponseContentDisposition: "inline",
  };

  if (contentType) {
    params.ResponseContentType = contentType;
  }

  const command = new GetObjectCommand(params);

  return getSignedUrl(s3, command, {
    expiresIn: 3600,
  });
};

// DELETE OBJECT
exports.deleteObject = async (key) => {
  validateKey(key);

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await s3.send(command);
};
