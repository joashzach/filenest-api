const express = require("express");
const protect = require("../middlewares/authMiddleware");
const {
  createFolder,
  getFolders,
  getFolderContents,
  renameFolder,
  deleteFolder,
  moveFolder,
  shareFolder,
  removeFolderShare,
  getFolderShareGrants,
  leaveFolderShare,
} = require("../controllers/folderController");
const router = express.Router();

router.post("/", protect, createFolder);
router.get("/", protect, getFolders);
router.get("/contents", protect, getFolderContents);
router.get("/:folderId/contents", protect, getFolderContents);
router.patch("/:folderId/move", protect, moveFolder);
router
  .route("/:folderId")
  .patch(protect, renameFolder)
  .delete(protect, deleteFolder);
// Share management — /share/me must come before /share/:recipientId
router.get("/:folderId/share", protect, getFolderShareGrants);
router.post("/:folderId/share", protect, shareFolder);
router.delete("/:folderId/share/me", protect, leaveFolderShare);
router.delete("/:folderId/share/:recipientId", protect, removeFolderShare);

module.exports = router;
