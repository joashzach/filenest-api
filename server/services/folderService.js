
const mongoose = require("mongoose");
const Folder = require("../models/folderModel");
const ApiError = require("../utils/apiError");
const File = require("../models/fileModel");
const User = require("../models/userModel");
const { deleteObject } = require("./storageService");

// Keep internal sharing records out of ordinary folder responses.
function toSafeFolder(folder, extra = {}) {
  const data = folder?.toObject ? folder.toObject() : { ...folder };
  const { sharedWith, ...safeFolder } = data;

  return {
    ...safeFolder,
    ...extra,
  };
}

// Keep storage keys and direct sharing records out of file responses.
function toSafeFile(file, extra = {}) {
  const data = file?.toObject ? file.toObject() : { ...file };
  const { key, sharedWith, ...safeFile } = data;

  return {
    ...safeFile,
    ...extra,
  };
}

function validateObjectId(id, label = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(`Invalid ${label}`, 400);
  }
}

function toIdString(val) {
  if (!val) return null;
  if (val._id) return val._id.toString();
  return val.toString();
}

function getCreatedAt(document) {
  return (
    document.createdAt ||
    new Date(parseInt(document._id.toString().substring(0, 8), 16) * 1000)
  );
}

// CREATE FOLDER SERVICE
exports.createFolderService = async (folderData, userId) => {
  const { name, parent } = folderData;

  if (typeof name !== "string" || !name.trim()) {
    throw new ApiError("Folder name is required", 400);
  }

  let parentFolder = null;
  if (parent) {
    validateObjectId(parent, "parent folder ID");

    parentFolder = await Folder.findById(parent);

    if (!parentFolder) {
      throw new ApiError(
        "Parent folder does not exist",
        404
      );
    }

    const parentPerm = await exports.getEffectiveFolderPermission(parentFolder, userId);
    if (!["owner", "editor"].includes(parentPerm)) {
      throw new ApiError(
        "You do not have permission to create a folder here",
        403
      );
    }
  }

  const folder = await Folder.create({
    name: name.trim(),
    parent: parent || null,
    owner: userId,
  });

  await folder.populate("owner", "name email avatar");

  return toSafeFolder(folder);
};

// CALCULATE TOTAL SIZE OF EACH OWNED FOLDER.
// Counts files and subfolders within owned folders (including files uploaded by editors).
async function calculateFolderSizes(userId) {
  const allFolders = await Folder.find({ owner: userId })
    .select("_id parent")
    .lean();

  const folderIds = allFolders.map((f) => f._id);

  const allFiles = await File.find({
    $or: [{ owner: userId }, { folder: { $in: folderIds } }],
  })
    .select("size folder")
    .lean();

  const childrenMap = new Map();

  for (const folder of allFolders) {
    const parentId = folder.parent ? folder.parent.toString() : "root";

    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }

    childrenMap.get(parentId).push(folder._id.toString());
  }

  const directFilesSize = new Map();

  for (const file of allFiles) {
    if (!file.folder) continue;

    const folderId = file.folder.toString();

    directFilesSize.set(
      folderId,
      (directFilesSize.get(folderId) || 0) + (file.size || 0)
    );
  }

  const memoSize = new Map();
  const visiting = new Set();

  function getFolderTotalSize(folderId) {
    if (memoSize.has(folderId)) {
      return memoSize.get(folderId);
    }

    if (visiting.has(folderId)) {
      throw new ApiError("Invalid folder hierarchy", 400);
    }

    visiting.add(folderId);

    let total = directFilesSize.get(folderId) || 0;
    const children = childrenMap.get(folderId) || [];

    for (const childId of children) {
      total += getFolderTotalSize(childId);
    }

    visiting.delete(folderId);
    memoSize.set(folderId, total);

    return total;
  }

  const folderSizeMap = new Map();

  for (const folder of allFolders) {
    const id = folder._id.toString();
    folderSizeMap.set(id, getFolderTotalSize(id));
  }

  return folderSizeMap;
}

