import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export async function GetGeminiResponse(link: string){

  //Variáveis para conectar com os serviços do Google
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

  //Nome para salvar a imagem temporariamente
  const nomeImagem = `temp-${uuidv4()}.png`

  //Salva a imagem temporariamente para enviar para o GEMINI
  var base64Data = link.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(nomeImagem, base64Data, 'base64');
  
  //Sobe a imagem para o serviço da Google
  const uploadResponse = await fileManager.uploadFile(nomeImagem, {
    mimeType: "image/png",
    displayName: nomeImagem,
  });

  //Faz a requisição para o GEMINI retornar o valor do medidor
  const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri
      }
    },
    { text: "Preciso que a resposta seja precisa. É um medidor de água ou gás? Se sim, me retorna o valor que está no medidor. Caso o contrário, me retorne a palavra ERRO. Eu quero apenas o valor do medidor ou a palavra ERRO, nada além disso." },
  ]);

  //Deleta a imagem que salvou temporariamente
  fs.unlinkSync(nomeImagem);

  //Verifica se ele conseguiu identificar o medidor na foto, caso não, retorna erro
  if(result.response.text().trim() === "ERRO"){
    return {image_url :uploadResponse.file.uri,
      text_value: "0"}
  }

  //Retorna o valor da medição com o link temporario da imagem
  return {image_url :uploadResponse.file.uri,
          text_value: result.response.text()}
}