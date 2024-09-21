import express from 'express'
import cors from 'cors'
import morgan from 'morgan';
import cookieParser from 'cookie-parser'


const app=express();

app.use(cors())
//common middlewares
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(morgan())
app.use(cookieParser())

//import routes
import healthcheckRouter from './routes/healthcheck.routes.js';
import userRoutes from './routes/user.routes.js';
import { errorHandler } from './middlewares/error.middlewares.js';

//routes
app.use('/api/v1/healthcheck',healthcheckRouter)
app.use('/api/v1/users',userRoutes)

app.use('*',(req,res)=>{
    res.send("404!!! PAGE NOT FOUND")
})


app.use(errorHandler) //good practice
export  {app};