// GET EFFECTIVE FOLDER PERMISSION.
// Returns "owner", "editor", "viewer", or null.
// The nearest matching ancestor share takes precedence.
exports.getEffectiveFolderPermission = async (folder, userId) => {
  if (!folder || !userId) return null;

  const userIdString = userId.toString();
  let currentFolder = folder;
  const visited = new Set();

  while (currentFolder) {
    const currentId = currentFolder._id.toString();

    if (visited.has(currentId)) {
      throw new ApiError("Invalid folder hierarchy", 400);
    }

    visited.add(currentId);

    const folderOwnerId = toIdString(currentFolder.owner);
    if (folderOwnerId && folderOwnerId === userIdString) {
      return "owner";
    }

    const directShare = (currentFolder.sharedWith || []).find(
      (share) => toIdString(share?.user) === userIdString
    );

    if (directShare) {
      return directShare.permission;
    }

    if (!currentFolder.parent) {
      break;
    }

    currentFolder = await Folder.findById(currentFolder.parent);

    if (!currentFolder) {
      break;
    }
  }

  return null;
};

// GET SHARED ACCESS ROOT.
// Finds the main shared folder that granted the user editor access to the given folder.
// Returns the folder doc for the shared root if user is accessing via a shared folder tree,
// or null if the user is the owner of the tree.
exports.getSharedAccessRoot = async (folder, userId) => {
  if (!folder || !userId) return null;

  const userIdString = userId.toString();
  let currentFolder = folder;
  const visited = new Set();
  let candidateShareRoot = null;

  while (currentFolder) {
    const currentId = currentFolder._id.toString();
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const directShare = (currentFolder.sharedWith || []).find(
      (share) => toIdString(share?.user) === userIdString
    );

    if (directShare) {
      candidateShareRoot = currentFolder;
    }

    if (!currentFolder.parent) break;
    currentFolder = await Folder.findById(currentFolder.parent);
  }

  if (candidateShareRoot) {
    const rootOwnerId = toIdString(currentFolder?.owner);
    if (rootOwnerId && rootOwnerId !== userIdString) {
      return candidateShareRoot;
    }
    if (toIdString(candidateShareRoot.owner) !== userIdString) {
      return candidateShareRoot;
    }
  }

  return null;
};

// CHECK IF FOLDER IS WITHIN A GIVEN ROOT FOLDER.
// Returns true if folder is rootFolderId or any descendant of rootFolderId.
exports.isFolderWithinRoot = async (folder, rootFolderId) => {
  if (!folder || !rootFolderId) return false;
  const rootIdStr = rootFolderId.toString();
  let curr = folder;
  const visited = new Set();

  while (curr) {
    const currIdStr = curr._id.toString();
    if (currIdStr === rootIdStr) return true;
    if (visited.has(currIdStr)) break;
    visited.add(currIdStr);

    if (!curr.parent) break;
    curr = await Folder.findById(curr.parent);
  }

  return false;
};

// CHECK FOLDER ACCESS, INCLUDING INHERITED ACCESS.
exports.canAccessFolder = async (folder, userId) => {
  const permission = await exports.getEffectiveFolderPermission(
    folder,
    userId
  );

  if (!permission) {
    throw new ApiError(
      "You do not have permission to view this folder",
      403
    );
  }

  return true;
};

// GET ALL FOLDERS SERVICE.
exports.getFoldersService = async (userId, parent) => {
  let folders;

  if (parent) {
    validateObjectId(parent, "parent folder ID");

    const parentFolder = await Folder.findById(parent);

    if (!parentFolder) {
      throw new ApiError("Folder does not exist!", 404);
    }

    await exports.canAccessFolder(parentFolder, userId);

    folders = await Folder.find({ parent })
      .populate("owner", "name email avatar")
      .lean();
  } else {
    folders = await Folder.find({
      parent: null,
      owner: userId,
    })
      .populate("owner", "name email avatar")
      .lean();
  }

  const folderSizeMap = await calculateFolderSizes(userId);

  return folders.map((folder) =>
    toSafeFolder(folder, {
      createdAt: getCreatedAt(folder),
      size: folderSizeMap.get(folder._id.toString()) || 0,
    })
  );
};

