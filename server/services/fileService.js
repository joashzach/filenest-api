
const crypto = require("crypto");
const mongoose = require("mongoose");

const File = require("../models/fileModel");
const User = require("../models/userModel");
const Folder = require("../models/folderModel");
const ApiError = require("../utils/apiError");
const folderService = require("./folderService");

const {
  generateUploadUrl,
  generateDownloadUrl,
  getObjectMetadata,
  deleteObject,
} = require("./storageService");

const UPLOAD_KEY_MAX_AGE_MS = 15 * 60 * 1000;
const FUTURE_TIMESTAMP_TOLERANCE_MS = 60 * 1000;

// UPLOAD KEY SIGNING SECRET
function getUploadKeySecret() {
  const secret =
    process.env.UPLOAD_KEY_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "Set UPLOAD_KEY_SECRET or JWT_SECRET in the backend environment."
    );
  }

  return secret;
}

// VALIDATE MONGODB IDS
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

// CREATE A SIGNED STORAGE KEY
function createUploadKey(userId, mimeType) {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const payload = `${userId}:${timestamp}:${nonce}:${mimeType}`;

  const signature = crypto
    .createHmac("sha256", getUploadKeySecret())
    .update(payload)
    .digest("hex");

  return `users/${userId}/${timestamp}-${nonce}-${signature}`;
}

// VERIFY THAT THE KEY WAS GENERATED FOR THIS USER AND MIME TYPE
function verifyUploadKey(key, userId, mimeType) {
  if (typeof key !== "string") return false;

  const match = key.match(
    /^users\/([^/]+)\/(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([a-f0-9]{64})$/i
  );

  if (!match) return false;

  const [, keyUserId, timestampText, nonce, suppliedSignature] = match;

  if (keyUserId !== userId.toString()) return false;

  const timestamp = Number(timestampText);
  const now = Date.now();

  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp > now + FUTURE_TIMESTAMP_TOLERANCE_MS ||
    now - timestamp > UPLOAD_KEY_MAX_AGE_MS
  ) {
    return false;
  }

  const payload = `${keyUserId}:${timestampText}:${nonce}:${mimeType}`;

  const expectedSignature = crypto
    .createHmac("sha256", getUploadKeySecret())
    .update(payload)
    .digest();

  const suppliedBuffer = Buffer.from(suppliedSignature, "hex");

  if (suppliedBuffer.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedSignature, suppliedBuffer);
}

// GENERATE UPLOAD URL SERVICE
exports.generateUploadUrlService = async (fileData, userId) => {
  const { originalName, mimeType } = fileData || {};

  if (
    typeof originalName !== "string" ||
    !originalName.trim() ||
    typeof mimeType !== "string" ||
    !mimeType.trim()
  ) {
    throw new ApiError("File name and MIME type are required", 400);
  }

  const normalizedMimeType = mimeType.trim();
  const key = createUploadKey(userId, normalizedMimeType);
  const uploadUrl = await generateUploadUrl(key, normalizedMimeType);

  return { key, uploadUrl };
};

// CONFIRM UPLOAD SERVICE
exports.confirmUploadService = async (fileData, userId) => {
  const { originalName, mimeType, size, key, folder } = fileData || {};

  if (
    typeof originalName !== "string" ||
    !originalName.trim() ||
    typeof mimeType !== "string" ||
    !mimeType.trim() ||
    !Number.isSafeInteger(size) ||
    size < 0 ||
    typeof key !== "string" ||
    !key.trim()
  ) {
    throw new ApiError("Invalid upload data", 400);
  }

  const normalizedMimeType = mimeType.trim();

  // Verify server signature, user ownership, MIME binding, and key age.
  if (!verifyUploadKey(key, userId, normalizedMimeType)) {
    throw new ApiError(
      "Invalid, expired, or unauthorized storage key",
      403
    );
  }

  // Permit uploads into folders owned by this user OR where user is an editor.
  if (folder) {
    validateObjectId(folder, "destination folder ID");

    const parentFolder = await Folder.findById(folder);

    if (!parentFolder) {
      throw new ApiError(
        "Destination folder does not exist",
        404
      );
    }

    const permission = await folderService.getEffectiveFolderPermission(parentFolder, userId);

    if (!["owner", "editor"].includes(permission)) {
      throw new ApiError(
        "You do not have permission to upload into this folder",
        403
      );
    }
  }

  // Prevent confirming the same key more than once.
  const existingFile = await File.findOne({ key });

  if (existingFile) {
    throw new ApiError("This upload has already been confirmed", 409);
  }

  // Verify that the object exists in S3.
  const objectMetadata = await getObjectMetadata(key);

  if (!objectMetadata) {
    throw new ApiError(
      "Uploaded object was not found in storage",
      400
    );
  }

  // Use storage metadata rather than trusting client-supplied size.
  if (objectMetadata.size !== size) {
    throw new ApiError(
      "Uploaded file size does not match the confirmed size",
      400
    );
  }

  // Ensure the uploaded Content-Type matches the signed upload request.
  if (
    objectMetadata.contentType &&
    objectMetadata.contentType !== normalizedMimeType
  ) {
    throw new ApiError(
      "Uploaded file type does not match the confirmed type",
      400
    );
  }

  const file = await File.create({
    originalName: originalName.trim(),
    mimeType: normalizedMimeType,
    size: objectMetadata.size,
    key,
    owner: userId,
    folder: folder || null,
  });

  await file.populate("owner", "name email avatar");
  return file;
};

