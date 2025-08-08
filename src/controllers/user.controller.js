import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(500, 'access/refresh token error');
  }
};

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
  // console.log(email);

  // simple validation but can do more like email etc
  if (
    [fullName, email, username, password].some((field) => field?.trim() == '')
  ) {
    throw new ApiError(400, 'All fields are required');
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });

  if (existingUser) {
    throw new ApiError(409, 'User with email or username already exists');
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage && req.files.coverImage.length > 0)
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

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

const loginUser = asyncHandler(async (req, res) => {
  // req body
  // username or email
  // find user
  // password match
  // access and refresh token
  // send cookie for ^
  // succeed
  const { email, username, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, 'username or email is required');
  }

  const user = await User.findOne({ $or: [{ email }, { username }] });
  if (!user) {
    throw new ApiError(404, 'user does not exist');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  // console.log(isPasswordValid);

  if (!isPasswordValid) {
    throw new ApiError(401, 'invalid user credential');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  // console.log(loggedInUser.username);

  const options = {
    httpOnly: true,
    secure: true,
  };

  // console.log(accessToken, refreshToken);

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        'user loggedin succeeded'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'user log out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incominReqToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incominReqToken) {
    throw new ApiError(401, 'unauthorized req');
  }

  try {
    const decodedToken = jwt.verify(
      incominReqToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'invalid refresh token');
    }

    if (incominReqToken != user?.refreshToken) {
      throw new ApiError(401, 'refresh token is expired');
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          'token refreshed'
        )
      );
  } catch (err) {
    throw new ApiError(401, err?.message || 'invalid refresh token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, 'invalid password');
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'pass changed successful'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, 'current user'));
});

const updateCurrentUser = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, 'all fields are required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email: email },
    },
    { new: true }
  ).select('-password -refreshPassword');

  return res.status(200).json(new ApiResponse(200, user, 'user data updated'));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, 'avatar file is missing');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'error while uploading avatar');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'avatar img uploaded'));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, 'username is missing');
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: '$subscribers',
        },
        channelsSubscribedToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, '$subscribers.subscriber'],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        avatar: 1,
        // other req fields like createdAt etc which are needed
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, 'channel doest not exist');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], 'channel fetched successfully'));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullName: { fullName: 1, username: 1, avatar: 1 },
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(new ApiResponse(200, user[0].WatchHistory, 'watch history fetched'));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  changeCurrentPassword,
  updateCurrentUser,
  updateUserAvatar,
};
