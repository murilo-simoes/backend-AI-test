import Fastify from "fastify";
import cors from "@fastify/cors";
import {MeasureRoutes} from './routes/measure'

async function shopper(){
    //Inicia o Fastify
    const fastify = Fastify({
        logger:true,
    })

    //Libera a rota do CORS
    await fastify.register(cors, {
        origin:true,
    })

    //Registra as rotas da API
    await fastify.register(MeasureRoutes);

    //Inicia o servidor
    await fastify.listen({port: 3000, host: "0.0.0.0" })
}

shopper();