// GET FOLDER CONTENTS SERVICE.
exports.getFolderContentsService = async (folderId, userId) => {
  let folder = null;
  let folders;
  let files;

  if (folderId) {
    validateObjectId(folderId, "folder ID");

    folder = await Folder.findById(folderId)
      .populate("owner", "name email avatar")
      .populate("sharedWith.user", "name email avatar");

    if (!folder) {
      throw new ApiError("Folder does not exist!", 404);
    }

    await exports.canAccessFolder(folder, userId);

    folders = await Folder.find({ parent: folderId })
      .populate("owner", "name email avatar")
      .populate("sharedWith.user", "name email avatar")
      .lean();
    files = await File.find({ folder: folderId })
      .populate("owner", "name email avatar")
      .populate("sharedWith.user", "name email avatar")
      .lean();
  } else {
    folders = await Folder.find({
      parent: null,
      owner: userId,
    })
      .populate("owner", "name email avatar")
      .populate("sharedWith.user", "name email avatar")
      .lean();

    files = await File.find({
      folder: null,
      owner: userId,
    })
      .populate("owner", "name email avatar")
      .populate("sharedWith.user", "name email avatar")
      .lean();
  }

  const extractGrantees = (item) => {
    const validShares = (item?.sharedWith || []).filter((s) => s && s.user);
    return validShares.map((s) => ({
      userId: s.user._id,
      name: s.user.name,
      email: s.user.email,
      avatar: s.user.avatar || null,
      permission: s.permission,
      sharedAt: s.sharedAt || item.updatedAt || item.createdAt,
    }));
  };

  const mergeGrantees = (directGrantees = [], inheritedGrantees = []) => {
    const map = new Map();
    for (const g of inheritedGrantees) {
      if (g?.userId) {
        map.set(g.userId.toString(), { ...g, inherited: true });
      }
    }
    for (const g of directGrantees) {
      if (g?.userId) {
        map.set(g.userId.toString(), { ...g, inherited: false });
      }
    }
    return Array.from(map.values());
  };

  const folderSizeMap = await calculateFolderSizes(userId);

  let folderWithTotalSize = null;
  let effectivePermission = null;
  let parentGrantees = [];
  let mainFolderOwner = null;

  if (folder) {
    const folderObject = folder.toObject();
    parentGrantees = extractGrantees(folderObject);
    effectivePermission = await exports.getEffectiveFolderPermission(folderObject, userId);

    if (folder.owner && (folder.owner.name || folder.owner.email)) {
      mainFolderOwner = {
        _id: folder.owner._id,
        name: folder.owner.name,
        email: folder.owner.email,
        avatar: folder.owner.avatar || null,
      };
    }

    // Walk up ancestors if this is a subfolder, to find the root shared folder owner
    let curr = folder;
    const visited = new Set();
    while (curr && curr.parent) {
      const pid = curr.parent.toString();
      if (visited.has(pid)) break;
      visited.add(pid);
      const parentFolder = await Folder.findById(curr.parent)
        .populate("owner", "name email avatar")
        .populate("sharedWith.user", "name email avatar");
      if (!parentFolder) break;
      if (parentFolder.owner && (parentFolder.owner.name || parentFolder.owner.email)) {
        mainFolderOwner = {
          _id: parentFolder.owner._id,
          name: parentFolder.owner.name,
          email: parentFolder.owner.email,
          avatar: parentFolder.owner.avatar || null,
        };
      }
      curr = parentFolder;
    }

    folderWithTotalSize = toSafeFolder(folderObject, {
      createdAt: getCreatedAt(folderObject),
      size: folderSizeMap.get(folder._id.toString()) || 0,
      myPermission: effectivePermission,
      grantees: parentGrantees,
      granteeCount: parentGrantees.length,
      owner: folder.owner && (folder.owner.name || folder.owner.email)
        ? {
            _id: folder.owner._id,
            name: folder.owner.name,
            email: folder.owner.email,
            avatar: folder.owner.avatar || null,
          }
        : mainFolderOwner,
    });
  }

  // Ensure any unpopulated owner references are looked up from User model
  const unpopulatedOwnerIds = [];
  for (const item of [...folders, ...files]) {
    const oid = item.owner?._id || item.owner;
    if (oid && (!item.owner || (!item.owner.name && !item.owner.email))) {
      unpopulatedOwnerIds.push(oid.toString());
    }
  }
  if (unpopulatedOwnerIds.length > 0) {
    const User = require("../models/userModel");
    const foundUsers = await User.find({ _id: { $in: unpopulatedOwnerIds } })
      .select("name email avatar")
      .lean();
    const userMap = new Map(foundUsers.map((u) => [u._id.toString(), u]));
    for (const item of [...folders, ...files]) {
      const oid = (item.owner?._id || item.owner)?.toString();
      if (oid && userMap.has(oid)) {
        item.owner = userMap.get(oid);
      }
    }
  }

  const processedFolders = folders.map((item) => {
    const isOwner = toIdString(item.owner) === userId.toString();
    const itemGrantees = extractGrantees(item);
    const directShare = (item.sharedWith || []).find(
      (s) => toIdString(s?.user?._id || s?.user) === userId.toString()
    );
    const itemPermission = isOwner
      ? "owner"
      : (directShare?.permission || effectivePermission || null);
    const finalGrantees = mergeGrantees(itemGrantees, parentGrantees);

    let resolvedOwner = null;
    if (item.owner && (item.owner.name || item.owner.email)) {
      resolvedOwner = {
        _id: item.owner._id,
        name: item.owner.name,
        email: item.owner.email,
        avatar: item.owner.avatar || null,
      };
    } else if (item.owner) {
      resolvedOwner = {
        _id: item.owner._id || item.owner,
        name: item.owner.name || null,
        email: item.owner.email || null,
        avatar: item.owner.avatar || null,
      };
    } else if (mainFolderOwner) {
      resolvedOwner = mainFolderOwner;
    }

    return toSafeFolder(item, {
      createdAt: getCreatedAt(item),
      size: folderSizeMap.get(item._id.toString()) || 0,
      myPermission: itemPermission,
      permission: itemPermission,
      inherited: !isOwner && !directShare && Boolean(effectivePermission),
      grantees: finalGrantees,
      granteeCount: finalGrantees.length,
      owner: resolvedOwner,
    });
  });

  const processedFiles = files.map((file) => {
    const isOwner = toIdString(file.owner) === userId.toString();
    const itemGrantees = extractGrantees(file);
    const directShare = (file.sharedWith || []).find(
      (s) => toIdString(s?.user?._id || s?.user) === userId.toString()
    );
    const filePermission = isOwner
      ? "owner"
      : (directShare?.permission || effectivePermission || null);
    const finalGrantees = mergeGrantees(itemGrantees, parentGrantees);

    let resolvedOwner = null;
    if (file.owner && (file.owner.name || file.owner.email)) {
      resolvedOwner = {
        _id: file.owner._id,
        name: file.owner.name,
        email: file.owner.email,
        avatar: file.owner.avatar || null,
      };
    } else if (file.owner) {
      resolvedOwner = {
        _id: file.owner._id || file.owner,
        name: file.owner.name || null,
        email: file.owner.email || null,
        avatar: file.owner.avatar || null,
      };
    } else if (mainFolderOwner) {
      resolvedOwner = mainFolderOwner;
    }

    return toSafeFile(file, {
      myPermission: filePermission,
      permission: filePermission,
      inherited: !isOwner && !directShare && Boolean(effectivePermission),
      grantees: finalGrantees,
      granteeCount: finalGrantees.length,
      owner: resolvedOwner,
    });
  });

  return {
    folder: folderWithTotalSize,
    folders: processedFolders,
    files: processedFiles,
  };
};

