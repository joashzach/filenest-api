
const catchAsync = require("../utils/catchAsync");

const {
  generateUploadUrlService,
  confirmUploadService,
  generateDownloadUrlService,
  getAllFilesService,
  getFileService,
  deleteFileService,
  moveFileService,
  renameFileService,
  shareFileService,
  removeFileShareService,
  sharedWithMeService,
  getFileShareGrantsService,
  leaveFileShareService,
  sharedByMeService,
} = require("../services/fileService");

// GENERATE UPLOAD URL
exports.generateUploadUrl = catchAsync(async (req, res) => {
  const { originalName, mimeType } = req.body;

  const result = await generateUploadUrlService(
    { originalName, mimeType },
    req.user._id
  );

  res.status(201).json({
    message: "Upload URL generated successfully!",
    data: result,
  });
});

// CONFIRM UPLOAD
exports.confirmUpload = catchAsync(async (req, res) => {
  const { originalName, mimeType, size, key, folder } = req.body;

  const file = await confirmUploadService(
    { originalName, mimeType, size, key, folder },
    req.user._id
  );

  res.status(201).json({
    message: "File upload confirmed successfully!",
    data: file,
  });
});

// GENERATE DOWNLOAD URL
exports.generateDownloadUrl = catchAsync(async (req, res) => {
  const result = await generateDownloadUrlService(
    req.params.id,
    req.user._id
  );

  res.status(200).json({
    message: "Download URL generated successfully!",
    data: { result },
  });
});

// GET ALL OWNED FILES
exports.getAllFiles = catchAsync(async (req, res) => {
  const files = await getAllFilesService(req.user._id);

  res.status(200).json({
    message: files.length
      ? "Received all files successfully!"
      : "You do not have any files!",
    data: {
      results: files.length,
      files,
    },
  });
});

// GET A FILE
exports.getFile = catchAsync(async (req, res) => {
  const file = await getFileService(
    req.params.id,
    req.user._id
  );

  res.status(200).json({
    message: "Received file successfully!",
    file,
  });
});

// DELETE FILE
exports.deleteFile = catchAsync(async (req, res) => {
  await deleteFileService(req.params.id, req.user._id);

  res.status(200).json({
    message: "File deleted successfully!",
  });
});

// MOVE FILE
exports.moveFile = catchAsync(async (req, res) => {
  const { folder } = req.body;

  const file = await moveFileService(
    req.params.id,
    folder || null,
    req.user._id
  );

  res.status(200).json({
    message: "File moved successfully!",
    data: file,
  });
});

// RENAME FILE
exports.renameFile = catchAsync(async (req, res) => {
  const { name } = req.body;

  const file = await renameFileService(
    req.params.id,
    name,
    req.user._id
  );

  res.status(200).json({
    message: "File renamed successfully!",
    data: file,
  });
});

// SHARE FILE
exports.shareFile = catchAsync(async (req, res) => {
  const { userId, permission } = req.body;

  const file = await shareFileService(
    req.params.fileId,
    req.user._id,
    userId,
    permission
  );

  res.status(200).json({
    message: "File shared successfully!",
    data: file,
  });
});

// REMOVE FILE SHARE
exports.removeFileShare = catchAsync(async (req, res) => {
  const { fileId, userId } = req.params;

  const file = await removeFileShareService(
    fileId,
    req.user._id,
    userId
  );

  res.status(200).json({
    message: "File access revoked successfully!",
    data: file,
  });
});

// SHARED WITH ME
exports.sharedWithMe = catchAsync(async (req, res) => {
  const result = await sharedWithMeService(req.user._id);

  res.status(200).json({
    message: "Shared files and folders received successfully!",
    data: {
      results: result.files.length + result.folders.length,
      files: result.files,
      folders: result.folders,
    },
  });
});

// GET FILE SHARE GRANTS (owner only — returns grantees with name/email)
exports.getFileShareGrants = catchAsync(async (req, res) => {
  const result = await getFileShareGrantsService(
    req.params.fileId,
    req.user._id
  );

  res.status(200).json({
    message: "File share grants retrieved successfully!",
    data: result,
  });
});

// LEAVE FILE SHARE (grantee removes own direct grant)
exports.leaveFileShare = catchAsync(async (req, res) => {
  const result = await leaveFileShareService(
    req.params.fileId,
    req.user._id
  );

  res.status(200).json({
    message: "Left file share successfully!",
    data: result,
  });
});

// SHARED BY ME (owned items with active share grants)
exports.sharedByMe = catchAsync(async (req, res) => {
  const result = await sharedByMeService(req.user._id);

  res.status(200).json({
    message: "Shared by me retrieved successfully!",
    data: result,
  });
});