// KNOWN FILE EXTENSIONS
const EXT_MIME_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  aac: "audio/aac",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

// RESOLVE A SAFER DOWNLOAD CONTENT TYPE
function resolveContentType(originalName, storedMime) {
  const ext = (originalName || "").split(".").pop().toLowerCase();
  const mapped = EXT_MIME_MAP[ext];

  let contentType = storedMime;

  if (
    !contentType ||
    contentType === "application/octet-stream" ||
    contentType === "binary/octet-stream"
  ) {
    contentType = mapped || "application/octet-stream";
  }

  const normalizedType = contentType
    .split(";")[0]
    .trim()
    .toLowerCase();

  // Avoid serving potentially active content as an inline document.
  const unsafeInlineTypes = new Set([
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
    "application/javascript",
    "text/javascript",
    "application/ecmascript",
    "text/ecmascript",
  ]);

  if (unsafeInlineTypes.has(normalizedType)) {
    return "application/octet-stream";
  }

  return contentType;
}

// RETURN A SAFE FILE OBJECT
function toSafeFile(file, extra = {}) {
  const plainFile = file?.toObject
    ? file.toObject()
    : { ...file };

  const { key, sharedWith, ...safeFile } = plainFile;

  return {
    ...safeFile,
    granteeCount:
      extra.granteeCount !== undefined
        ? extra.granteeCount
        : plainFile.granteeCount !== undefined
        ? plainFile.granteeCount
        : (sharedWith || []).length,
    ...extra,
  };
}

// GET EFFECTIVE FILE PERMISSION
// Returns: owner, editor, viewer, or null.
exports.getEffectiveFilePermission = async (file, userId) => {
  if (!file || !userId) return null;

  const userIdString = userId.toString();

  const fileOwnerId = toIdString(file.owner);
  if (fileOwnerId && fileOwnerId === userIdString) {
    return "owner";
  }

  // Explicit file shares take precedence over folder inheritance.
  const directShare = (file.sharedWith || []).find(
    (share) => toIdString(share?.user) === userIdString
  );

  if (directShare) {
    return directShare.permission;
  }

  let currentFolder = file.folder
    ? await Folder.findById(file.folder)
    : null;

  const visited = new Set();

  while (currentFolder) {
    const currentId = currentFolder._id.toString();

    if (visited.has(currentId)) {
      throw new ApiError("Invalid folder hierarchy", 400);
    }

    visited.add(currentId);

    // The owner of a containing folder can edit its contents.
    const folderOwnerId = toIdString(currentFolder.owner);
    if (folderOwnerId && folderOwnerId === userIdString) {
      return "editor";
    }

    // The nearest matching folder share wins.
    const folderShare = (currentFolder.sharedWith || []).find(
      (share) => toIdString(share?.user) === userIdString
    );

    if (folderShare) {
      return folderShare.permission;
    }

    if (!currentFolder.parent) break;

    currentFolder = await Folder.findById(currentFolder.parent);
  }

  return null;
};

// CAN ACCESS FILE
exports.canAccessFile = async (file, userId) => {
  const permission = await exports.getEffectiveFilePermission(
    file,
    userId
  );

  if (!permission) {
    throw new ApiError(
      "You do not have permission to view this file",
      403
    );
  }

  return true;
};

// CAN EDIT FILE
exports.canEditFile = async (file, userId) => {
  const permission = await exports.getEffectiveFilePermission(
    file,
    userId
  );

  if (!["owner", "editor"].includes(permission)) {
    throw new ApiError(
      "You do not have permission to edit this file!",
      403
    );
  }

  return true;
};