// RENAME FOLDER SERVICE.
// Permits owners or editors on shared folders to rename folders.
exports.renameFolderService = async (folderId, name, userId) => {
  validateObjectId(folderId, "folder ID");

  if (typeof name !== "string" || !name.trim()) {
    throw new ApiError("Folder name is required", 400);
  }

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const permission = await exports.getEffectiveFolderPermission(folder, userId);
  if (!["owner", "editor"].includes(permission)) {
    throw new ApiError("You do not have permission to rename this folder!", 403);
  }

  folder.name = name.trim();
  await folder.save();

  return toSafeFolder(folder);
};

// DELETE FOLDER SERVICE.
// Deletes only the current user's folders and files.
exports.deleteFolderService = async (folderId, userId) => {
  validateObjectId(folderId, "folder ID");

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const permission = await exports.getEffectiveFolderPermission(folder, userId);
  if (!["owner", "editor"].includes(permission)) {
    throw new ApiError("You do not have permission to delete this folder!", 403);
  }

  const folderIds = [folder._id];
  const visited = new Set([folder._id.toString()]);
  let currentFolderIds = [folder._id];

  while (currentFolderIds.length > 0) {
    const childFolders = await Folder.find({
      parent: { $in: currentFolderIds },
    }).select("_id");

    const childFolderIds = [];

    for (const child of childFolders) {
      const childId = child._id.toString();

      if (visited.has(childId)) continue;

      visited.add(childId);
      folderIds.push(child._id);
      childFolderIds.push(child._id);
    }

    currentFolderIds = childFolderIds;
  }

  const files = await File.find({
    folder: { $in: folderIds },
  });

  // Delete storage objects before deleting their database records.
  for (const file of files) {
    await deleteObject(file.key);
  }

  await File.deleteMany({
    folder: { $in: folderIds },
  });

  await Folder.deleteMany({
    _id: { $in: folderIds },
  });
};

