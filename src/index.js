import dotenv from "dotenv";
import {app} from "./app.js";
import { connectToDB } from "./db/index.js";

dotenv.config({
    path:'./.env'
})
const PORT=process.env.PORT||8014

connectToDB()

app.listen(PORT,()=>{
    console.log(`Server is running at PORT:${PORT}...`);
})