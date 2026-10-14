
const catchAsync = require("../utils/catchAsync");

const {
  createFolderService,
  getFoldersService,
  getFolderContentsService,
  renameFolderService,
  deleteFolderService,
  moveFolderService,
  shareFolderService,
  removeFolderShareService,
  getFolderShareGrantsService,
  leaveFolderShareService,
} = require("../services/folderService");

// CREATE FOLDER
exports.createFolder = catchAsync(async (req, res) => {
  const { name, parent } = req.body;

  const folder = await createFolderService(
    { name, parent },
    req.user._id
  );

  res.status(201).json({
    message: "Folder created successfully!",
    data: folder,
  });
});

// GET ALL FOLDERS
exports.getFolders = catchAsync(async (req, res) => {
  const { parent } = req.query;

  const folders = await getFoldersService(
    req.user._id,
    parent || null
  );

  res.status(200).json({
    message: "Folders received successfully!",
    data: {
      results: folders.length,
      folders,
    },
  });
});

// GET FOLDER CONTENTS
exports.getFolderContents = catchAsync(async (req, res) => {
  const { folderId } = req.params;

  const contents = await getFolderContentsService(
    folderId,
    req.user._id
  );

  res.status(200).json({
    message: "Folder contents received successfully!",
    data: contents,
  });
});

// RENAME FOLDER
exports.renameFolder = catchAsync(async (req, res) => {
  const { name } = req.body;

  const folder = await renameFolderService(
    req.params.folderId,
    name,
    req.user._id
  );

  res.status(200).json({
    message: "Folder renamed successfully!",
    data: folder,
  });
});

// DELETE FOLDER
exports.deleteFolder = catchAsync(async (req, res) => {
  await deleteFolderService(req.params.folderId, req.user._id);

  res.status(200).json({
    message: "Folder and its contents deleted successfully!",
  });
});

// MOVE FOLDER
exports.moveFolder = catchAsync(async (req, res) => {
  const { parent } = req.body;

  const folder = await moveFolderService(
    req.params.folderId,
    parent || null,
    req.user._id
  );

  res.status(200).json({
    message: "Folder moved successfully!",
    data: folder,
  });
});

// SHARE FOLDER
exports.shareFolder = catchAsync(async (req, res) => {
  const { userId, permission } = req.body;

  const folder = await shareFolderService(
    req.params.folderId,
    userId,
    permission,
    req.user._id
  );

  res.status(200).json({
    message: "Folder shared successfully!",
    data: folder,
  });
});

// REMOVE FOLDER SHARE
exports.removeFolderShare = catchAsync(async (req, res) => {
  const { folderId, recipientId } = req.params;

  // Consistently use the authenticated user's MongoDB ID.
  const ownerId = req.user._id;

  const folder = await removeFolderShareService(
    folderId,
    ownerId,
    recipientId
  );

  res.status(200).json({
    message: "Folder access removed successfully!",
    data: { folder },
  });
});

// GET FOLDER SHARE GRANTS (owner only — populated grantee list)
exports.getFolderShareGrants = catchAsync(async (req, res) => {
  const result = await getFolderShareGrantsService(
    req.params.folderId,
    req.user._id
  );

  res.status(200).json({
    message: "Folder share grants retrieved successfully!",
    data: result,
  });
});

// LEAVE FOLDER SHARE (grantee removes own direct grant)
exports.leaveFolderShare = catchAsync(async (req, res) => {
  const result = await leaveFolderShareService(
    req.params.folderId,
    req.user._id
  );

  res.status(200).json({
    message: "Left folder share successfully!",
    data: result,
  });
});