// MOVE FOLDER SERVICE.
// Permits owners or editors on shared folders to move subfolders.
exports.moveFolderService = async (folderId, targetParentId, userId) => {
  validateObjectId(folderId, "folder ID");

  if (targetParentId) {
    validateObjectId(targetParentId, "target folder ID");

    if (folderId.toString() === targetParentId.toString()) {
      throw new ApiError("Cannot move a folder into itself!", 400);
    }
  }

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const folderPerm = await exports.getEffectiveFolderPermission(folder, userId);
  if (!["owner", "editor"].includes(folderPerm)) {
    throw new ApiError("You do not have permission to move this folder", 403);
  }

  let targetFolder = null;

  if (targetParentId) {
    targetFolder = await Folder.findById(targetParentId);

    if (!targetFolder) {
      throw new ApiError("Target folder does not exist!", 404);
    }

    const targetPerm = await exports.getEffectiveFolderPermission(targetFolder, userId);
    if (!["owner", "editor"].includes(targetPerm)) {
      throw new ApiError("You do not have permission to move into target folder", 403);
    }

    // Check every ancestor to prevent moving a folder into its descendant.
    let current = targetFolder;
    const visited = new Set();

    while (current) {
      const currentId = current._id.toString();

      if (currentId === folder._id.toString()) {
        throw new ApiError(
          "Cannot move a folder into one of its subfolders!",
          400
        );
      }

      if (visited.has(currentId)) {
        throw new ApiError("Invalid folder hierarchy", 400);
      }

      visited.add(currentId);

      if (!current.parent) {
        break;
      }

      current = await Folder.findById(current.parent);
    }
  }

  folder.parent = targetParentId || null;
  await folder.save();

  return toSafeFolder(folder);
};

async function isAuthorizedFolderOwner(folder, userId) {
  const userIdString = userId.toString();
  let current = folder;
  const visited = new Set();
  while (current) {
    const cid = current._id.toString();
    if (visited.has(cid)) break;
    visited.add(cid);
    if (toIdString(current.owner) === userIdString) {
      return true;
    }
    if (!current.parent) break;
    current = await Folder.findById(current.parent);
  }
  return false;
}

// SHARE FOLDER SERVICE.
// Only the owner can change folder sharing.
exports.shareFolderService = async (
  folderId,
  recipientId,
  permission,
  userId
) => {
  validateObjectId(folderId, "folder ID");
  validateObjectId(recipientId, "recipient ID");

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("This folder does not exist!", 404);
  }

  const isOwner = await isAuthorizedFolderOwner(folder, userId);
  if (!isOwner) {
    throw new ApiError("You do not own this folder!", 403);
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    throw new ApiError("The recipient does not exist!", 404);
  }

  if (toIdString(folder.owner) === toIdString(recipientId)) {
    throw new ApiError("You cannot share a folder with its owner!", 400);
  }

  if (!["viewer", "editor"].includes(permission)) {
    throw new ApiError("Invalid permission", 400);
  }

  const existingShare = (folder.sharedWith || []).find(
    (share) => toIdString(share?.user) === toIdString(recipientId)
  );

  if (existingShare) {
    existingShare.permission = permission;
    existingShare.sharedAt = new Date();
  } else {
    folder.sharedWith.push({
      user: recipientId,
      permission,
      sharedAt: new Date(),
    });
  }

  await folder.save();

  // The owner can manage shares, but the response need not expose share records.
  return toSafeFolder(folder);
};

