import mongoose from "mongoose";

export const connectToDB=async()=>{
    try {
        const connectionInstance=await mongoose.connect(process.env.DB_URI)
        console.log(`Database connected Successfully!!! DB Host:${connectionInstance.connection.host}`);

    } catch (e) {
        console.log("Error in connnecting Database",e);
    }
}

