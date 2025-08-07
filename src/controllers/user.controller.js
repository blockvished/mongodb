import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req, res) => {
  // get users details from request
  // validation like non empty etc
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, check if uploaded on cloudinary
  // create user object in db
  // remove password and refresh token from field from response
  // check if user created
  // return response
  const { fullName, email, username, password } = req.body;
  console.log(email);

  // simple validation but can do more like email etc
  if (
    [fullName, email, username, password].some((field) => field?.trim() == '')
  ) {
    throw new ApiError(400, 'All fields are required');
  }

  const existingUser = User.findOne({ $or: [{ email }, { username }] });

  if (existingUser) {
    throw new ApiError(409, 'User with email or username already exists');
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is required');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, 'Avatar file is required');
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  if (!createdUser) {
    throw new ApiError(500, 'something went wrong while registerign');
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'user registered successfully'));
});

export { registerUser };