// REMOVE FOLDER SHARE ACCESS.
// Removing an ancestor share may not remove access granted by another share.
exports.removeFolderShareService = async (
  folderId,
  ownerId,
  recipientId
) => {
  validateObjectId(folderId, "folder ID");
  validateObjectId(recipientId, "recipient ID");

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const isOwner = await isAuthorizedFolderOwner(folder, ownerId);
  if (!isOwner) {
    throw new ApiError("You do not own this folder!", 403);
  }

  const existingShare = (folder.sharedWith || []).some(
    (share) => toIdString(share?.user) === toIdString(recipientId)
  );

  if (!existingShare) {
    throw new ApiError(
      "This user does not have direct access to this folder",
      404
    );
  }

  folder.sharedWith = folder.sharedWith.filter(
    (share) => toIdString(share?.user) !== toIdString(recipientId)
  );

  await folder.save();

  return toSafeFolder(folder);
};

// GET FOLDER SHARE GRANTS SERVICE.
// Returns populated share list (name, email, role) for the owner.
exports.getFolderShareGrantsService = async (folderId, userId) => {
  validateObjectId(folderId, "folder ID");

  const folder = await Folder.findById(folderId).populate("sharedWith.user", "name email avatar");

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  const isOwner = await isAuthorizedFolderOwner(folder, userId);
  if (!isOwner) {
    throw new ApiError("You do not own this folder!", 403);
  }

  const grants = (folder.sharedWith || [])
    .filter((s) => s.user)
    .map((s) => ({
      userId: s.user._id,
      name: s.user.name,
      email: s.user.email,
      avatar: s.user.avatar || null,
      role: s.permission,
    }));

  const inheritedGrants = [];
  let currFolderId = folder.parent;
  while (currFolderId) {
    const parentFolder = await Folder.findById(currFolderId).populate(
      "sharedWith.user",
      "name email avatar"
    );
    if (!parentFolder) break;
    for (const s of parentFolder.sharedWith || []) {
      if (s.user) {
        inheritedGrants.push({
          userId: s.user._id,
          name: s.user.name,
          email: s.user.email,
          avatar: s.user.avatar || null,
          role: s.permission,
          source: { id: parentFolder._id, name: parentFolder.name },
        });
      }
    }
    currFolderId = parentFolder.parent;
  }

  return { grants, inheritedGrants, myPermission: "owner" };
};

// LEAVE FOLDER SHARE SERVICE.
// Removes the caller's own direct grant. Checks if an ancestor still grants access.
exports.leaveFolderShareService = async (folderId, userId) => {
  validateObjectId(folderId, "folder ID");

  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new ApiError("Folder does not exist!", 404);
  }

  if (toIdString(folder.owner) === userId.toString()) {
    throw new ApiError("Owners cannot leave their own folder!", 400);
  }

  const hasDirect = (folder.sharedWith || []).some(
    (s) => toIdString(s?.user) === userId.toString()
  );

  if (!hasDirect) {
    throw new ApiError(
      "You do not have a direct share grant on this folder",
      404
    );
  }

  folder.sharedWith = folder.sharedWith.filter(
    (s) => toIdString(s?.user) !== userId.toString()
  );

  await folder.save();

  // Check if an ancestor still grants access
  let throughFolder = null;
  let stillHasAccess = false;

  if (folder.parent) {
    const userIdString = userId.toString();
    let current = await Folder.findById(folder.parent);
    const visited = new Set();

    while (current) {
      const cid = current._id.toString();
      if (visited.has(cid)) break;
      visited.add(cid);

      if (toIdString(current.owner) === userIdString) {
        stillHasAccess = true;
        break;
      }

      const ancestorShare = (current.sharedWith || []).find(
        (s) => toIdString(s?.user) === userIdString
      );
      if (ancestorShare) {
        stillHasAccess = true;
        throughFolder = { id: current._id, name: current.name };
        break;
      }

      if (!current.parent) break;
      current = await Folder.findById(current.parent);
    }
  }

  return { stillHasAccess, throughFolder };
};
