import { Type } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { EmptyOrNull, BadRequest, ConvertInteger } from "../lib/functions";
import { z } from "zod";
import { GetGeminiResponse } from '../api/gemini';

export async function MeasureRoutes(fastify: FastifyInstance) {

    const VALUES = ["WATER", "GAS"] as const;

    //#region Rota para UPLOAD das imagens
    fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
        
        //Define o corpo da requisição, seus tipos e o texto de retorno caso aconteça um erro
        const createMeasureBody = z.object({
            image: z.string().refine((str) => {
                try {
                    return !!str && Buffer.from(str, 'base64').toString('base64') === str;
                } catch {
                    return false;
                }
            }, {
                message: "Erro - O texto inserido para imagem não é um Base64 válido",
            }),
            customer_code: z.string({invalid_type_error: "Erro - O código do cliente tem que ser uma string." }),
            measure_datetime: z.string().datetime().pipe(z.coerce.date()),
            measure_type: z.string()
                .refine((val) => VALUES.includes(val as typeof VALUES[number]), {
                    message: "Erro - O tipo de medida fornecido é inválido. ('WATER' ou 'GAS')",
                })
        })

        // Validação do tipo de dado informado
        const parseResult = createMeasureBody.safeParse(request.body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]

            return BadRequest(reply, firstError.message.startsWith("Erro") ? firstError.message : "Tipos de dados inseridos de um ou mais parâmetros estão incorretos", "INVALID_DATA", 400)
        }

        //Se a validação for bem sucedida, extrai os valores
        const { image, customer_code, measure_datetime, measure_type } = createMeasureBody.parse(request.body);

        //Validações dos parâmetros extraidos
        if (EmptyOrNull(image.trim()) || EmptyOrNull(customer_code.trim()) || !measure_datetime || EmptyOrNull(measure_type.trim())) {
            return BadRequest(reply, "Um ou mais parâmetros não foram informados corretamente", "INVALID_DATA", 400)
        }

        //Verificação se já existe uma leitura no mês e no tipo de leitura especificado
        const year : number = measure_datetime.getFullYear();
        const month : number = measure_datetime.getMonth() + 1;
        const measureExist = await prisma.measure.findFirst({
            where: {
                customer_code: customer_code,
                datetime: {
                    gte: new Date(`${year}-${month.toString().padStart(2, '0')}-01T00:00:00Z`),
                    lt: new Date(`${year}-${(month + 1).toString().padStart(2, '0')}-01T00:00:00Z`)
                },
                type: measure_type as Type
            }
        })

        if (measureExist) {
            return BadRequest(reply, "Leitura do mês já realizada", "DOUBLE_REPORT", 409)
        }

        //Chama a API da Gemini 
        const { image_url, text_value } = await GetGeminiResponse(image)

        //Verifica se a LLM conseguiu identificar como um medidor, caso não, retorna um BadRequest
        let measure_value : number = 0;
        if(image_url?.trim() === "ERRO" || text_value?.trim() === "ERRO"){
            return BadRequest(reply, "Não foi identificado a medição na imagem enviada", "INVALID_DATA", 400)
        }else{
            measure_value = ConvertInteger(text_value!);
        }

        //Realiza a criação no banco de dados
        const measure = await prisma.measure.create({
            data: {
                image_url: image_url,
                customer_code: customer_code,
                datetime: measure_datetime,
                type: measure_type as Type,
                has_confirmed: false,
                value: measure_value
            }
        })


        //Retorna o resultado
        return reply.status(200).send({
            "image_url": image_url,
            "measure_value": measure_value,
            "measure_uuid": measure.uuid
        })

    })

    //#endregion

    //#region Rota para CONFIRMAR o valor lido pelo LLM
    fastify.post('/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
        
        //Define o corpo da requisição, seus tipos e o texto de retorno caso aconteça um erro
        const createMeasureBody = z.object({
            measure_uuid: z.string({invalid_type_error: "Erro - O UUID da medição tem que ser uma string." }).uuid({
                message: "Erro - O UUID fornecido não é válido." 
            }),
            confirmed_value: z.number({
                invalid_type_error: "Erro - O valor confirmado deve ser um inteiro." 
            })
        })

        // Validação do tipo de dado informado
        const parseResult = createMeasureBody.safeParse(request.body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]

            return BadRequest(reply, firstError.message.startsWith("Erro") ? firstError.message : "Tipos de dados inseridos de um ou mais parâmetros estão incorretos", "INVALID_DATA", 400)
        }

        //Se a validação for bem sucedida, extrai os valores
        const { measure_uuid, confirmed_value } = createMeasureBody.parse(request.body);

        //Verifica se o uuid de leitura informado existe
        const measureUuidExist = await prisma.measure.findUnique({
            where:{
                uuid: measure_uuid
            }
        })

        if(!measureUuidExist){
            return BadRequest(reply, "Leitura do mês não encontrada", "MEASURE_NOT_FOUND", 404)
        }

        //Verifica se o código de leitura já foi confirmado
        if(measureUuidExist.has_confirmed === true){
            return BadRequest(reply, "Leitura do mês já realizada", "CONFIRMATION_DUPLICATE", 409)
        }
    })

    //#endregion
}




