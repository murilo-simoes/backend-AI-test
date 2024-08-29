import { Type } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { EmptyOrNull, BadRequest, ConvertInteger } from "../lib/functions";
import { z } from "zod";
import { GetGeminiResponse } from '../api/gemini';

export async function MeasureRoutes(fastify: FastifyInstance) {

    const VALUES = ["WATER", "GAS"] as const;

    //#region POST  - /upload ----------------------------------------------------------------------------------------------------------------------------------------------
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
            measure_type: z.string({invalid_type_error: "Erro - O tipo de medição tem que ser uma string." })
            .refine((val) => VALUES.includes(val as typeof VALUES[number]), {
                message: "Erro - Tipo de medição não permitida",
            })
        })

        // Validação do tipo de dado informado
        const parseResult = createMeasureBody.safeParse(request.body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]
            return BadRequest(reply, firstError.message.startsWith("Erro") ? firstError.message : "Um ou mais parâmetros estão incorretos ou não foram informados", "INVALID_DATA", 400)
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
                    lt: new Date(`${month === 12 ? year + 1 : year}-${month === 12 ? '01' : (month + 1).toString().padStart(2, '0')}-01T00:00:00Z`)
                },
                type: measure_type as Type
            }
        })

        if (measureExist) {
            return BadRequest(reply, "Leitura do mês já realizada", "DOUBLE_REPORT", 409)
        }

        //Chama a API da Gemini 
        const { image_url, text_value } = await GetGeminiResponse(image)

        //Verifica se a LLM conseguiu identificar como um medidor, caso não, retorna o número 0
        let measure_value : number = ConvertInteger(text_value!);

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


    //#region PATCH - /confirm ----------------------------------------------------------------------------------------------------------------------------------------------
    fastify.patch('/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
        
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
            return BadRequest(reply, firstError.message.startsWith("Erro") ? firstError.message : "Um ou mais parâmetros estão incorretos ou não foram informados", "INVALID_DATA", 400)
        }

        //Se a validação for bem sucedida, extrai os valores
        const { measure_uuid, confirmed_value } = createMeasureBody.parse(request.body);

        //Validações dos parâmetros extraidos
        if (EmptyOrNull(measure_uuid.trim()) || !measure_uuid) {
            return BadRequest(reply, "Um ou mais parâmetros não foram informados corretamente", "INVALID_DATA", 400)
        }        

        //Verifica se o uuid de leitura informado existe
        const measureUuidExist = await prisma.measure.findUnique({
            where:{
                uuid: measure_uuid
            }
        })

        if(!measureUuidExist){
            return BadRequest(reply, "Leitura do mês já realizada", "MEASURE_NOT_FOUND", 404)
        }

        //Verifica se o código de leitura já foi confirmado
        if(measureUuidExist.has_confirmed === true){
            return BadRequest(reply, "Leitura do mês já realizada", "CONFIRMATION_DUPLICATE", 409)
        }

        //Salva no banco de dados o novo valor informado
        await prisma.measure.update({
            where:{
                uuid:measure_uuid,
            },
            data:{
                    value:confirmed_value,
                    has_confirmed:true
            }
        })

        //Retorna o resultado
        return reply.status(200).send({
            "success": true
        })
    })

    //#endregion

    //#region GET   - /:customer_code/list?measure_type -----------------------------------------------------------------------------------------------------------------------------
    fastify.get('/:customer_code/list', async (request: FastifyRequest, reply: FastifyReply) => {

         //Pega o parâmetro da rota - customer_code
        const getMeasureParam = z.object({
            customer_code: z.string(),
          });
        
        //Pega o query parâmeter - measure_type
        const getMeasureQuery = z.object({
            measure_type: z.string().toUpperCase()
            .refine((val) => VALUES.includes(val as typeof VALUES[number]), {
                message: "Tipo de medição não permitida",
            }).optional()
        })
        

        //Validação do query parameter - measure_type
        const parseResultQuery = getMeasureQuery.safeParse(request.query);
        if (!parseResultQuery.success) {
            const firstError = parseResultQuery.error.errors[0]
            return BadRequest(reply, firstError.message, "INVALID_TYPE", 400)
        }

        //Se a validação for bem sucedida, extrai os valores
        const { customer_code } = getMeasureParam.parse(request.params);
        const { measure_type } = getMeasureQuery.parse(request.query);

        //Busca os registros no banco de dados
        const measures = await prisma.measure.findMany({
            where:{
                customer_code:customer_code.trim(),
                type: measure_type! as Type
            }
        })

        //Verifica se encontrou registros
        if(measures.length === 0){
            return BadRequest(reply, "Nenhuma leitura encontrada", "MEASURES_NOT_FOUND", 404)
        }
        

        //Retorna o resultado
        return reply.status(200).send({
            customer_code: customer_code,
            measures: measures.map((item) => {
              return {
                measure_uuid: item.uuid,
                measure_datetime: item.datetime,
                measure_type: item.type,
                has_confirmed:item.has_confirmed,
                image_url: item.image_url
              };
            }),
          });
        }
    )

    //#endregion
}




