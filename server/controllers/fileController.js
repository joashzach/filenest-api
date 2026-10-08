const catchAsync = require("../utils/catchAsync");
const {
  generateUploadUrlService,
  confirmUploadService,
  generateDownloadUrlService,
  getAllFilesService,
  getFileService,
  deleteFileService,
  moveFileService,
  renameFileService
} = require("../services/fileService");

// GENERATE UPLOAD URL
exports.generateUploadUrl = catchAsync(async (req, res) => {
  const { originalName, mimeType } = req.body;

  const result = await generateUploadUrlService(
    { originalName, mimeType },
    req.user._id,
  );

  res.status(201).json({
    message: "Upload URL generated successfully!",
    data: result,
  });
});

// SEND METADATA TO MONGODB
exports.confirmUpload = catchAsync(async (req, res, next) => {
  const { originalName, mimeType, size, key, folder } = req.body;

  const file = await confirmUploadService(
    { originalName, mimeType, size, key, folder },
    req.user._id,
  );

  res.status(201).json({
    message: "File upload confirmed successfully!",
    data: file,
  });
});

// GENERATE DOWNLOAD URL
exports.generateDownloadUrl = catchAsync(async (req, res, next) => {
  const result = await generateDownloadUrlService(req.params.id, req.user._id);

  res.status(200).json({
    message: "Download URL generated successfully!",
    data: {
      result,
    },
  });
});

// GET ALL FILES
exports.getAllFiles = catchAsync(async (req, res, next) => {
  const files = await getAllFilesService(req.user._id);
  if (files.length === 0) {
    return res.status(200).json({
      message: "You do not have any files!",
      data: {
        results: 0,
        files: [],
      },
    });
  }
  res.status(200).json({
    message: "Received all files successfully!",
    data: {
      results: files.length,
      files,
    },
  });
});

// GET REQUESTED FILE
exports.getFile = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user._id;
  const file = await getFileService(id, user);

  res.status(200).json({
    message: "Received file successfully!",
    file,
  });
});

// DELETE REQUESTED FILE
exports.deleteFile = catchAsync(async (req, res, next) => {
  await deleteFileService(req.params.id, req.user._id);

  res.status(200).json({
    message: "File deleted successfully!",
  });
});

// MOVE FILE (FOLDER)
exports.moveFile = catchAsync(async (req, res) => {
  const { folder } = req.body;

  const file = await moveFileService(req.params.id, folder, req.user._id);

  res.status(200).json({
    message: "File moved successfully!",
    data: file,
  });
});

// RENAME FILE
exports.renameFile = catchAsync(async (req, res) => {
  const { name } = req.body;
  const file = await renameFileService(req.params.id, name, req.user._id);

  res.status(200).json({
    message: "File renamed successfully!",
    data: file,
  });
});
