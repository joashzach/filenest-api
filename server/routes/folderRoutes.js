const express = require("express");
const protect = require("../middlewares/authMiddleware");
const {
  createFolder,
  getFolders,
  getFolderContents,
  renameFolder,
  deleteFolder,
  moveFolder,
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

module.exports = router;
