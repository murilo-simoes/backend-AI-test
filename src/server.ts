import Fastify from "fastify";
import cors from "@fastify/cors";
import {MeasureRoutes} from './routes/measure'

async function shopper(){
    const fastify = Fastify({
        logger:true,
    })

    await fastify.register(cors, {
        origin:true,
    })

    
    await fastify.register(MeasureRoutes);

    await fastify.listen({port: 3333, host: "0.0.0.0" })
}

shopper();