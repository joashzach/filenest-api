const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please tell us your name!"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email!"],
      unique: true,
      validate: [validator.isEmail, "Please provide a valid email!"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please provide a password!"],
      select: false,
      minlength: [8, "A minimum of 8 characters is required!"],
    },
    passwordChangedAt: Date,
    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  // Set timestamp before hashing
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimeStamp;
  }

  return false;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
