const catchAsync = require("../utils/catchAsync");
const {
  createFolderService,
  getFoldersService,
  getFolderContentsService,
  renameFolderService,
  deleteFolderService,
} = require("../services/folderService");

// CREATE FOLDER FUNCTION
exports.createFolder = catchAsync(async (req, res, next) => {
  const { name, parent } = req.body;

  const folder = await createFolderService({ name, parent }, req.user._id);

  res.status(201).json({
    message: "Folder created auccessfully!",
    data: folder,
  });
});

// GET ALL FOLDERS FUNCTION
exports.getFolders = catchAsync(async (req, res) => {
  const { parent } = req.query;

  const folders = await getFoldersService(req.user._id, parent || null);

  res.status(200).json({
    message: "Folders received successfully!",
    data: {
      results: folders.length,
      folders,
    },
  });
});

// GET FOLDER'S CONTENTS FUNCTION
exports.getFolderContents = catchAsync(async (req, res, next) => {
  const { folderId } = req.params;

  const contents = await getFolderContentsService(folderId, req.user._id);

  res.status(200).json({
    message: "Folder contents received successfully!",
    data: contents,
  });
});

// RENAME FOLDER FUNCTION
exports.renameFolder = catchAsync(async (req, res, next) => {
  const { name } = req.body;

  const folder = await renameFolderService(
    req.params.folderId,
    name,
    req.user._id,
  );

  res.status(200).json({
    message: "Folder renamed successfully!",
    data: folder,
  });
});

// DELETE FOLDER FUNCTION
exports.deleteFolder = catchAsync(async (req, res) => {
  await deleteFolderService(req.params.folderId, req.user._id);

  res.status(200).json({
    message: "Folder and its contents deleted successfully!",
  });
});