// GENERATE DOWNLOAD URL SERVICE
exports.generateDownloadUrlService = async (fileId, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  await exports.canAccessFile(file, userId);

  const contentType = resolveContentType(
    file.originalName,
    file.mimeType
  );

  return generateDownloadUrl(file.key, contentType);
};

// GET ALL FILES SERVICE
exports.getAllFilesService = async (userId) => {
  const userIdString = userId.toString();

  // Find all folders accessible to the user (owned or directly shared)
  const accessibleFolders = await Folder.find({
    $or: [{ owner: userId }, { "sharedWith.user": userId }],
  }).select("_id parent").lean();

  const folderIdSet = new Set(accessibleFolders.map((f) => f._id.toString()));

  // Expand recursively to all subfolder descendants of accessible folders
  let frontier = Array.from(folderIdSet);
  while (frontier.length > 0) {
    const children = await Folder.find({ parent: { $in: frontier } }).select("_id parent").lean();
    const newChildrenIds = children
      .map((c) => c._id.toString())
      .filter((id) => !folderIdSet.has(id));
    if (newChildrenIds.length === 0) break;
    for (const id of newChildrenIds) {
      folderIdSet.add(id);
    }
    frontier = newChildrenIds;
  }

  const folderIds = Array.from(folderIdSet);

  const files = await File.find({
    $or: [
      { owner: userId },
      { folder: { $in: folderIds } },
      { "sharedWith.user": userId },
    ],
  })
    .populate("owner", "name email avatar")
    .populate("sharedWith.user", "name email avatar")
    .lean();

  // Ensure any unpopulated owner references are looked up from User model
  const unpopulatedOwnerIds = [];
  for (const item of files) {
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
    for (const item of files) {
      const oid = (item.owner?._id || item.owner)?.toString();
      if (oid && userMap.has(oid)) {
        item.owner = userMap.get(oid);
      }
    }
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

  const processedFiles = [];
  for (const file of files) {
    const isOwner = toIdString(file.owner) === userIdString;
    const directShare = (file.sharedWith || []).find(
      (s) => toIdString(s?.user?._id || s?.user) === userIdString
    );

    let permission = null;
    let inherited = false;

    if (isOwner) {
      permission = "owner";
      inherited = false;
    } else if (directShare) {
      permission = directShare.permission || "editor";
      inherited = false;
    } else {
      permission = await exports.getEffectiveFilePermission(file, userId);
      inherited = Boolean(permission);
    }

    if (!permission && !isOwner) {
      continue;
    }

    const itemGrantees = extractGrantees(file);

    processedFiles.push(
      toSafeFile(file, {
        myPermission: permission,
        permission,
        inherited,
        grantees: itemGrantees,
        granteeCount: itemGrantees.length,
      })
    );
  }

  return processedFiles;
};

// GET A FILE SERVICE
exports.getFileService = async (fileId, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId)
    .populate("owner", "name email avatar")
    .populate("sharedWith.user", "name email avatar");

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  const permission = await exports.getEffectiveFilePermission(file, userId);
  if (!permission) {
    throw new ApiError("You do not have permission to view this file", 403);
  }

  const isOwner = toIdString(file.owner) === userId.toString();
  const directShare = (file.sharedWith || []).find(
    (s) => toIdString(s?.user?._id || s?.user) === userId.toString()
  );

  return toSafeFile(file, {
    myPermission: permission,
    permission,
    inherited: !isOwner && !directShare,
  });
};

// DELETE A FILE SERVICE
// Only the actual file owner can delete it.
exports.deleteFileService = async (fileId, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  const permission = await exports.getEffectiveFilePermission(file, userId);
  if (!["owner", "editor"].includes(permission)) {
    throw new ApiError(
      "You do not have permission to delete this file!",
      403
    );
  }

  await deleteObject(file.key);
  await File.findByIdAndDelete(fileId);
};

// MOVE FILE SERVICE
exports.moveFileService = async (fileId, folderId, userId) => {
  validateObjectId(fileId, "file ID");

  if (folderId) {
    validateObjectId(folderId, "destination folder ID");
  }

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("File does not exist!", 404);
  }

  await exports.canEditFile(file, userId);

  // Destinations must be owned by the requester OR requester has editor permissions on it.
  if (folderId) {
    const folder = await Folder.findById(folderId);

    if (!folder) {
      throw new ApiError("Destination folder does not exist", 404);
    }

    const folderPerm = await folderService.getEffectiveFolderPermission(folder, userId);
    if (!["owner", "editor"].includes(folderPerm)) {
      throw new ApiError("You do not have permission to move files into this folder", 403);
    }
  }

  file.folder = folderId || null;
  await file.save();

  return toSafeFile(file);
};

