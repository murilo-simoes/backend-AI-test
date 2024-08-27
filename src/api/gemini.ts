import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

export async function GetGeminiResponse(link: string, uuid: string){
  
  var base64Data = link.replace(/^data:image\/png;base64,/, "");
  fs.writeFile(`temp-${uuid}.png`, base64Data, 'base64', function(err) {
    console.log(err);
  });
}