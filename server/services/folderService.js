const Folder = require("../models/folderModel");
const ApiError = require("../utils/apiError");
const File = require("../models/fileModel");
const { deleteObject } = require("./storageService");

// CREATE FOLDER SERVICE
exports.createFolderService = async (folderData, userId) => {
  const { name, parent } = folderData;

  if (parent) {
    const parentFolder = await Folder.findOne({
      _id: parent,
      owner: userId,
    });

    if (!parentFolder) {
      throw new ApiError("Parent folder does not exist!", 404);
    }
  }

  const folder = await Folder.create({
    name,
    parent: parent || null,
    owner: userId,
  });

  return folder;
};

// Calculate total size of each folder (including all nested subfolders and files)
async function calculateFolderSizes(userId) {
  const allFolders = await Folder.find({ owner: userId }).select("_id parent").lean();
  const allFiles = await File.find({ owner: userId }).select("size folder").lean();

  // Map of parent folder id -> child folder ids
  const childrenMap = new Map();
  for (const f of allFolders) {
    const pId = f.parent ? f.parent.toString() : "root";
    if (!childrenMap.has(pId)) childrenMap.set(pId, []);
    childrenMap.get(pId).push(f._id.toString());
  }

  // Map of folder id -> sum of direct files' sizes
  const directFilesSize = new Map();
  for (const file of allFiles) {
    if (file.folder) {
      const fId = file.folder.toString();
      directFilesSize.set(fId, (directFilesSize.get(fId) || 0) + (file.size || 0));
    }
  }

  // Recursive calculation with memoization
  const memoSize = new Map();
  function getFolderTotalSize(fIdStr) {
    if (memoSize.has(fIdStr)) return memoSize.get(fIdStr);
    let total = directFilesSize.get(fIdStr) || 0;
    const children = childrenMap.get(fIdStr) || [];
    for (const childId of children) {
      total += getFolderTotalSize(childId);
    }
    memoSize.set(fIdStr, total);
    return total;
  }

  const folderSizeMap = new Map();
  for (const f of allFolders) {
    const idStr = f._id.toString();
    folderSizeMap.set(idStr, getFolderTotalSize(idStr));
  }

  return folderSizeMap;
}

// GET ALL FOLDERS SERVICE
exports.getFoldersService = async (userId, parent) => {
  const folders = await Folder.find({
    owner: userId,
    parent: parent || null,
  }).lean();

  const folderSizeMap = await calculateFolderSizes(userId);
  const foldersWithSizes = folders.map((f) => ({
    ...f,
    size: folderSizeMap.get(f._id.toString()) || 0,
  }));

  return foldersWithSizes;
};

// GET FOLDER'S CONTENTS SERVICE
exports.getFolderContentsService = async (folderId, userId) => {
  let folder = null;

  if (folderId) {
    folder = await Folder.findOne({
      _id: folderId,
      owner: userId,
    }).lean();

    if (!folder) {
      throw new ApiError("Folder does not exist!", 404);
    }
  }

  const folders = await Folder.find({
    owner: userId,
    parent: folderId || null,
  }).lean();

  const files = await File.find({
    owner: userId,
    folder: folderId || null,
  });

  const folderSizeMap = await calculateFolderSizes(userId);

  const foldersWithSizes = folders.map((f) => ({
    ...f,
    size: folderSizeMap.get(f._id.toString()) || 0,
  }));

  let folderWithTotalSize = null;
  if (folder) {
    folderWithTotalSize = {
      ...folder,
      size: folderSizeMap.get(folder._id.toString()) || 0,
    };
  }

  return {
    folder: folderWithTotalSize,
    folders: foldersWithSizes,
    files,
  };
};

// RENAME FOLDER SERVICE
exports.renameFolderService = async (folderId, name, userId) => {
  const folder = await Folder.findOne({
    _id: folderId,
    owner: userId,
  });
  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  folder.name = name;

  await folder.save();

  return folder;
};

// DELETE FOLDER SERVICE
exports.deleteFolderService = async (folderId, userId) => {
  const folder = await Folder.findOne({
    _id: folderId,
    owner: userId,
  });

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const folderIds = [folder._id];

  let currentFolderIds = [folder._id];

  while (currentFolderIds.length > 0) {
    const childFolders = await Folder.find({
      owner: userId,
      parent: { $in: currentFolderIds },
    }).select("_id");

    const childFolderIds = childFolders.map((folder) => folder._id);

    folderIds.push(...childFolderIds);

    currentFolderIds = childFolderIds;
  }

  const files = await File.find({
    owner: userId,
    folder: { $in: folderIds },
  });

  for (const file of files) {
    await deleteObject(file.key);
  }

  await File.deleteMany({
    owner: userId,
    folder: { $in: folderIds },
  });

  await Folder.deleteMany({
    owner: userId,
    _id: { $in: folderIds },
  });
};