// RENAME FILE SERVICE
exports.renameFileService = async (fileId, newName, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("File does not exist!", 404);
  }

  await exports.canEditFile(file, userId);

  if (typeof newName !== "string" || !newName.trim()) {
    throw new ApiError("File name is required!", 400);
  }

  file.originalName = newName.trim();
  await file.save();

  return toSafeFile(file);
};

async function isAuthorizedFileOwner(file, userId) {
  const userIdString = userId.toString();
  if (toIdString(file.owner) === userIdString) return true;
  if (!file.folder) return false;
  let current = await Folder.findById(file.folder);
  const visited = new Set();
  while (current) {
    const cid = current._id.toString();
    if (visited.has(cid)) break;
    visited.add(cid);
    if (toIdString(current.owner) === userIdString) return true;
    if (!current.parent) break;
    current = await Folder.findById(current.parent);
  }
  return false;
}

// SHARE FILE SERVICE
// Only the file owner or containing folder owner can share it.
exports.shareFileService = async (
  fileId,
  userId,
  recipientId,
  permission
) => {
  validateObjectId(fileId, "file ID");
  validateObjectId(recipientId, "recipient ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  const isOwner = await isAuthorizedFileOwner(file, userId);
  if (!isOwner) {
    throw new ApiError("You do not own this file!", 403);
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    throw new ApiError("The recipient does not exist!", 404);
  }

  if (toIdString(file.owner) === toIdString(recipientId)) {
    throw new ApiError(
      "You cannot share a file with its owner!",
      400
    );
  }

  if (!["viewer", "editor"].includes(permission)) {
    throw new ApiError("Invalid permission!", 400);
  }

  const existingShare = (file.sharedWith || []).find(
    (share) => toIdString(share?.user) === toIdString(recipientId)
  );

  if (existingShare) {
    existingShare.permission = permission;
    existingShare.sharedAt = new Date();
  } else {
    file.sharedWith.push({ user: recipientId, permission, sharedAt: new Date() });
  }

  await file.save();

  return toSafeFile(file);
};

// REMOVE FILE SHARE ACCESS
exports.removeFileShareService = async (
  fileId,
  userId,
  recipientId
) => {
  validateObjectId(fileId, "file ID");
  validateObjectId(recipientId, "recipient ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  const isOwner = await isAuthorizedFileOwner(file, userId);
  if (!isOwner) {
    throw new ApiError("You do not own this file!", 403);
  }

  const existingShare = (file.sharedWith || []).some(
    (share) => toIdString(share?.user) === toIdString(recipientId)
  );

  if (!existingShare) {
    throw new ApiError(
      "This user does not have direct access to this file",
      404
    );
  }

  file.sharedWith = file.sharedWith.filter(
    (share) => toIdString(share?.user) !== toIdString(recipientId)
  );

  await file.save();

  return toSafeFile(file);
};


// SHARED WITH ME SERVICE
// Returns files and ROOT folders shared directly with the user or via ancestors.
// Only returns the topmost accessible item (not children already listed under a shared root).
exports.sharedWithMeService = async (userId) => {
  const userIdString = userId.toString();

  // ── FILES ────────────────────────────────────────────────────────────────────
  const candidateFiles = await File.find({
    owner: { $ne: userId },
  }).populate("owner", "name email avatar").lean();

  const files = [];

  for (const file of candidateFiles) {
    const permission = await exports.getEffectiveFilePermission(file, userId);
    if (!permission) continue;

    // Determine whether access is direct or inherited
    const directShare = (file.sharedWith || []).find(
      (s) => toIdString(s?.user) === userIdString
    );
    const inherited = !directShare;
    let inheritedFrom = null;

    if (inherited && file.folder) {
      // Walk ancestors to find the granting folder
      let current = await Folder.findById(file.folder).lean();
      const visited = new Set();
      while (current) {
        const cid = current._id.toString();
        if (visited.has(cid)) break;
        visited.add(cid);
        const match = (current.sharedWith || []).find(
          (s) => toIdString(s?.user) === userIdString
        );
        if (match) {
          inheritedFrom = { id: current._id, name: current.name };
          break;
        }
        if (!current.parent) break;
        current = await Folder.findById(current.parent).lean();
      }
    }

    files.push({
      ...toSafeFile(file),
      permission,
      inherited,
      inheritedFrom,
      sharedAt: directShare?.sharedAt || file.updatedAt || file.createdAt,
      owner: file.owner
        ? { _id: file.owner._id, name: file.owner.name, email: file.owner.email, avatar: file.owner.avatar || null }
        : null,
    });
  }

  // ── FOLDERS — root-level only (no parent accessible via the same share) ─────
  const candidateFolders = await Folder.find({
    owner: { $ne: userId },
  }).populate("owner", "name email avatar").lean();

  const folders = [];

  for (const folder of candidateFolders) {
    const permission = await folderService.getEffectiveFolderPermission(folder, userId);
    if (!permission) continue;

    // Only show this folder if the user has a DIRECT grant on it
    // (to avoid listing every descendant of a shared root separately).
    const directShare = (folder.sharedWith || []).find(
      (s) => toIdString(s?.user) === userIdString
    );
    if (!directShare) continue;

    folders.push({
      _id: folder._id,
      name: folder.name,
      parent: folder.parent,
      owner: folder.owner
        ? { _id: folder.owner._id, name: folder.owner.name, email: folder.owner.email, avatar: folder.owner.avatar || null }
        : null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      sharedAt: directShare?.sharedAt || folder.updatedAt || folder.createdAt,
      permission,
      myPermission: permission,
      inherited: false,
      inheritedFrom: null,
    });
  }

  return { files, folders };
};

// GET FILE SHARE GRANTS SERVICE
// Returns the direct share list for a file with user name/email, for the owner only.
exports.getFileShareGrantsService = async (fileId, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId).populate("sharedWith.user", "name email avatar");

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  const isOwner = await isAuthorizedFileOwner(file, userId);
  if (!isOwner) {
    throw new ApiError("You do not own this file!", 403);
  }

  const grants = (file.sharedWith || [])
    .filter((s) => s.user)
    .map((s) => ({
      userId: s.user._id,
      name: s.user.name,
      email: s.user.email,
      avatar: s.user.avatar || null,
      role: s.permission,
    }));

  const inheritedGrants = [];
  let currFolderId = file.folder;
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

// LEAVE FILE SHARE SERVICE
// Removes the caller's OWN direct grant. Caller must NOT be the owner.
exports.leaveFileShareService = async (fileId, userId) => {
  validateObjectId(fileId, "file ID");

  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError("This file does not exist!", 404);
  }

  if (toIdString(file.owner) === userId.toString()) {
    throw new ApiError("Owners cannot leave their own file!", 400);
  }

  const hasDirect = (file.sharedWith || []).some(
    (s) => toIdString(s?.user) === userId.toString()
  );

  if (!hasDirect) {
    throw new ApiError(
      "You do not have a direct share grant on this file",
      404
    );
  }

  file.sharedWith = file.sharedWith.filter(
    (s) => toIdString(s?.user) !== userId.toString()
  );

  await file.save();

  // Check if user still has access through folder inheritance
  const reloadedFile = await File.findById(fileId);
  const remainingPermission = await exports.getEffectiveFilePermission(reloadedFile, userId);

  return {
    stillHasAccess: Boolean(remainingPermission),
    throughFolder: null, // simplified: ancestor check omitted for files
  };
};

// SHARED BY ME SERVICE
// Returns items owned by the caller that have at least one share grant.
exports.sharedByMeService = async (userId) => {
  const files = await File.find({
    owner: userId,
    "sharedWith.0": { $exists: true },
  })
    .select("_id originalName mimeType size createdAt updatedAt sharedWith")
    .populate("sharedWith.user", "name email avatar")
    .lean();

  const folders = await Folder.find({
    owner: userId,
    "sharedWith.0": { $exists: true },
  })
    .select("_id name createdAt updatedAt sharedWith")
    .populate("sharedWith.user", "name email avatar")
    .lean();

  const formatItem = (item, isFile) => {
    const validShares = (item.sharedWith || []).filter((s) => s && s.user);
    const grantees = validShares.map((s) => ({
      userId: s.user._id,
      name: s.user.name,
      email: s.user.email,
      avatar: s.user.avatar || null,
      permission: s.permission,
      sharedAt: s.sharedAt || item.updatedAt || item.createdAt,
    }));

    // Decide "Date shared": latest share across all grantees
    let latestSharedAt = item.updatedAt || item.createdAt;
    for (const g of grantees) {
      if (g.sharedAt && new Date(g.sharedAt) > new Date(latestSharedAt)) {
        latestSharedAt = g.sharedAt;
      }
    }

    return {
      _id: item._id,
      ...(isFile
        ? { originalName: item.originalName, mimeType: item.mimeType, size: item.size }
        : { name: item.name }),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sharedAt: latestSharedAt,
      granteeCount: grantees.length,
      grantees,
      sharedWith: grantees,
    };
  };

  return {
    files: files.map((f) => formatItem(f, true)),
    folders: folders.map((f) => formatItem(f, false)),
  };
};

