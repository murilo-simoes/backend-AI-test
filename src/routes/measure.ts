import { Type } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { EmptyOrNull, BadRequest } from "../lib/functions";
import { z } from "zod";
import { GetGeminiResponse } from '../api/gemini';

export async function MeasureRoutes(fastify: FastifyInstance){

    const VALUES = ["WATER", "GAS"] as const;

    //#region Rota para UPLOAD das imagens
    fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
        const createMeasureBody = z.object({
            image: z.string().refine((str) => {
                try {
                    return !!str && Buffer.from(str, 'base64').toString('base64') === str;
                } catch {
                    return false;
                }
            }, {
                message: "O texto inserido para imagem não é um Base64 válido",
            }),
            customer_code:z.string(),
            measure_datetime: z.string().datetime().pipe(z.coerce.date()),
            measure_type: z.string()
            .transform((val) => val.toUpperCase())  // Transforma em maiúsculas
            .refine((val) => VALUES.includes(val as typeof VALUES[number]), {
                message: "O tipo de medida fornecido é inválido. (WATER OU GAS)",
            })
        })
        
        // Validação do tipo de dado informado
        const parseResult = createMeasureBody.safeParse(request.body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]
            return BadRequest(reply, firstError.message != "" ? firstError.message : "Tipos de dados inseridos de um ou mais parâmetros estão incorretos", "INVALID_DATA", 400)
        }

        //Se a validação for bem sucedida, extrai os valores
        const {image, customer_code, measure_datetime, measure_type} = createMeasureBody.parse(request.body);

        //Validações dos parâmetros extraidos
        if(EmptyOrNull(image.trim()) || EmptyOrNull(customer_code.trim()) || !measure_datetime || EmptyOrNull(measure_type.trim())){
            return BadRequest(reply, "Um ou mais parâmetros não foram informados corretamente", "INVALID_DATA", 400)
        }

        //Verificação se já existe uma leitura no mês e no tipo de leitura especificado
        const year = measure_datetime.getFullYear();
        const month = measure_datetime.getMonth() + 1;
        const measureExist = await prisma.measure.findFirst({
            where:{
                customer_code: customer_code,
                datetime: {
                    gte: new Date(`${year}-${month.toString().padStart(2, '0')}-01T00:00:00Z`),
                    lt: new Date(`${year}-${(month + 1).toString().padStart(2, '0')}-01T00:00:00Z`)
                },
                type: measure_type as Type
            }
        })

        if(measureExist){
            return BadRequest(reply, "Leitura do mês já realizada", "DOUBLE_REPORT", 409)
        }


        //Realiza a criação no banco
        const measure = await prisma.measure.create({
            data:{
                image_url: image,
                customer_code: customer_code,
                datetime: measure_datetime,
                type: measure_type as Type,
                has_confirmed: false,
            }
        })

        //Chama a API da Gemini 
        await GetGeminiResponse(image, measure.uuid)

        //Retorna o resultado
        return reply.status(200).send({
            "image_url":image,
            "measure_value":2,
            "measure_uuid": measure.uuid
        })

    })

    //#endregion
}


