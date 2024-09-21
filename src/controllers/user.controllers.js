import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"


const generateAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        if(!user){
            throw new ApiError(401, "No user found")
        }
    
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
    
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token",error)
    }
}

export const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body

    //validation
    // if(fullName?.trim()===""){} //simple
    if (
        [fullName, email, password, username].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(404, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // console.warn(req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path


    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //    const avatar=await uploadOnCloudinary(avatarLocalPath)
    //    let coverImage=""
    //    if(coverLocalPath){
    //        coverImage=await uploadOnCloudinary(coverLocalPath)
    //    }


    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("uploaded avatar", avatar);
    } catch (error) {
        console.log("Error uploading avatar", error);
        throw new ApiError(500, "Failed to upload avatar")
    }

    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverLocalPath)
        console.log("uploaded coverImages", coverImage);
    } catch (error) {
        console.log("Error uploading avatar", error);
        throw new ApiError(500, "Failed to upload Cover Image")
    }

    try {
        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })

        const creaedUser = await User.findById(user._id).select("-password -refreshToken")
        if (!creaedUser) {
            throw new ApiError(500, "Something went wrong while registering user")
        }

        return res
            .status(201)
            .json(new ApiResponse(200, creaedUser, "User registered Successfully"))
    } catch (error) {
        console.log("User creation failed");
        if (avatar) {
            await deleteFromCloudinary(avatar.public_id)
        }

        if (coverImage) {
            await deleteFromCloudinary(coverImage.public_id)
        }
        throw new ApiError(500, "Something went wrong while registering user and images were deleted")

    }

})

export const loginUser = asyncHandler(async (req, res) => {
    // get data from body
    const {username,email,password}=req.body
    // validation
    if(!email){
        throw new ApiError(400, "Email is required")
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    //validate password

    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid Credentials")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedInUser=await User.findById(user._id)
    .select("-password -refreshToken");

    if(!loggedInUser){
        throw new ApiError(404, "User not found while logging")
    }

    const options={
        httpOnly:true,
        secure:process.env.NODE_ENV==="production"
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",options)
    .json(new ApiResponse(
        200,
        {user:loggedInUser,accessToken,refreshToken},
        "User logged in Successfully"
    ))
})

export const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined // can write null or blank string
            }
        },
        {new:true}
    )

    const options={
        httpOnly:true,
        secure:process.env.NODE_ENV==="production"
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out successfully")
    )
    
})

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid Refresh token")
        }

        if(incomingRefreshToken!==user?.refreshToken){
         throw new ApiError(401,"Invalid Refresh Token")
        }

        const options={
            httpOnly:true,
            secure:process.env.NODE_ENV="production"
        }

       const{accessToken,refreshToken:newRefreshToken}=await generateAccessAndRefreshToken(user._id)

       return res
       .status(200)
       .cookie("accessToken",accessToken,options)
       .cookie("refreshToken",newRefreshToken,options)
       .json(
        new ApiResponse(
            200,
            {accessToken,
                refreshToken:newRefreshToken
            },
            "Access Token refreshed Successfully"
        )
       );

    } catch (error) {
        throw new ApiError(500, "something went wrong while generatin access token and refresh token")
    }

})

export const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    const user=await User.findById(req.user?._id)

    const isPasswordValid=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(401,"Old password is incorrect")
    }

    user.password=newPassword;
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed Successfully"))
})

export const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user details"))
})

export const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullName,email}=req.body

    if(!fullName||!email){
        throw new ApiError(400,"Fullname and email are required")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"User update Successfully"))
})

export const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"File is required")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(500,"Something went wrong while updating avatar")
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },{new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))
})


export const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(500,"File required")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(500,"Something went wrong while updating cover Image")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },{new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"CoverImage successfully updated"))
})
